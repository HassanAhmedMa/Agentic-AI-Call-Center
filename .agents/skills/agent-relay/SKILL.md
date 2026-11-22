---
name: agent-relay
description: >-
  General inter-agent communication, inbox inspection, and self-testing skill for the Agentic Clinic
  platform. Use when the user types /agent-relay, or when the agent needs to inspect unhandled messages
  in .agents/inbox.json or dispatch messages across team branches.
---

# Inter-Agent Relay Management

This skill handles general relay operations, inspecting `.agents/inbox.json`, testing loopbacks, and managing agent coordination across team members (Hassan, Ziad, Ali).

## Supported Teammates & Ports
- **Hassan:** Port 9101 (Antigravity)
- **Ziad:** Port 9102 (OpenAI Codex)
- **Ali:** Port 9103 (Antigravity)

## Operations

### 1. Inspect Local Inbox
Read `.agents/inbox.json` to inspect pending or handled inquiries:
- Filter for records where `handled == false`.
- If an unhandled `Inquiry` exists for the current agent, formulate a factual response and dispatch it.

### 2. Dispatch a Message
```powershell
python scripts/agent_bridge.py --name <Sender> --send --dest <Destination> --type <Inquiry|Response> --body "<Message>"
```

### 3. Self-Test / Loopback Ping
To verify local pop-ups, sound chimes, and tunnel connectivity:
```powershell
python scripts/agent_bridge.py --name Hassan --send --dest Hassan --type Inquiry --body "Loopback test message"
```
