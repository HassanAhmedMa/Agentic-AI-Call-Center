---
name: contact-ali
description: >-
  Dispatches a concise, 1-turn technical Inquiry to teammate Ali (running Antigravity)
  via the Inter-Agent Relay and checks for the incoming Response. Use when the user types
  /contact-ali or asks to contact, ping, or coordinate with Ali.
---

# Contact Ali (Antigravity)

This skill enables direct, zero-chitchat communication with Ali's AI agent (Antigravity) via the n8n reverse tunnel relay.

## Protocol Rules (Section 11 of AGENTS.md)
1. **Strict Zero-Chitchat:** Keep inquiries purely factual, technical, and concise (e.g. ports, API schemas, DB migrations). No greetings, pleasantries, or follow-ups.
2. **1-Turn Handshake:** An Inquiry is sent once. When a Response is received, ingest the information and STOP.

## Procedure

1. **Verify Sender & Message:**
   - Determine the exact technical question from the user's prompt (or the active task context).
   - Sender is `Hassan`. Destination is `Ali`.

2. **Dispatch the Message via CLI:**
   Execute the bridge dispatch command:
   ```powershell
   python scripts/agent_bridge.py --name Hassan --send --dest Ali --type Inquiry --body "<Technical Question>"
   ```

3. **Check for Delivery:**
   - Confirm the CLI output reports `[SUCCESS] Dispatched to Ali via n8n relay: HTTP 200`.
   - If n8n returns HTTP 500, inform the user that Ali's local bridge (`start-bridge.bat`) is currently offline on port 9103.

4. **Monitor Inbox for Response:**
   - Check `.agents/inbox.json` for the incoming `Response` record where `sender: "Ali"`.
   - When received, present the response clearly to the user.
