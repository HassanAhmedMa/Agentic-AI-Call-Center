#!/usr/bin/env python3
"""
Agent Bridge - Local communication relay between AI coding agents.
Receives incoming inquiries/responses via n8n reverse tunnel and writes them to .agents/inbox.json.
Provides outbound CLI dispatch to send inquiries/responses to teammates.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.error
import urllib.request

DEFAULT_PORTS = {
    "Hassan": 9101,
    "Ziad": 9102,
    "Ali": 9103,
}

DEFAULT_N8N_URL = os.environ.get(
    "N8N_RELAY_URL",
    "https://n8n.193-122-68-159.sslip.io/webhook/agent-relay",
)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX_DIR = os.path.join(REPO_ROOT, ".agents")
INBOX_FILE = os.path.join(INBOX_DIR, "inbox.json")


class BridgeHandler(BaseHTTPRequestHandler):
    name = "Agent"

    def do_POST(self):
        if self.path != "/agent-message":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error": "Not found"}')
            return

        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)

        try:
            payload = json.loads(post_data.decode("utf-8"))
        except Exception as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Invalid JSON: {e}"}).encode("utf-8"))
            return

        request_type = payload.get("request_type", "Inquiry")
        sender = payload.get("sender", "Unknown")
        destination = payload.get("destination", self.name)
        body = payload.get("body", "")
        received_at = datetime.now(timezone.utc).isoformat()

        record = {
            "received_at": received_at,
            "sender": sender,
            "destination": destination,
            "request_type": request_type,
            "body": body,
            "handled": False,
        }

        os.makedirs(INBOX_DIR, exist_ok=True)
        inbox_data = []
        if os.path.exists(INBOX_FILE):
            try:
                with open(INBOX_FILE, "r", encoding="utf-8") as f:
                    inbox_data = json.load(f)
                    if not isinstance(inbox_data, list):
                        inbox_data = []
            except Exception:
                inbox_data = []

        inbox_data.append(record)

        with open(INBOX_FILE, "w", encoding="utf-8") as f:
            json.dump(inbox_data, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 65)
        print(f"  [INCOMING INTER-AGENT MESSAGE] -> {self.name.upper()}")
        print(f"  From:         {sender}")
        print(f"  Request Type: {request_type}")
        print(f"  Timestamp:    {received_at}")
        print(f"  Message:\n  {body}")
        print("=" * 65 + "\n")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "received", "record": record}).encode("utf-8"))

        # Auto-invoke the active session for this agent
        invoke_active_agent(self.name, record)

    def log_message(self, format, *args):
        # Suppress routine HTTP access logs
        return


def find_executable(name: str) -> str | None:
    import shutil
    if name in {"Hassan", "Ali"}:
        candidates = [
            shutil.which("agy"),
            os.path.expandvars(r"%LOCALAPPDATA%\agy\bin\agy.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\antigravity\staging\agy.exe"),
            os.path.expanduser(r"~/.local/bin/agy"),
            "/usr/local/bin/agy",
        ]
        for c in candidates:
            if c and os.path.exists(c):
                return c
    elif name == "Ziad":
        candidates = [
            shutil.which("codex"),
            os.path.expandvars(r"%LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\OpenAI\Codex\bin\2e5e00daee91c61d\codex.exe"),
            os.path.expanduser(r"~/.local/bin/codex"),
            "/usr/local/bin/codex",
        ]
        for c in candidates:
            if c and os.path.exists(c):
                return c
    return None


def invoke_active_agent(name: str, record: dict):
    import subprocess
    import threading

    exe = find_executable(name)
    if not exe:
        print(f"[*] Note: Executable for {name} not found in standard paths. Message recorded in {INBOX_FILE}.")
        return

    sender = record.get("sender", "Unknown")
    req_type = record.get("request_type", "Inquiry")
    body = record.get("body", "")

    prompt = (
        f"[INTER-AGENT INCOMING MESSAGE via n8n]\n"
        f"Sender: {sender}\n"
        f"Destination: {name}\n"
        f"Type: {req_type}\n\n"
        f"Message:\n{body}\n\n"
        f"Instructions:\n"
        f"Adhere strictly to Section 11 of AGENTS.md:\n"
        f"- If this is an 'Inquiry', produce exactly ONE direct factual Response to {sender} and dispatch it via:\n"
        f"  python scripts/agent_bridge.py --name {name} --send --dest {sender} --type Response --body \"<Answer>\"\n"
        f"- If this is a 'Response', ingest the information into your task and STOP. Do not send any follow-up pleasantries."
    )

    if name in {"Hassan", "Ali"}:
        cmd = [exe, "--continue", "-p", prompt]
    else:
        cmd = [exe, "exec", "resume", "--last", prompt]

    print(f"[*] Auto-invoking active session for {name} using: {os.path.basename(exe)}...")

    def _runner():
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=REPO_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            stdout, stderr = proc.communicate(timeout=120)
            if stdout:
                print(f"\n--- [{name}'s Agent Response] ---\n{stdout.strip()}\n---------------------------------")
            if proc.returncode != 0 and stderr:
                print(f"[!] Agent invocation stderr: {stderr.strip()}")
        except Exception as e:
            print(f"[!] Error during agent invocation: {e}")

    threading.Thread(target=_runner, daemon=True).start()


def send_message(sender: str, destination: str, request_type: str, body: str, n8n_url: str = DEFAULT_N8N_URL):
    payload = {
        "sender": sender,
        "destination": destination,
        "request_type": request_type,
        "body": body,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    data = json.dumps(payload).encode("utf-8")

    candidates = [n8n_url]
    if "/webhook/" in n8n_url:
        candidates.append(n8n_url.replace("/webhook/", "/webhook-test/"))
    elif "/webhook-test/" in n8n_url:
        candidates.append(n8n_url.replace("/webhook-test/", "/webhook/"))

    last_error = None
    for url in candidates:
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_body = resp.read().decode("utf-8")
                print(f"[SUCCESS] Dispatched to {destination} via n8n relay: HTTP {resp.status}")
                if res_body:
                    print(f"Response: {res_body}")
                return True
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code} - {e.read().decode('utf-8')}"
            if e.code == 404:
                # Try next candidate (e.g. test webhook instead of prod)
                continue
            print(f"[ERROR] Failed to dispatch via n8n: {last_error}")
            return False
        except Exception as e:
            last_error = str(e)
            continue

    print(f"[ERROR] Connection to n8n relay failed ({last_error}). Ensure the workflow is active or in Test mode in n8n.")
    return False


def run_server(name: str, port: int):
    BridgeHandler.name = name
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, BridgeHandler)
    print("=" * 65)
    print(f"  Agent Bridge Listener Active for: {name}")
    print(f"  Listening on: http://127.0.0.1:{port}/agent-message")
    print(f"  Inbox file:   {INBOX_FILE}")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Agent Bridge...")
        httpd.server_close()


def main():
    parser = argparse.ArgumentParser(description="Agent Bridge - Cross-Agent Communication")
    parser.add_argument("--name", required=True, choices=["Hassan", "Ziad", "Ali"], help="Developer/Agent identity")
    parser.add_argument("--port", type=int, help="Local listening port (defaults based on name)")
    parser.add_argument("--send", action="store_true", help="Send an outbound message instead of listening")
    parser.add_argument("--dest", choices=["Hassan", "Ziad", "Ali"], help="Recipient agent")
    parser.add_argument("--type", choices=["Inquiry", "Response"], default="Inquiry", help="Request type")
    parser.add_argument("--body", type=str, help="Message body content")
    parser.add_argument("--url", default=DEFAULT_N8N_URL, help="n8n Webhook relay URL")

    args = parser.parse_args()
    port = args.port or DEFAULT_PORTS.get(args.name, 9101)

    if args.send:
        if not args.dest or not args.body:
            print("[ERROR] --dest and --body are required when --send is specified.")
            sys.exit(1)
        ok = send_message(
            sender=args.name,
            destination=args.dest,
            request_type=args.type,
            body=args.body,
            n8n_url=args.url,
        )
        sys.exit(0 if ok else 1)
    else:
        run_server(args.name, port)


if __name__ == "__main__":
    main()
