"""
Generate a clean, professional, black-and-white UML 2.5 Component Diagram PNG
for the Shiffaa Clinic Architecture & Agentic Call Center.
Strictly zero-overlap, clear UML symbols, academic/engineering grade.
"""

import os
from playwright.sync_api import sync_playwright

WIDTH = 2400
HEIGHT = 1460

svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&amp;family=Inter:wght@400;500;600;700&amp;display=swap');
      
      text {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #000000;
      }}
      .mono {{
        font-family: 'JetBrains Mono', monospace;
      }}
      .title {{
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.5px;
        fill: #000000;
      }}
      .subtitle {{
        font-size: 14px;
        font-weight: 400;
        fill: #444444;
      }}
      .stereotype {{
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        fill: #444444;
      }}
      .comp-name {{
        font-size: 15px;
        font-weight: 700;
        fill: #000000;
      }}
      .subcomp-title {{
        font-size: 12px;
        font-weight: 600;
        fill: #222222;
      }}
      .item-text {{
        font-size: 11.5px;
        font-weight: 400;
        fill: #333333;
      }}
      .edge-label {{
        font-size: 11px;
        font-weight: 600;
        fill: #000000;
      }}
      .edge-sublabel {{
        font-size: 9.5px;
        font-weight: 400;
        fill: #555555;
      }}
      .boundary-label {{
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        fill: #666666;
      }}
      .legend-title {{
        font-size: 13px;
        font-weight: 700;
        fill: #000000;
      }}
      .legend-text {{
        font-size: 11.5px;
        font-weight: 400;
        fill: #333333;
      }}
    </style>

    <!-- UML Standard Arrow Marker -->
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#000000" />
    </marker>

    <!-- Component Tab Symbol -->
    <g id="uml-tab">
      <rect x="0" y="0" width="18" height="14" fill="#FFFFFF" stroke="#000000" stroke-width="1.2"/>
      <rect x="-3" y="2" width="6" height="3" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>
      <rect x="-3" y="8" width="6" height="3" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>
    </g>

    <!-- Database Cylinder Symbol -->
    <g id="uml-db">
      <path d="M 0 4 C 0 1.8 4 0 9 0 C 14 0 18 1.8 18 4 L 18 16 C 18 18.2 14 20 9 20 C 4 20 0 18.2 0 16 Z" fill="#FFFFFF" stroke="#000000" stroke-width="1.2"/>
      <path d="M 0 4 C 0 6.2 4 8 9 8 C 14 8 18 6.2 18 4" fill="none" stroke="#000000" stroke-width="1.2"/>
      <path d="M 0 10 C 0 12.2 4 14 9 14 C 14 14 18 12.2 18 10" fill="none" stroke="#000000" stroke-width="1.2"/>
    </g>
  </defs>

  <!-- Background Canvas -->
  <rect width="{WIDTH}" height="{HEIGHT}" fill="#FFFFFF"/>
  <rect x="15" y="15" width="{WIDTH - 30}" height="{HEIGHT - 30}" fill="none" stroke="#000000" stroke-width="1.5"/>

  <!-- ========================================================================= -->
  <!-- HEADER & DIAGRAM METADATA                                                 -->
  <!-- ========================================================================= -->
  <g transform="translate(50, 55)">
    <text x="0" y="0" class="title">SHIFFAA CLINIC — SYSTEM ARCHITECTURE &amp; AI CALL CENTER</text>
    <text x="0" y="24" class="subtitle">UML 2.5 Component Architecture Model • Implemented Core Services &amp; Planned Conversational Voice Integration</text>
    
    <!-- Rule Callout Box -->
    <g transform="translate(1550, -20)">
      <rect x="0" y="0" width="750" height="48" fill="#FFFFFF" stroke="#000000" stroke-width="1.5"/>
      <text x="20" y="20" font-size="11.5px" font-weight="700" fill="#000000">PRIMARY ARCHITECTURAL INVARIANT:</text>
      <text x="20" y="36" font-size="11px" font-weight="400" fill="#333333">AI Agent has ZERO direct database access. Operations are strictly proposed via typed REST API tool contracts.</text>
    </g>
  </g>

  <!-- Divider Line -->
  <line x1="30" y1="105" x2="{WIDTH - 30}" y2="105" stroke="#E0E0E0" stroke-width="1"/>

  <!-- ========================================================================= -->
  <!-- BOUNDARY TIERS                                                            -->
  <!-- ========================================================================= -->

  <!-- Boundary 1: Client & Ingress Tier (Left) -->
  <rect x="50" y="130" width="570" height="420" fill="none" stroke="#888888" stroke-width="1" stroke-dasharray="6,4" rx="4"/>
  <text x="70" y="155" class="boundary-label">TIER 1 • PATIENT &amp; STAFF CLIENT CHANNELS</text>

  <!-- Boundary 2: Clinic Backend Core (Center) -->
  <rect x="660" y="440" width="650" height="770" fill="none" stroke="#000000" stroke-width="1.2" rx="4"/>
  <text x="680" y="465" class="boundary-label">TIER 2 • DETERMINISTIC CLINIC BACKEND &amp; STORAGE (CURRENT)</text>

  <!-- Boundary 3: AI Voice & Call Center (Right) -->
  <rect x="1350" y="130" width="1000" height="1080" fill="none" stroke="#666666" stroke-width="1.2" stroke-dasharray="8,5" rx="4"/>
  <text x="1370" y="155" class="boundary-label">TIER 3 • AI AGENTIC CALL CENTER &amp; KNOWLEDGE RETRIEVAL (PLANNED)</text>

  <!-- ========================================================================= -->
  <!-- COLUMN 1: CLIENTS & INGRESS GATEWAY                                       -->
  <!-- ========================================================================= -->

  <!-- Component: Patient Portal Web -->
  <g transform="translate(70, 180)">
    <rect width="245" height="150" fill="#FFFFFF" stroke="#000000" stroke-width="1.6"/>
    <use href="#uml-tab" x="217" y="10"/>
    <text x="16" y="26" class="stereotype">«component»</text>
    <text x="16" y="46" class="comp-name">Patient Web Portal</text>
    <line x1="0" y1="58" x2="245" y2="58" stroke="#000000" stroke-width="1"/>
    <text x="16" y="76" class="item-text">• Bilingual Responsive UI (AR/EN)</text>
    <text x="16" y="94" class="item-text">• Doctor Search &amp; Availability View</text>
    <text x="16" y="112" class="item-text">• Appointment Booking Wizard</text>
    <text x="16" y="130" class="item-text">• Passwordless Magic-Link Auth</text>
  </g>

  <!-- Component: Admin Dashboard -->
  <g transform="translate(355, 180)">
    <rect width="245" height="150" fill="#FFFFFF" stroke="#000000" stroke-width="1.6"/>
    <use href="#uml-tab" x="217" y="10"/>
    <text x="16" y="26" class="stereotype">«component»</text>
    <text x="16" y="46" class="comp-name">Admin Dashboard</text>
    <line x1="0" y1="58" x2="245" y2="58" stroke="#000000" stroke-width="1"/>
    <text x="16" y="76" class="item-text">• Clinic Operations Monitor</text>
    <text x="16" y="94" class="item-text">• Doctor Schedule Master Control</text>
    <text x="16" y="112" class="item-text">• Live Booking Event Feed</text>
    <text x="16" y="130" class="item-text">• Realtime WebSocket Listener</text>
  </g>

  <!-- Component: Ingress / Caddy Reverse Proxy -->
  <g transform="translate(70, 390)">
    <rect width="530" height="130" fill="#FFFFFF" stroke="#000000" stroke-width="1.8"/>
    <use href="#uml-tab" x="502" y="10"/>
    <text x="18" y="26" class="stereotype">«subsystem / gateway»</text>
    <text x="18" y="46" class="comp-name">Ingress Gateway [Caddy v2]</text>
    <line x1="0" y1="56" x2="530" y2="56" stroke="#000000" stroke-width="1"/>
    <text x="18" y="76" class="item-text">• Automated ACME SSL/TLS (Let's Encrypt)</text>
    <text x="18" y="94" class="item-text">• HTTP/2, HTTP/3, and WebSocket (WSS) Reverse Proxy</text>
    <text x="18" y="112" class="item-text">• Host &amp; Path Routing (/portal/*, /api/v1/*, sslip.io / duckdns)</text>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 2: CLINIC BACKEND & DATABASE                                       -->
  <!-- ========================================================================= -->

  <!-- Component: Clinic Backend Core -->
  <g transform="translate(680, 490)">
    <rect width="610" height="440" fill="#FFFFFF" stroke="#000000" stroke-width="2"/>
    <use href="#uml-tab" x="580" y="12"/>
    <text x="20" y="28" class="stereotype">«subsystem»</text>
    <text x="20" y="50" class="comp-name">Clinic Backend Service [FastAPI]</text>
    <text x="440" y="28" font-size="10.5px" font-weight="600" fill="#2E7D32">STATUS: IMPLEMENTED</text>
    <line x1="0" y1="64" x2="610" y2="64" stroke="#000000" stroke-width="1.2"/>

    <!-- Subcompartment: API Endpoints & Interfaces -->
    <rect x="20" y="78" width="570" height="74" fill="#FAFAFA" stroke="#CCCCCC" stroke-width="1"/>
    <text x="32" y="96" class="subcomp-title">Provided External Interfaces</text>
    <text x="32" y="114" class="mono" font-size="11px" fill="#111111">• REST API: /api/v1/doctors, /api/v1/availability/search, /api/v1/appointments</text>
    <text x="32" y="132" class="mono" font-size="11px" fill="#111111">• WebSocket Gateway: /api/v1/ws (Live appointment push sync)</text>

    <!-- Subcompartment: Business Domain Modules -->
    <rect x="20" y="166" width="570" height="252" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1"/>
    <text x="32" y="186" class="subcomp-title">Core Clinical Domain Modules (Deterministic Business Rules)</text>
    
    <g transform="translate(32, 206)">
      <circle cx="4" cy="4" r="3" fill="#000000"/>
      <text x="16" y="8" font-size="12px" font-weight="600" fill="#000000">Identity &amp; Authentication Module:</text>
      <text x="16" y="24" class="item-text">Argon2 Password Hashing, Magic Link Tokens, HttpOnly Secure Session Cookies, Luhn Validation</text>
    </g>

    <g transform="translate(32, 248)">
      <circle cx="4" cy="4" r="3" fill="#000000"/>
      <text x="16" y="8" font-size="12px" font-weight="600" fill="#000000">Doctor Directory &amp; Catalog Engine:</text>
      <text x="16" y="24" class="item-text">Specialty categorization, doctor consultation pricing, working hours schedules</text>
    </g>

    <g transform="translate(32, 290)">
      <circle cx="4" cy="4" r="3" fill="#000000"/>
      <text x="16" y="8" font-size="12px" font-weight="600" fill="#000000">Deterministic Availability Engine:</text>
      <text x="16" y="24" class="item-text">Slot interval generator, doctor shift compliance, break times, and dynamic conflict exclusion</text>
    </g>

    <g transform="translate(32, 332)">
      <circle cx="4" cy="4" r="3" fill="#000000"/>
      <text x="16" y="8" font-size="12px" font-weight="600" fill="#000000">Appointment Manager (ACID Transactions):</text>
      <text x="16" y="24" class="item-text">Atomic booking, double-booking prevention, status lifecycle transitions, cancellation &amp; rescheduling</text>
    </g>

    <g transform="translate(32, 374)">
      <circle cx="4" cy="4" r="3" fill="#000000"/>
      <text x="16" y="8" font-size="12px" font-weight="600" fill="#000000">Realtime Event Broadcast Hub:</text>
      <text x="16" y="24" class="item-text">Instant WebSocket dispatch to connected staff dashboards upon booking state changes</text>
    </g>
  </g>

  <!-- Component: Database PostgreSQL -->
  <g transform="translate(680, 990)">
    <rect width="610" height="200" fill="#FFFFFF" stroke="#000000" stroke-width="2"/>
    <use href="#uml-db" x="575" y="12"/>
    <text x="20" y="28" class="stereotype">«database / persistence»</text>
    <text x="20" y="50" class="comp-name">Relational Clinic Database [PostgreSQL 17 / Supabase]</text>
    <line x1="0" y1="64" x2="610" y2="64" stroke="#000000" stroke-width="1.2"/>

    <text x="20" y="86" class="subcomp-title">Managed Relational Entities &amp; Schemas:</text>
    <text x="20" y="106" class="item-text">• <tspan font-weight="600">patients</tspan> (customer_number, full_name, email, phone, gender, dob, language)</text>
    <text x="20" y="124" class="item-text">• <tspan font-weight="600">doctors</tspan> &amp; <tspan font-weight="600">specialties</tspan> (consultation_fee, bio, contact, active_status)</text>
    <text x="20" y="142" class="item-text">• <tspan font-weight="600">doctor_schedules</tspan> (day_of_week, start_time, end_time, slot_duration_minutes)</text>
    <text x="20" y="160" class="item-text">• <tspan font-weight="600">appointments</tspan> &amp; <tspan font-weight="600">slot_reservations</tspan> (patient_id, doctor_id, start_time, end_time, status)</text>
    <text x="20" y="182" class="mono" font-size="10.5px" fill="#444444">• Invariants: Foreign key integrity, Unique time-slot locks, Check constraints</text>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 3: AI CALL CENTER & VOICE AGENT (MIDDLE-RIGHT)                     -->
  <!-- ========================================================================= -->

  <!-- Component: Telephony & Voice Inbound -->
  <g transform="translate(1380, 180)">
    <rect width="420" height="130" fill="#FFFFFF" stroke="#000000" stroke-width="1.6" stroke-dasharray="6,4"/>
    <use href="#uml-tab" x="392" y="10"/>
    <text x="18" y="26" class="stereotype">«external actor / interface»</text>
    <text x="18" y="46" class="comp-name">Inbound Telephony &amp; Callers</text>
    <text x="290" y="26" font-size="10.5px" font-weight="600" fill="#555555">PHASE 2</text>
    <line x1="0" y1="56" x2="420" y2="56" stroke="#000000" stroke-width="1"/>
    <text x="18" y="76" class="item-text">• PSTN / SIP Trunk / Twilio Gateway</text>
    <text x="18" y="94" class="item-text">• WebRTC Real-Time Audio Streaming Channels</text>
    <text x="18" y="112" class="item-text">• Caller Identity (CLI / Caller ID Resolution)</text>
  </g>

  <!-- Component: Voice Gateway Layer -->
  <g transform="translate(1380, 360)">
    <rect width="420" height="140" fill="#FFFFFF" stroke="#000000" stroke-width="1.6" stroke-dasharray="6,4"/>
    <use href="#uml-tab" x="392" y="10"/>
    <text x="18" y="26" class="stereotype">«subsystem / adapter»</text>
    <text x="18" y="46" class="comp-name">Voice Gateway Layer [Audio Adapter]</text>
    <text x="290" y="26" font-size="10.5px" font-weight="600" fill="#555555">PHASE 2</text>
    <line x1="0" y1="56" x2="420" y2="56" stroke="#000000" stroke-width="1"/>
    <text x="18" y="76" class="item-text">• Speech-to-Text (STT): Whisper / FastConformer</text>
    <text x="18" y="94" class="item-text">• Low-Latency Arabic &amp; Egyptian Dialect Support</text>
    <text x="18" y="112" class="item-text">• Text-to-Speech (TTS): ElevenLabs / Edge Realtime</text>
    <text x="18" y="130" class="item-text">• Voice Activity Detection (VAD) &amp; Barge-In Handling</text>
  </g>

  <!-- Component: AI Agent Orchestrator -->
  <g transform="translate(1380, 560)">
    <rect width="420" height="420" fill="#FFFFFF" stroke="#000000" stroke-width="2" stroke-dasharray="7,4"/>
    <use href="#uml-tab" x="392" y="12"/>
    <text x="20" y="28" class="stereotype">«subsystem / intelligence»</text>
    <text x="20" y="50" class="comp-name">AI Agent Orchestrator [LangGraph]</text>
    <text x="290" y="28" font-size="10.5px" font-weight="600" fill="#555555">PHASE 2</text>
    <line x1="0" y1="64" x2="420" y2="64" stroke="#000000" stroke-width="1.2"/>

    <rect x="18" y="78" width="384" height="66" fill="#F9F9F9" stroke="#CCCCCC" stroke-width="1"/>
    <text x="28" y="96" class="subcomp-title">Multi-Turn Conversation State Engine</text>
    <text x="28" y="114" class="item-text">• Finite State Machine session management</text>
    <text x="28" y="130" class="item-text">• Context memory &amp; caller slot confirmation bounds</text>

    <g transform="translate(20, 160)">
      <text x="0" y="0" font-weight="600" font-size="12px" fill="#000000">Intent &amp; Dialect Understanding:</text>
      <text x="0" y="18" class="item-text">• Modern Standard Arabic (MSA)</text>
      <text x="0" y="34" class="item-text">• Egyptian Colloquial Arabic (العامية المصرية)</text>
      <text x="0" y="50" class="item-text">• English &amp; Arabic-English Code Switching</text>
    </g>

    <g transform="translate(20, 236)">
      <text x="0" y="0" font-weight="600" font-size="12px" fill="#000000">Controlled Tool Execution Layer:</text>
      <text x="0" y="18" class="item-text">• Strict JSON Schema Tool Contracts (docs/architecture/tool-schemas.md)</text>
      <text x="0" y="34" class="mono" font-size="11px">• search_doctors()</text>
      <text x="0" y="50" class="mono" font-size="11px">• check_availability()</text>
      <text x="0" y="66" class="mono" font-size="11px">• book_appointment()</text>
      <text x="0" y="82" class="mono" font-size="11px">• cancel_reschedule_appointment()</text>
      <text x="0" y="98" class="mono" font-size="11px">• escalate_to_human_agent()</text>
    </g>

    <rect x="18" y="354" width="384" height="48" fill="#FFFFFF" stroke="#000000" stroke-width="1.2"/>
    <text x="28" y="372" font-size="11px" font-weight="700" fill="#000000">ZERO DIRECT DB CONNECTION:</text>
    <text x="28" y="388" font-size="10.5px" font-weight="400" fill="#333333">All actions dispatched as REST calls to Clinic Backend</text>
  </g>

  <!-- ========================================================================= -->
  <!-- COLUMN 4: KNOWLEDGE SUBSYSTEM & WORKFLOW AUTOMATION (FAR RIGHT)          -->
  <!-- ========================================================================= -->

  <!-- Component: RAG Knowledge Base (Top) -->
  <g transform="translate(1890, 560)">
    <rect width="430" height="175" fill="#FFFFFF" stroke="#000000" stroke-width="1.6" stroke-dasharray="6,4"/>
    <use href="#uml-tab" x="402" y="10"/>
    <text x="18" y="26" class="stereotype">«subsystem / knowledge»</text>
    <text x="18" y="46" class="comp-name">RAG Knowledge Engine</text>
    <text x="300" y="26" font-size="10.5px" font-weight="600" fill="#555555">PHASE 2</text>
    <line x1="0" y1="56" x2="430" y2="56" stroke="#000000" stroke-width="1"/>
    <text x="18" y="76" class="item-text">• Clinic Working Hours &amp; Holiday Policies</text>
    <text x="18" y="94" class="item-text">• Doctor Bios, Qualifications &amp; Specialties</text>
    <text x="18" y="112" class="item-text">• Medical Preparation FAQs &amp; Instructions</text>
    <text x="18" y="130" class="item-text">• Accepted Insurance Providers &amp; Claims Guidance</text>
    <text x="18" y="152" class="mono" font-size="11px" fill="#444444">• Read-Only Retrieval (No state mutation)</text>
  </g>

  <!-- Component: Vector Store Persistence (Middle) -->
  <g transform="translate(1890, 785)">
    <rect width="430" height="165" fill="#FFFFFF" stroke="#000000" stroke-width="1.6" stroke-dasharray="6,4"/>
    <use href="#uml-db" x="400" y="10"/>
    <text x="18" y="26" class="stereotype">«database / vector»</text>
    <text x="18" y="46" class="comp-name">Vector Knowledge Store</text>
    <text x="300" y="26" font-size="10.5px" font-weight="600" fill="#555555">PHASE 2</text>
    <line x1="0" y1="56" x2="430" y2="56" stroke="#000000" stroke-width="1"/>
    <text x="18" y="76" class="item-text">• Clinic Policy Chunk Embeddings (OpenAI / Cohere)</text>
    <text x="18" y="94" class="item-text">• pgvector Extension on PostgreSQL / ChromaDB</text>
    <text x="18" y="112" class="item-text">• Cosine Distance / Hierarchical Semantic Retrieval</text>
    <text x="18" y="134" class="mono" font-size="11px" fill="#444444">• Indexed Document Knowledge Base</text>
  </g>

  <!-- Component: Automation Relay [n8n] (Bottom) -->
  <g transform="translate(1890, 1000)">
    <rect width="430" height="185" fill="#FFFFFF" stroke="#000000" stroke-width="1.6"/>
    <use href="#uml-tab" x="402" y="10"/>
    <text x="18" y="26" class="stereotype">«component / automation»</text>
    <text x="18" y="46" class="comp-name">Workflow Automation [n8n]</text>
    <text x="270" y="26" font-size="10.5px" font-weight="600" fill="#2E7D32">STATUS: INTEGRATED</text>
    <line x1="0" y1="56" x2="430" y2="56" stroke="#000000" stroke-width="1"/>
    <text x="18" y="76" class="item-text">• WhatsApp / SMS Booking Confirmation Dispatch</text>
    <text x="18" y="94" class="item-text">• Human Staff Escalation Ticket Webhooks</text>
    <text x="18" y="112" class="item-text">• OpenWA WhatsApp API Integration Hub</text>
    <text x="18" y="130" class="item-text">• Inter-Agent Multi-Channel Bridge Relay</text>
    <text x="18" y="152" class="mono" font-size="11px" fill="#444444">• Webhook Endpoints on Port 5678</text>
  </g>

  <!-- ========================================================================= -->
  <!-- CONNECTORS & DATA FLOW ARROWS (STRICT ZERO-OVERLAP ROUTING)              -->
  <!-- ========================================================================= -->

  <!-- Flow 1: Patient Portal -> Caddy Gateway -->
  <path d="M 192 330 L 192 390" fill="none" stroke="#000000" stroke-width="1.6" marker-end="url(#arrow)"/>
  <rect x="132" y="348" width="120" height="20" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="140" y="362" class="edge-label">HTTPS (Port 443)</text>

  <!-- Flow 2: Admin Dashboard -> Caddy Gateway -->
  <path d="M 477 330 L 477 390" fill="none" stroke="#000000" stroke-width="1.6" marker-end="url(#arrow)"/>
  <rect x="407" y="348" width="140" height="20" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="414" y="362" class="edge-label">WSS / Live Sync (443)</text>

  <!-- Flow 3: Caddy Gateway -> Clinic Backend Core -->
  <path d="M 600 455 L 640 455 L 640 530 L 680 530" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#arrow)"/>
  <rect x="605" y="482" width="70" height="30" fill="#FFFFFF" stroke="#000000" stroke-width="0.8"/>
  <text x="610" y="496" class="edge-label">REST / WS</text>
  <text x="610" y="508" class="edge-sublabel">:8000 Proxy</text>

  <!-- Flow 4: Clinic Backend Core -> PostgreSQL Database -->
  <path d="M 985 930 L 985 990" fill="none" stroke="#000000" stroke-width="2" marker-end="url(#arrow)"/>
  <rect x="895" y="948" width="180" height="24" fill="#FFFFFF" stroke="#000000" stroke-width="1"/>
  <text x="905" y="964" class="edge-label">SQL / Async Connection Pool</text>

  <!-- Flow 5: Telephony Inbound -> Voice Gateway -->
  <path d="M 1590 310 L 1590 360" fill="none" stroke="#000000" stroke-width="1.6" stroke-dasharray="5,3" marker-end="url(#arrow)"/>
  <rect x="1500" y="323" width="180" height="20" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="1508" y="337" class="edge-label">RTP / WebRTC Audio Stream</text>

  <!-- Flow 6: Voice Gateway -> AI Agent Orchestrator -->
  <path d="M 1590 500 L 1590 560" fill="none" stroke="#000000" stroke-width="1.6" stroke-dasharray="5,3" marker-end="url(#arrow)"/>
  <rect x="1490" y="518" width="200" height="22" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="1498" y="533" class="edge-label">Transcribed Audio / Text Events</text>

  <!-- Flow 7: AI Agent Orchestrator -> Clinic Backend Core (PRIMARY TOOL CALLING ARROW) -->
  <path d="M 1380 700 L 1290 700" fill="none" stroke="#000000" stroke-width="2.4" marker-end="url(#arrow)"/>
  <rect x="1300" y="662" width="70" height="76" fill="#FFFFFF" stroke="#000000" stroke-width="1.4"/>
  <text x="1305" y="680" font-size="11px" font-weight="700" fill="#000000">TOOL</text>
  <text x="1305" y="694" font-size="11px" font-weight="700" fill="#000000">CALLS</text>
  <text x="1305" y="712" font-size="9px" font-weight="600" fill="#555555">REST API</text>
  <text x="1305" y="724" font-size="9px" font-weight="400" fill="#555555">(JSON)</text>

  <!-- Flow 8: AI Agent Orchestrator -> RAG Knowledge Base -->
  <path d="M 1800 645 L 1890 645" fill="none" stroke="#000000" stroke-width="1.6" stroke-dasharray="5,3" marker-end="url(#arrow)"/>
  <rect x="1812" y="630" width="65" height="30" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="1817" y="644" class="edge-label">Context</text>
  <text x="1817" y="655" class="edge-sublabel">Queries</text>

  <!-- Flow 9: RAG Knowledge Engine -> Vector Store (CLEAN VERTICAL DIRECT CONNECTION!) -->
  <path d="M 2105 735 L 2105 785" fill="none" stroke="#000000" stroke-width="1.8" stroke-dasharray="5,3" marker-end="url(#arrow)"/>
  <rect x="2025" y="747" width="160" height="22" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="2032" y="762" class="edge-label">Similarity Vector Search</text>

  <!-- Flow 10: AI Agent Orchestrator -> n8n Workflow Automation (Escalations) -->
  <path d="M 1800 930 L 1845 930 L 1845 1060 L 1890 1060" fill="none" stroke="#000000" stroke-width="1.6" marker-end="url(#arrow)"/>
  <rect x="1808" y="980" width="74" height="30" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="1812" y="994" class="edge-label">Escalate</text>
  <text x="1812" y="1005" class="edge-sublabel">Webhooks</text>

  <!-- Flow 11: Clinic Backend -> n8n Workflow Automation (Notifications) -->
  <!-- Direct horizontal-orthogonal path along bottom of diagram -->
  <path d="M 1290 890 L 1340 890 L 1340 1130 L 1890 1130" fill="none" stroke="#000000" stroke-width="1.4" marker-end="url(#arrow)"/>
  <rect x="1440" y="1118" width="190" height="22" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="0.8"/>
  <text x="1448" y="1133" class="edge-label">Booking Notifications &amp; Alerts</text>

  <!-- ========================================================================= -->
  <!-- ARCHITECTURAL FOOTER & LEGEND PANEL                                       -->
  <!-- ========================================================================= -->
  <g transform="translate(50, 1240)">
    <rect width="{WIDTH - 100}" height="175" fill="#FAFAFA" stroke="#000000" stroke-width="1.4"/>
    
    <!-- Legend Column 1: UML Stereotypes -->
    <g transform="translate(30, 25)">
      <text x="0" y="0" class="legend-title">UML 2.5 NOTATION &amp; STATUS</text>
      
      <rect x="0" y="16" width="30" height="16" fill="#FFFFFF" stroke="#000000" stroke-width="1.6"/>
      <text x="40" y="29" class="legend-text"><tspan font-weight="600">Solid Box:</tspan> Current Implemented Stack (Clinic Backend, Web Portal, DB, Ingress, n8n)</text>
      
      <rect x="0" y="44" width="30" height="16" fill="#FFFFFF" stroke="#000000" stroke-width="1.6" stroke-dasharray="4,3"/>
      <text x="40" y="57" class="legend-text"><tspan font-weight="600">Dashed Box:</tspan> Planned Conversational Voice Extension (Voice Gateway, LangGraph Orchestrator, RAG)</text>

      <line x1="0" y1="80" x2="30" y2="80" stroke="#000000" stroke-width="2" marker-end="url(#arrow)"/>
      <text x="40" y="84" class="legend-text"><tspan font-weight="600">Solid Arrow:</tspan> Synchronous REST API, WebSocket event feed, or SQL connection pool</text>

      <line x1="0" y1="108" x2="30" y2="108" stroke="#000000" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
      <text x="40" y="112" class="legend-text"><tspan font-weight="600">Dashed Arrow:</tspan> Audio streaming events, RAG context queries, or async webhook notifications</text>
    </g>

    <!-- Legend Column 2: Architectural Invariants -->
    <g transform="translate(750, 25)">
      <text x="0" y="0" class="legend-title">GOVERNING ARCHITECTURAL INVARIANTS (ADRs)</text>
      <text x="0" y="24" class="legend-text"><tspan font-weight="600">1. Strict Decoupling:</tspan> The LLM functions strictly within an orchestration layer; it never directly accesses PostgreSQL.</text>
      <text x="0" y="46" class="legend-text"><tspan font-weight="600">2. Deterministic Validation:</tspan> Backend REST services enforce all time conflicts, availability, and business rules.</text>
      <text x="0" y="68" class="legend-text"><tspan font-weight="600">3. Typed Tool Contracts:</tspan> Tool definitions strictly mirror Pydantic schemas (documented in docs/architecture/tool-schemas.md).</text>
      <text x="0" y="90" class="legend-text"><tspan font-weight="600">4. Zero Vendor Lock-in:</tspan> LLM models, STT/TTS engines, and vector stores sit behind pluggable abstract adapters.</text>
      <text x="0" y="112" class="legend-text"><tspan font-weight="600">5. Multi-Dialect Healthcare:</tspan> First-class natural language understanding for Egyptian Arabic, MSA, and English.</text>
    </g>

    <!-- Legend Column 3: Tech Stack Matrix -->
    <g transform="translate(1620, 25)">
      <text x="0" y="0" class="legend-title">DEPLOYED TECHNOLOGY STACK</text>
      <text x="0" y="24" class="legend-text"><tspan font-weight="600">• Core API:</tspan> Python 3.11, FastAPI, SQLAlchemy 2.0 Async, Pydantic v2</text>
      <text x="0" y="46" class="legend-text"><tspan font-weight="600">• Persistence:</tspan> PostgreSQL 17 (Supabase Stack, PostgREST, Realtime CDC)</text>
      <text x="0" y="68" class="legend-text"><tspan font-weight="600">• Ingress &amp; Proxy:</tspan> Caddy v2 Reverse Proxy (Automated TLS, HTTP/2, HTTP/3, WSS)</text>
      <text x="0" y="90" class="legend-text"><tspan font-weight="600">• Frontend:</tspan> Vanilla JS / HTML5 / CSS3, Real-Time WebSockets, RTL Support</text>
      <text x="0" y="112" class="legend-text"><tspan font-weight="600">• Automation &amp; Relay:</tspan> n8n Community Server, OpenWA WhatsApp Adapter</text>
    </g>
  </g>
</svg>
"""

os.makedirs("docs/architecture", exist_ok=True)
svg_path = "docs/architecture/system-architecture.svg"
png_path = "docs/architecture/system-architecture.png"
root_png_path = "system-architecture.png"

with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg_content)

print(f"Saved SVG to {svg_path}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(
        viewport={"width": WIDTH, "height": HEIGHT},
        device_scale_factor=2
    )
    page = context.new_page()
    page.set_content(svg_content)
    page.wait_for_timeout(1000)
    page.screenshot(path=png_path, full_page=True)
    page.screenshot(path=root_png_path, full_page=True)
    browser.close()

print(f"Generated high-resolution PNG: {png_path} and {root_png_path}")
