---
name: contact-hassan
description: >-
  Dispatches a loopback technical self-test message to Hassan's local bridge (port 9101)
  via the n8n reverse tunnel relay to verify desktop pop-ups, audio chimes, and auto-dispatch.
  Use when the user types /contact-hassan or asks to self-test the relay.
---

# Contact Hassan (Self-Test Loopback)

This skill sends a self-addressed test inquiry to verify that Hassan's local bridge, reverse SSH tunnel, audio chime, and 30-second dialog alerts are working end-to-end.

## Procedure

1. **Dispatch the Loopback Message:**
   ```powershell
   python scripts/agent_bridge.py --name Hassan --send --dest Hassan --type Inquiry --body "Loopback verification ping to Hassan"
   ```

2. **Verify Delivery:**
   - Confirm HTTP 200 from n8n.
   - Verify desktop dialog appears on Hassan's screen.
   - Check `.agents/inbox.json` for recorded entry.
