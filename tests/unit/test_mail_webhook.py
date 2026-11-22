import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from clinic_backend.mail import Mail, N8NDelivery
from clinic_backend.settings import Settings
from pydantic import ValidationError


@pytest.fixture
def webhook_server():
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            calls.append(
                (
                    self.path,
                    self.headers.get("X-Clinic-Webhook-Key"),
                    self.rfile.read(int(self.headers["Content-Length"])),
                )
            )
            if self.path == "/redirect":
                self.send_response(307)
                self.send_header("Location", "/unexpected")
                self.end_headers()
            else:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"status":"accepted"}')

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        yield server.server_address[1], calls
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def configured(port, path="/email"):
    return Settings(
        database_url="postgresql+asyncpg://u:p@localhost/test",
        environment="test",
        email_delivery="n8n",
        n8n_webhook_url=f"http://127.0.0.1:{port}{path}",
        n8n_webhook_secret="synthetic-webhook-key-" + "x" * 32,
    )


def test_n8n_sends_only_email_fields_with_authenticated_header(webhook_server):
    port, calls = webhook_server
    settings = configured(port)
    N8NDelivery(settings)._send(
        Mail("synthetic@example.com", "كود التأكيد", "رسالة اختبار")
    )
    assert calls[0][1] == settings.n8n_webhook_secret.get_secret_value()
    assert json.loads(calls[0][2]) == {
        "recipient": "synthetic@example.com",
        "subject": "كود التأكيد",
        "body": "رسالة اختبار",
    }


def test_n8n_never_forwards_authentication_on_redirect(webhook_server):
    port, calls = webhook_server
    with pytest.raises(OSError):
        N8NDelivery(configured(port, "/redirect"))._send(
            Mail("synthetic@example.com", "Test", "Test")
        )
    assert len(calls) == 1


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/email",
        "https://u:p@example.com/email",
        "https://example.com/email?key=x",
        "https://example.com/email#x",
    ],
)
def test_rejects_insecure_or_credential_bearing_webhook_url(url):
    with pytest.raises(ValidationError):
        Settings(
            database_url="postgresql+asyncpg://u:p@localhost/test",
            email_delivery="n8n",
            n8n_webhook_url=url,
            n8n_webhook_secret="x" * 32,
        )


def test_n8n_identity_requires_https_instead_of_smtp_tls():
    s = Settings(
        database_url="postgresql+asyncpg://u:p@localhost/test",
        environment="production",
        identity_enabled=True,
        agent_service_token="a" * 32,
        otp_hmac_secret="b" * 32,
        email_delivery="n8n",
        n8n_webhook_url="https://example.com/email",
        n8n_webhook_secret="c" * 32,
    )
    assert not s.smtp_use_tls
