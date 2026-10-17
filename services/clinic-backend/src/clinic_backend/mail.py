"""SMTP delivery boundary. Never logs recipients, bodies, codes or credentials."""

import asyncio
import json
import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol
from urllib.request import HTTPRedirectHandler, Request, build_opener

from clinic_backend.settings import Settings

logger = logging.getLogger("clinic_backend.mail")


@dataclass(frozen=True)
class Mail:
    recipient: str
    subject: str
    body: str


class Delivery(Protocol):
    def available(self) -> bool: ...
    def reserve(self) -> bool: ...
    def release(self) -> None: ...
    def enqueue(self, message: Mail | None) -> None: ...
    async def close(self) -> None: ...


class SMTPDelivery:
    """Bounded volatile delivery for the local milestone; resend after restart.

    Queue all attempts, including dummy unknown-account jobs, so synchronous API
    responses never depend on SMTP/account lookup delivery time or SMTP errors.
    Production needs a durable encrypted outbox and operational delivery alerts.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.tasks: set[asyncio.Task[None]] = set()
        self.reservations = 0

    def available(self) -> bool:
        return len(self.tasks) + self.reservations < 100

    def reserve(self) -> bool:
        if not self.available():
            return False
        self.reservations += 1
        return True

    def release(self) -> None:
        self.reservations -= 1

    def enqueue(self, message: Mail | None) -> None:
        self.release()
        task = asyncio.create_task(self._deliver(message))
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def _deliver(self, message: Mail | None) -> None:
        if message is None:
            await asyncio.sleep(0)
            return
        try:
            await asyncio.to_thread(self._send, message)
        except (OSError, smtplib.SMTPException):
            logger.error("Email delivery failed; operator action required")

    def _send(self, message: Mail) -> None:
        mime = EmailMessage()
        mime["From"] = self.settings.smtp_from
        mime["To"] = message.recipient
        mime["Subject"] = message.subject
        mime.set_content(message.body)
        with smtplib.SMTP(
            self.settings.smtp_host, self.settings.smtp_port, timeout=5
        ) as smtp:
            smtp.ehlo()
            if self.settings.smtp_use_tls:
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
            if self.settings.smtp_username:
                smtp.login(
                    self.settings.smtp_username,
                    self.settings.smtp_password.get_secret_value(),
                )
            smtp.send_message(mime)

    async def close(self) -> None:
        if self.tasks:
            await asyncio.gather(*list(self.tasks), return_exceptions=True)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(
        self,
        req: Request,
        fp: object,
        code: int,
        msg: str,
        headers: object,
        newurl: str,
    ) -> None:
        return None


class N8NDelivery(SMTPDelivery):
    """Same bounded asynchronous queue, with authenticated HTTPS instead of SMTP."""

    def _send(self, message: Mail) -> None:
        assert self.settings.n8n_webhook_url and self.settings.n8n_webhook_secret
        request = Request(
            self.settings.n8n_webhook_url,
            data=json.dumps(
                {
                    "recipient": message.recipient,
                    "subject": message.subject,
                    "body": message.body,
                },
                ensure_ascii=False,
            ).encode(),
            headers={
                "Content-Type": "application/json",
                "X-Clinic-Webhook-Key": (
                    self.settings.n8n_webhook_secret.get_secret_value()
                ),
            },
            method="POST",
        )
        # Redirects must never forward the authentication header to another host.
        with build_opener(NoRedirect()).open(request, timeout=20) as response:
            payload = response.read(1025)
            if response.status != 200 or len(payload) > 1024:
                raise OSError("Email webhook did not accept delivery")
            try:
                accepted = json.loads(payload) == {"status": "accepted"}
            except (ValueError, UnicodeError):
                accepted = False
            if not accepted:
                raise OSError("Email webhook did not accept delivery")


def make_delivery(settings: Settings) -> Delivery:
    return (
        N8NDelivery(settings)
        if settings.email_delivery == "n8n"
        else SMTPDelivery(settings)
    )


def verification_mail(email: str, code: str, language: str) -> Mail:
    if language == "ar":
        return Mail(
            email,
            "كود تأكيد البريد — عيادتك",
            f"كود تأكيد بريدك هو: {code}\n"
            "الكود صالح لمدة ٥ دقايق. اكتبه في صفحة العيادة، ومتشاركوش مع أي حد.",
        )
    return Mail(
        email,
        "Clinic email verification code",
        f"Your verification code is: {code}\n"
        "It expires in 5 minutes. Enter it on the clinic page; do not share it.",
    )


def number_mail(email: str, number: str, language: str) -> Mail:
    if language == "ar":
        return Mail(
            email,
            "تم تسجيل حسابك — عيادتك",
            f"بريدك اتأكد وحسابك اتسجل. رقم العميل بتاعك: {number}\n"
            "احتفظ بالرقم علشان تسجيل الدخول بعد كده.",
        )
    return Mail(
        email,
        "Clinic account registered",
        f"Your email is verified. Your customer number is: {number}\n"
        "Keep this number for future sign-in.",
    )


def duplicate_mail(email: str, language: str) -> Mail:
    body = (
        "حد حاول يسجل بالبريد ده. لو كنت إنت، استخدم رقم العميل بتاعك لتسجيل الدخول."
        if language == "ar"
        else "Someone tried to register with this address. "
        "If it was you, use your customer number to sign in."
    )
    return Mail(email, "Clinic registration notice", body)
