# Public Chat "Feature Coming Soon" Flag & Real-Time Sync Guide

> **TARGET AUDIENCE:** All AI coding agents (Antigravity, Codex) and human engineers (Hassan, Ziad, Ali, Omar).  
> **CONTEXT:** Phase 1 Public Demo vs. Phase 2 Agent Implementation.

---

## 1. What This Feature Is & Why It Exists

During public demonstration of the Shiffaa Clinics platform on the public VPS URL (`https://clinic-api.193-122-68-159.sslip.io` / `http://<server-ip>`), visitors can explore the Patient Portal. However, because the conversational AI agent is being actively developed in **Phase 2**, the chat widget is not yet fully linked to the backend AI orchestrator.

To prevent public visitors from assuming that the chat interface is "broken", a clean, centered **"Feature Coming Soon..."** (`الميزة قادمة قريباً...`) placeholder overlay is displayed over the Chat tab on public URLs.

---

## 2. Core Operational Rules

1. **Localhost-First Immunity (Local Dev is Never Blocked):**
   - When running locally on `localhost`, `127.0.0.1`, `0.0.0.0`, or local LAN IPs (e.g., via VS Code Live Server on port 5500), the "Coming Soon" overlay is **automatically bypassed**.
   - Engineers can interact with, develop, and test the chat interface unhindered.
   - To preview the "Coming Soon" screen locally for UI verification, simply append `?preview_coming_soon=1` to the URL.

2. **Real-Time Toggle via WebSockets:**
   - Administrators can toggle this mode ON or OFF live from the **Admin Dashboard**:
     - Navigate to **Settings** (`#settings`) $\rightarrow$ Click the **"🤖 AI & Feature Flags"** tab.
     - Toggle the switch: **Public Patient Chat: "Coming Soon" Mode**.
   - Toggling the switch sends `PUT /api/v1/admin/settings/chat-feature`, which writes to `runtime_settings.json` and immediately broadcasts `CHAT_FEATURE_STATUS_CHANGED` via WebSockets to all connected clients.
   - Any open patient portal chat tabs on the public URL update instantly without a page refresh!

---

## 3. How to Permanently Remove or Disable This Indicator (When Phase 2 Chat is Live)

Once Phase 2 conversational AI agent integration is complete and linked to the backend, you can disable or remove this indicator using either of two methods:

### Method A: Permanent UI Toggle (No Code Changes)
1. Log into the Admin Dashboard (`https://clinic-api.193-122-68-159.sslip.io/admin/` or local).
2. Open **Settings** $\rightarrow$ **AI & Feature Flags**.
3. Switch **Public Patient Chat: "Coming Soon" Mode** to **OFF**.
4. The setting persists in `runtime_settings.json` and will keep live chat visible everywhere across server restarts.

### Method B: Code Cleanup (Post-Phase-2 Removal)
If you wish to remove the feature flag completely from the codebase after Phase 2 is finished:
1. In `frontend/user/chat.html`: Remove the `<div id="chatComingSoonOverlay">...</div>` block.
2. In `frontend/user/chat.js`: Remove `initChatFeatureAvailability()` and `initPublicChatWebSocket()`.
3. In `frontend/user/styles.css`: Remove the `.chat-coming-soon-overlay` rules.
4. In `services/clinic-backend/src/clinic_backend/app.py`: Remove `@app.get("/api/v1/public/settings")` and `@app.put("/api/v1/admin/settings/chat-feature")` if no longer needed.
