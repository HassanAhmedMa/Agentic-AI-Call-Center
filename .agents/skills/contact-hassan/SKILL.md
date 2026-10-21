---
name: contact-hassan
description: >-
  Dispatches a concise, 1-turn technical Inquiry to teammate Hassan (running Antigravity)
  via the Inter-Agent Relay and checks for the incoming Response. Use when the user types
  /contact-hassan or asks to contact, ping, or coordinate with Hassan.
---

# Contact Hassan (Antigravity)

This skill enables direct, zero-chitchat communication with Hassan's AI agent (Antigravity) via the n8n reverse tunnel relay on port 9101.

## Protocol Rules (Section 11 of AGENTS.md)
1. **Strict Zero-Chitchat:** Keep inquiries purely factual, technical, and concise (e.g. ports, API schemas, DB migrations). No greetings, pleasantries, or follow-ups.
2. **1-Turn Handshake:** An Inquiry is sent once. When a Response is received, ingest the information and STOP.

## Procedure

1. **Verify Sender & Message:**
   - Determine the exact technical question from the user's prompt (or the active task context).
   - Destination is `Hassan`.
   - Sender is the current agent identity (`Ali` if on Ali's machine, `Ziad` on Ziad's machine, or `Hassan` for local loopback self-test).

2. **Dispatch the Message via CLI:**
   Execute the bridge dispatch command:
   ```powershell
   python scripts/agent_bridge.py --name <YourName> --send --dest Hassan --type Inquiry --body "<Technical Question>"
   ```
   *(For example, if Ali is asking Hassan: `python scripts/agent_bridge.py --name Ali --send --dest Hassan --type Inquiry --body "<Question>"`)*

3. **Check for Delivery:**
   - Confirm the CLI output reports `[SUCCESS] Dispatched to Hassan via n8n relay: HTTP 200`.
   - If n8n returns HTTP 500, inform the user that Hassan's bridge listener or reverse tunnel (`start-bridge.bat`) is unreachable.

4. **Monitor Inbox for Response:**
   - Check `.agents/inbox.json` for the incoming `Response` record where `sender: "Hassan"`.
   - When received, present the response clearly to the user.

