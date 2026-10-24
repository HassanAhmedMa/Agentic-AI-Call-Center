"""
Generate a clean, balanced, executive-level System Architecture Overview diagram
for Shiffaa Clinic & Conversational AI.
Balancing the deep technical detail with high-level visual clarity.
Includes:
- Client & Ingress Layer (Patient Portal, Admin Dashboard, Caddy Gateway)
- Conversational AI & Speech Layer (WebSockets Voice, LangGraph Agent, Ambient Scribe, RAG)
- Deterministic Clinic Backend (FastAPI Core, Business Logic, n8n Relay)
- Persistence Tier (PostgreSQL 17, Vector Storage) with the strict Zero-Direct-DB Invariant.
"""

import os
from playwright.sync_api import sync_playwright

WIDTH = 1920
HEIGHT = 1080

svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&amp;family=Inter:wght@400;500;600;700;800&amp;display=swap');
      
      text {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #000000;
      }}
      .mono {{
        font-family: 'JetBrains Mono', monospace;
      }}
      .title {{
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.5px;
        fill: #0F172A;
      }}
      .subtitle {{
        font-size: 13.5px;
        font-weight: 500;
        fill: #475569;
      }}
      .stereotype {{
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: 0.5px;
        fill: #64748B;
        text-transform: uppercase;
      }}
      .comp-name {{
        font-size: 15px;
        font-weight: 700;
        fill: #0F172A;
      }}
      .subcomp-title {{
        font-size: 11.5px;
        font-weight: 700;
        fill: #1E293B;
      }}
      .item-text {{
        font-size: 11px;
        font-weight: 400;
        fill: #334155;
      }}
      .edge-label {{
        font-size: 10.5px;
        font-weight: 700;
        fill: #0F172A;
      }}
      .edge-sublabel {{
        font-size: 9.5px;
        font-weight: 500;
        fill: #64748B;
      }}
      .tier-header {{
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        fill: #334155;
      }}
      .legend-title {{
        font-size: 12px;
        font-weight: 700;
        fill: #0F172A;
      }}
      .legend-text {{
        font-size: 11px;
        font-weight: 400;
        fill: #334155;
      }}
    </style>

    <!-- UML Standard Arrow Marker -->
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0F172A" />
    </marker>
    
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#2563EB" />
    </marker>

    <!-- Component Tab Symbol -->
    <g id="uml-tab">
      <rect x="0" y="0" width="16" height="13" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.2"/>
      <rect x="-3" y="2" width="5" height="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="1"/>
      <rect x="-3" y="7" width="5" height="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="1"/>
    </g>

    <!-- Database Cylinder Symbol -->
    <g id="uml-db">
      <path d="M 0 3.5 C 0 1.5 3.5 0 8 0 C 12.5 0 16 1.5 16 3.5 L 16 14.5 C 16 16.5 12.5 18 8 18 C 3.5 18 0 16.5 0 14.5 Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.2"/>
      <path d="M 0 3.5 C 0 5.5 3.5 7 8 7 C 12.5 7 16 5.5 16 3.5" fill="none" stroke="#0F172A" stroke-width="1.2"/>
      <path d="M 0 9 C 0 11 3.5 12.5 8 12.5 C 12.5 12.5 16 11 16 9" fill="none" stroke="#0F172A" stroke-width="1.2"/>
    </g>
  </defs>

  <!-- Background Canvas -->
  <rect width="{WIDTH}" height="{HEIGHT}" fill="#FFFFFF"/>
  <rect x="16" y="16" width="{WIDTH - 32}" height="{HEIGHT - 32}" fill="none" stroke="#0F172A" stroke-width="1.5" rx="6"/>

  <!-- ========================================================================= -->
  <!-- HEADER & PRIMARY INVARIANT                                                -->
  <!-- ========================================================================= -->
  <g transform="translate(48, 56)">
    <text x="0" y="0" class="title">SHIFFAA CLINIC — SYSTEM ARCHITECTURE OVERVIEW</text>
    <text x="0" y="22" class="subtitle">Deterministic Healthcare Backend • Conversational Voice AI • Ambient Clinical Scribe</text>
    
    <!-- Primary Invariant Callout Badge -->
    <g transform="translate(1030, -22)">
      <rect x="0" y="0" width="790" height="52" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.5" rx="6"/>
      <text x="18" y="21" font-size="11.5px" font-weight="800" fill="#0F172A">🔒 CORE ARCHITECTURAL INVARIANT (ZERO DIRECT DB ACCESS):</text>
      <text x="18" y="38" font-size="11px" font-weight="500" fill="#334155">The LLM Orchestrator NEVER queries PostgreSQL directly. All mutations execute via strictly typed REST API tools.</text>
    </g>
  </g>

  <!-- Top Divider Line -->
  <line x1="32" y1="102" x2="{WIDTH - 32}" y2="102" stroke="#E2E8F0" stroke-width="1.2"/>

  <!-- ========================================================================= -->
  <!-- TIER 1: CLIENTS & INGRESS                                                 -->
  <!-- ========================================================================= -->
  <rect x="48" y="125" width="410" height="780" fill="#FAFAFA" stroke="#CBD5E1" stroke-width="1.2" rx="6"/>
  <text x="68" y="152" class="tier-header">1. CLIENTS &amp; INGRESS GATEWAY</text>

  <!-- Patient Portal Card -->
  <g transform="translate(68, 175)">
    <rect width="370" height="195" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5" rx="4"/>
    <use href="#uml-tab" x="340" y="12"/>
    <text x="16" y="25" class="stereotype">«client application»</text>
    <text x="16" y="46" class="comp-name">Patient Web Portal</text>
    <line x1="0" y1="58" x2="370" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Bilingual Responsive UI (Arabic &amp; English)</text>
    <text x="16" y="102" class="item-text">• Real-time AI Chat &amp; Streaming Voice Agent</text>
    <text x="16" y="124" class="item-text">• Doctor Directory &amp; Slot Booking Wizard</text>
    <text x="16" y="146" class="item-text">• Passwordless Magic-Link OTP Authentication</text>
    <text x="16" y="168" class="item-text">• Live Appointment Status Tracking &amp; Reschedule</text>
  </g>

  <!-- Admin Dashboard Card -->
  <g transform="translate(68, 395)">
    <rect width="370" height="195" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5" rx="4"/>
    <use href="#uml-tab" x="340" y="12"/>
    <text x="16" y="25" class="stereotype">«staff application»</text>
    <text x="16" y="46" class="comp-name">Admin &amp; Doctor Dashboard</text>
    <line x1="0" y1="58" x2="370" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Clinic Operations &amp; Shift Management</text>
    <text x="16" y="102" class="item-text">• Real-time Live Booking Push Feed (WebSocket)</text>
    <text x="16" y="124" class="item-text">• Doctor Consultation &amp; Ambient Scribing Console</text>
    <text x="16" y="146" class="item-text">• SOAP Note Verification &amp; One-Click EHR Approval</text>
    <text x="16" y="168" class="item-text">• Feature Flags &amp; Runtime Settings Toggle</text>
  </g>

  <!-- Ingress Gateway (Caddy) Card -->
  <g transform="translate(68, 615)">
    <rect width="370" height="265" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.8" rx="4"/>
    <use href="#uml-tab" x="340" y="12"/>
    <text x="16" y="25" class="stereotype">«subsystem / reverse proxy»</text>
    <text x="16" y="46" class="comp-name">Ingress Gateway [Caddy v2]</text>
    <line x1="0" y1="58" x2="370" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Automated ACME SSL/TLS Certificates</text>
    <text x="16" y="102" class="item-text">• HTTP/2, HTTP/3, and Full-Duplex WebSockets (WSS)</text>
    <text x="16" y="124" class="item-text">• Reverse Proxy Host &amp; Subpath Demultiplexing:</text>
    
    <rect x="16" y="136" width="338" height="110" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" rx="4"/>
    <text x="26" y="156" class="mono" font-size="10.5px" fill="#0F172A">/portal/*  ➔ Patient Static Web Pages</text>
    <text x="26" y="176" class="mono" font-size="10.5px" fill="#0F172A">/admin/*   ➔ Staff Management Console</text>
    <text x="26" y="196" class="mono" font-size="10.5px" fill="#0F172A">/api/v1/*  ➔ FastAPI Backend Services</text>
    <text x="26" y="216" class="mono" font-size="10.5px" fill="#0F172A">/ws        ➔ Real-time WebSocket Hubs</text>
    <text x="26" y="234" class="mono" font-size="10.5px" fill="#0F172A">/voice/ws  ➔ Audio Streaming Gateway</text>
  </g>

  <!-- ========================================================================= -->
  <!-- TIER 2: CONVERSATIONAL AI & AMBIENT SCRIBE                                -->
  <!-- ========================================================================= -->
  <rect x="490" y="125" width="490" height="780" fill="#FAFAFA" stroke="#64748B" stroke-width="1.4" stroke-dasharray="6,4" rx="6"/>
  <text x="510" y="152" class="tier-header">2. CONVERSATIONAL AI &amp; AMBIENT SCRIBING</text>

  <!-- Voice & Audio Gateway Card -->
  <g transform="translate(510, 175)">
    <rect width="450" height="145" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5" stroke-dasharray="5,3" rx="4"/>
    <use href="#uml-tab" x="420" y="12"/>
    <text x="16" y="25" class="stereotype">«voice gateway / streaming»</text>
    <text x="16" y="46" class="comp-name">Voice Streaming Gateway [WebSockets]</text>
    <line x1="0" y1="58" x2="450" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Full-Duplex Web Audio Streaming over WSS (No Twilio/PSTN)</text>
    <text x="16" y="102" class="item-text">• Dialectal ASR (Whisper): Egyptian Arabic &amp; English Code-Switching</text>
    <text x="16" y="124" class="item-text">• Low-Latency Streaming Neural TTS (&lt;250ms first-chunk response)</text>
  </g>

  <!-- AI Agent Orchestrator Card (Central Brain) -->
  <g transform="translate(510, 340)">
    <rect width="450" height="235" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.8" stroke-dasharray="5,3" rx="4"/>
    <use href="#uml-tab" x="420" y="12"/>
    <text x="16" y="25" class="stereotype">«ai orchestrator / langgraph»</text>
    <text x="16" y="46" class="comp-name">AI Agent Orchestrator [LangGraph]</text>
    <line x1="0" y1="58" x2="450" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Stateful Multi-Turn Dialogue Management &amp; Bounded Memory</text>
    <text x="16" y="102" class="item-text">• Zero-Hallucination Guardrails &amp; Emergency Escalation Protocol</text>
    <text x="16" y="124" class="item-text">• Typed Tool Invocations: Proposes doctor search &amp; slot booking</text>
    <text x="16" y="146" class="item-text">• Pydantic Validation: Enforces exact schema contracts</text>
    <text x="16" y="168" class="item-text">• Human-in-the-Loop Hand-off &amp; Support Ticket Issuer</text>
    
    <rect x="16" y="180" width="418" height="42" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" rx="4"/>
    <text x="24" y="198" font-size="10.5px" font-weight="700" fill="#1E40AF">⚡ Zero-Direct-DB Enforcement:</text>
    <text x="24" y="213" font-size="10px" font-weight="500" fill="#334155">Agent interacts EXCLUSIVELY via HTTP client calling Clinic Backend APIs.</text>
  </g>

  <!-- Ambient Clinical Scribe Card (NEW FEATURE) -->
  <g transform="translate(510, 595)">
    <rect width="450" height="155" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.8" rx="4"/>
    <use href="#uml-tab" x="420" y="12"/>
    <text x="16" y="25" class="stereotype">«ambient clinical intelligence»</text>
    <text x="16" y="46" class="comp-name">Ambient Clinical Scribe (Doctor Desk)</text>
    <text x="325" y="25" font-size="10px" font-weight="700" fill="#2563EB">NEW FEATURE</text>
    <line x1="0" y1="58" x2="450" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Live Consultation Listening: Passive in-clinic room microphone capture</text>
    <text x="16" y="102" class="item-text">• Speaker Diarization: Distinguishes physician questions from patient symptoms</text>
    <text x="16" y="124" class="item-text">• Automated SOAP Generation: Subjective, Objective, Assessment, Plan</text>
    <text x="16" y="144" class="item-text">• Instant Synthesis on Session End with One-Click Doctor Approval</text>
  </g>

  <!-- RAG Knowledge Base Card -->
  <g transform="translate(510, 770)">
    <rect width="450" height="110" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.4" stroke-dasharray="5,3" rx="4"/>
    <use href="#uml-tab" x="420" y="12"/>
    <text x="16" y="23" class="stereotype">«knowledge retrieval»</text>
    <text x="16" y="43" class="comp-name">RAG Knowledge Engine &amp; Vector Store</text>
    <line x1="0" y1="54" x2="450" y2="54" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="74" class="item-text">• Informational Only: Clinic policies, department hours, insurance FAQ</text>
    <text x="16" y="94" class="item-text">• Dense Embeddings &amp; Cosine Retrieval (Never mutates database state)</text>
  </g>

  <!-- ========================================================================= -->
  <!-- TIER 3: DETERMINISTIC CLINIC BACKEND                                      -->
  <!-- ========================================================================= -->
  <rect x="1010" y="125" width="460" height="780" fill="#FAFAFA" stroke="#0F172A" stroke-width="1.4" rx="6"/>
  <text x="1030" y="152" class="tier-header">3. DETERMINISTIC CLINIC BACKEND (FASTAPI)</text>

  <!-- Core Clinic Backend Service -->
  <g transform="translate(1030, 175)">
    <rect width="420" height="470" fill="#FFFFFF" stroke="#0F172A" stroke-width="2" rx="4"/>
    <use href="#uml-tab" x="390" y="12"/>
    <text x="16" y="25" class="stereotype">«subsystem / core backend»</text>
    <text x="16" y="46" class="comp-name">Clinic Backend Service [FastAPI]</text>
    <text x="290" y="25" font-size="10px" font-weight="700" fill="#166534">STATUS: IMPLEMENTED</text>
    <line x1="0" y1="58" x2="420" y2="58" stroke="#0F172A" stroke-width="1.2"/>

    <!-- REST & WebSocket Endpoints Box -->
    <rect x="16" y="70" width="388" height="68" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1" rx="4"/>
    <text x="26" y="88" class="subcomp-title">Provided REST &amp; WebSocket Endpoints:</text>
    <text x="26" y="106" class="mono" font-size="10.5px" fill="#0F172A">GET /doctors • GET /availability/search</text>
    <text x="26" y="124" class="mono" font-size="10.5px" fill="#0F172A">POST /appointments • WS /api/v1/ws (Live Push)</text>

    <!-- Business Domain Rules -->
    <text x="16" y="160" class="subcomp-title">Deterministic Clinical Domain Modules:</text>
    
    <g transform="translate(16, 175)">
      <circle cx="5" cy="5" r="3" fill="#0F172A"/>
      <text x="16" y="9" font-size="11.5px" font-weight="700" fill="#0F172A">Identity &amp; Session Management:</text>
      <text x="16" y="25" class="item-text">Argon2 Password Hashing, Magic Link Tokens,</text>
      <text x="16" y="40" class="item-text">HttpOnly Secure Session Cookies, Phone Luhn checks.</text>
    </g>

    <g transform="translate(16, 230)">
      <circle cx="5" cy="5" r="3" fill="#0F172A"/>
      <text x="16" y="9" font-size="11.5px" font-weight="700" fill="#0F172A">Doctor Shift &amp; Working Days Engine:</text>
      <text x="16" y="25" class="item-text">Specialty directory, shift hour enforcement,</text>
      <text x="16" y="40" class="item-text">Friday clinic-wide weekend lock &amp; public closures.</text>
    </g>

    <g transform="translate(16, 285)">
      <circle cx="5" cy="5" r="3" fill="#0F172A"/>
      <text x="16" y="9" font-size="11.5px" font-weight="700" fill="#0F172A">Deterministic Availability &amp; ACID Booking:</text>
      <text x="16" y="25" class="item-text">Dynamic slot generation, atomic transactions,</text>
      <text x="16" y="40" class="item-text">double-booking prevention, cancellation/reschedule.</text>
    </g>

    <g transform="translate(16, 340)">
      <circle cx="5" cy="5" r="3" fill="#0F172A"/>
      <text x="16" y="9" font-size="11.5px" font-weight="700" fill="#0F172A">EHR &amp; SOAP Record Ingestion:</text>
      <text x="16" y="25" class="item-text">Authenticated API ingesting verified SOAP notes,</text>
      <text x="16" y="40" class="item-text">linking patient history with doctor electronic signature.</text>
    </g>

    <g transform="translate(16, 395)">
      <circle cx="5" cy="5" r="3" fill="#0F172A"/>
      <text x="16" y="9" font-size="11.5px" font-weight="700" fill="#0F172A">WebSocket Live Broadcast Hub:</text>
      <text x="16" y="25" class="item-text">Broadcasts booking changes &amp; feature flag status</text>
      <text x="16" y="40" class="item-text">instantly to all open client browser sessions.</text>
    </g>
  </g>

  <!-- Asynchronous Automation (n8n Relay) Card -->
  <g transform="translate(1030, 665)">
    <rect width="420" height="215" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.6" rx="4"/>
    <use href="#uml-tab" x="390" y="12"/>
    <text x="16" y="25" class="stereotype">«automation service / relay»</text>
    <text x="16" y="46" class="comp-name">Asynchronous Automation [n8n]</text>
    <line x1="0" y1="58" x2="420" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• Out-of-Band Notification &amp; Webhook Workflows</text>
    <text x="16" y="102" class="item-text">• Transactional Email &amp; OTP Code Dispatch</text>
    <text x="16" y="124" class="item-text">• Team Inter-Agent Communication Bridge (Relay)</text>
    <text x="16" y="146" class="item-text">• Automated Patient Appointment Reminders</text>
    <text x="16" y="168" class="item-text">• Independent async container running on local port 5678</text>
  </g>

  <!-- ========================================================================= -->
  <!-- TIER 4: PERSISTENCE & STORAGE TIER                                        -->
  <!-- ========================================================================= -->
  <rect x="1495" y="125" width="375" height="780" fill="#FAFAFA" stroke="#0F172A" stroke-width="1.4" rx="6"/>
  <text x="1515" y="152" class="tier-header">4. PERSISTENCE &amp; SOVEREIGN DATA</text>

  <!-- Relational Database PostgreSQL Card -->
  <g transform="translate(1515, 175)">
    <rect width="335" height="470" fill="#FFFFFF" stroke="#0F172A" stroke-width="2" rx="4"/>
    <use href="#uml-db" x="305" y="12"/>
    <text x="16" y="25" class="stereotype">«database / persistence»</text>
    <text x="16" y="46" class="comp-name">PostgreSQL 17 [Supabase]</text>
    <line x1="0" y1="58" x2="335" y2="58" stroke="#0F172A" stroke-width="1.2"/>

    <text x="16" y="80" class="subcomp-title">Relational Tables &amp; Constraints:</text>
    <text x="16" y="102" class="item-text">• <tspan font-weight="600">doctors:</tspan> Profiles, specialties, fees, shifts</text>
    <text x="16" y="124" class="item-text">• <tspan font-weight="600">doctor_availability:</tspan> Slot schedules</text>
    <text x="16" y="146" class="item-text">• <tspan font-weight="600">patients:</tspan> Identifiers, phones, credentials</text>
    <text x="16" y="168" class="item-text">• <tspan font-weight="600">appointments:</tspan> Booking state machine</text>
    <text x="16" y="190" class="item-text">• <tspan font-weight="600">medical_records / soap_notes:</tspan> EHR data</text>
    <text x="16" y="212" class="item-text">• <tspan font-weight="600">support_tickets:</tspan> Escalated human cases</text>
    <text x="16" y="234" class="item-text">• <tspan font-weight="600">audit_logs:</tspan> Cryptographic change trail</text>
    <text x="16" y="256" class="item-text">• <tspan font-weight="600">clinic_holidays:</tspan> Official closure dates</text>

    <!-- Strict Isolation Banner -->
    <rect x="16" y="280" width="303" height="170" fill="#FEF2F2" stroke="#EF4444" stroke-width="1.5" rx="4"/>
    <text x="26" y="304" font-size="11.5px" font-weight="800" fill="#991B1B">⛔ HARD SECURITY BOUNDARY:</text>
    <text x="26" y="324" font-size="10.5px" font-weight="600" fill="#B91C1C">• Direct SQL Queries by LLM Prohibited</text>
    <text x="26" y="342" font-size="10px" font-weight="400" fill="#7F1D1D">No database credentials or raw connection strings are ever passed into agent prompts or context.</text>
    
    <text x="26" y="375" font-size="10.5px" font-weight="600" fill="#B91C1C">• Strict Backend Mediation:</text>
    <text x="26" y="393" font-size="10px" font-weight="400" fill="#7F1D1D">All database writes require validated ACID transactions via SQLAlchemy / FastAPI.</text>
    <text x="26" y="426" font-size="10.5px" font-weight="700" fill="#166534">✔ Sovereign &amp; On-Premise Hostable</text>
  </g>

  <!-- Vector Store & Runtime State Card -->
  <g transform="translate(1515, 665)">
    <rect width="335" height="215" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.6" rx="4"/>
    <use href="#uml-db" x="305" y="12"/>
    <text x="16" y="25" class="stereotype">«vector db / cache»</text>
    <text x="16" y="46" class="comp-name">Vector Storage &amp; Config</text>
    <line x1="0" y1="58" x2="335" y2="58" stroke="#E2E8F0" stroke-width="1"/>
    <text x="16" y="80" class="item-text">• <tspan font-weight="600">pgvector / In-Memory Index:</tspan></text>
    <text x="24" y="98" class="item-text">Clinic FAQ &amp; policy chunk embeddings</text>
    <text x="16" y="124" class="item-text">• <tspan font-weight="600">Runtime Settings JSON Store:</tspan></text>
    <text x="24" y="142" class="item-text">Thread-safe dynamic feature flags (Coming Soon)</text>
    <text x="16" y="168" class="item-text">• <tspan font-weight="600">Ephemeral Session Store:</tspan></text>
    <text x="24" y="186" class="item-text">Active WebSocket client connections &amp; heartbeat</text>
  </g>

  <!-- ========================================================================= -->
  <!-- CONNECTING ARROWS & LABELS                                                -->
  <!-- ========================================================================= -->

  <!-- 1. Patient Portal / Admin -> Caddy Ingress -->
  <line x1="253" y1="370" x2="253" y2="615" stroke="#0F172A" stroke-width="1.8" marker-end="url(#arrow)"/>
  <rect x="200" y="480" width="106" height="24" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.8" rx="3"/>
  <text x="253" y="496" text-anchor="middle" class="edge-label">HTTPS / WSS</text>

  <!-- 2. Caddy Ingress -> Voice Gateway -->
  <path d="M 438 650 L 474 650 L 474 247 L 510 247" fill="none" stroke="#0F172A" stroke-width="1.8" marker-end="url(#arrow)"/>
  <rect x="444" y="435" width="60" height="20" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.8" rx="3"/>
  <text x="474" y="449" text-anchor="middle" class="edge-label">WSS Audio</text>

  <!-- 3. Caddy Ingress -> Clinic Backend -->
  <path d="M 438 720 L 750 720 L 750 645 L 1030 645" fill="none" stroke="#0F172A" stroke-width="2" marker-end="url(#arrow)"/>
  <rect x="700" y="633" width="100" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="1" rx="3"/>
  <text x="750" y="648" text-anchor="middle" class="edge-label">REST &amp; WS Sync</text>

  <!-- 4. Voice Gateway -> AI Agent Orchestrator -->
  <line x1="735" y1="320" x2="735" y2="340" stroke="#0F172A" stroke-width="1.8" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
  <text x="745" y="334" class="edge-sublabel">Transcribed ECA Text / Audio Frames</text>

  <!-- 5. AI Agent Orchestrator -> Clinic Backend (Typed Tool Calls) -->
  <line x1="960" y1="450" x2="1030" y2="450" stroke="#2563EB" stroke-width="2.2" marker-end="url(#arrow-blue)"/>
  <rect x="942" y="415" width="105" height="30" fill="#EFF6FF" stroke="#2563EB" stroke-width="1" rx="3"/>
  <text x="994" y="428" text-anchor="middle" font-size="10.5px" font-weight="800" fill="#1E40AF">REST Tool Calls</text>
  <text x="994" y="440" text-anchor="middle" font-size="9px" font-weight="600" fill="#2563EB">(Zero Direct DB)</text>

  <!-- 6. AI Agent Orchestrator <-> RAG Knowledge Base -->
  <path d="M 735 575 L 735 770" fill="none" stroke="#64748B" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
  <rect x="670" y="660" width="130" height="20" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="0.8" rx="3"/>
  <text x="735" y="674" text-anchor="middle" class="edge-label" fill="#475569">Context Search (Read-Only)</text>

  <!-- 7. Ambient Scribe -> Clinic Backend (EHR SOAP Ingestion) -->
  <path d="M 960 670 L 995 670 L 995 560 L 1030 560" fill="none" stroke="#2563EB" stroke-width="2" marker-end="url(#arrow-blue)"/>
  <rect x="955" y="605" width="80" height="22" fill="#EFF6FF" stroke="#2563EB" stroke-width="1" rx="3"/>
  <text x="995" y="620" text-anchor="middle" font-size="10px" font-weight="700" fill="#1E40AF">SOAP EHR Sync</text>

  <!-- 8. Clinic Backend -> PostgreSQL Database -->
  <line x1="1450" y1="410" x2="1515" y2="410" stroke="#0F172A" stroke-width="2.2" marker-end="url(#arrow)"/>
  <rect x="1456" y="392" width="53" height="34" fill="#FFFFFF" stroke="#0F172A" stroke-width="1" rx="3"/>
  <text x="1482" y="407" text-anchor="middle" font-size="10px" font-weight="800" fill="#0F172A">SQL</text>
  <text x="1482" y="420" text-anchor="middle" font-size="8.5px" font-weight="600" fill="#475569">Pool</text>

  <!-- 9. Clinic Backend <-> n8n Relay -->
  <line x1="1240" y1="645" x2="1240" y2="665" stroke="#0F172A" stroke-width="1.6" marker-end="url(#arrow)"/>
  <text x="1250" y="658" class="edge-sublabel">Async Webhooks</text>

  <!-- 10. n8n Relay -> PostgreSQL (Verification tokens read/write) -->
  <path d="M 1450 772 L 1482 772 L 1482 520 L 1515 520" fill="none" stroke="#64748B" stroke-width="1.5" stroke-dasharray="4,3" marker-end="url(#arrow)"/>

  <!-- ========================================================================= -->
  <!-- FOOTER & COMPACT LEGEND                                                   -->
  <!-- ========================================================================= -->
  <g transform="translate(48, 925)">
    <rect width="{WIDTH - 96}" height="120" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.4" rx="6"/>
    
    <!-- Legend Item 1: Box Types -->
    <g transform="translate(30, 24)">
      <text x="0" y="0" class="legend-title">ARCHITECTURAL NOTATION</text>
      
      <rect x="0" y="16" width="28" height="15" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.6" rx="2"/>
      <text x="36" y="28" class="legend-text"><tspan font-weight="700">Solid Box:</tspan> Core Implemented Stack (FastAPI, PostgreSQL 17, Caddy Gateway, n8n Relay, Portals)</text>
      
      <rect x="0" y="44" width="28" height="15" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.6" stroke-dasharray="4,2" rx="2"/>
      <text x="36" y="56" class="legend-text"><tspan font-weight="700">Dashed Box:</tspan> Conversational AI Modules (LangGraph Agent, WebSocket Voice, RAG Knowledge Base)</text>

      <rect x="0" y="72" width="28" height="15" fill="#EFF6FF" stroke="#2563EB" stroke-width="1.6" rx="2"/>
      <text x="36" y="84" class="legend-text"><tspan font-weight="700" fill="#1E40AF">Blue Accent:</tspan> Ambient Clinical Scribe (Live Diarization &amp; Automated SOAP Note Synthesis)</text>
    </g>

    <!-- Legend Item 2: Connection Types -->
    <g transform="translate(740, 24)">
      <text x="0" y="0" class="legend-title">COMMUNICATION CHANNELS</text>
      
      <line x1="0" y1="24" x2="30" y2="24" stroke="#0F172A" stroke-width="2" marker-end="url(#arrow)"/>
      <text x="38" y="28" class="legend-text"><tspan font-weight="700">Solid Arrow:</tspan> Synchronous REST API request, WebSocket push event, or SQLAlchemy connection pool</text>
      
      <line x1="0" y1="52" x2="30" y2="52" stroke="#2563EB" stroke-width="2.2" marker-end="url(#arrow-blue)"/>
      <text x="38" y="56" class="legend-text"><tspan font-weight="700" fill="#1E40AF">Blue Arrow:</tspan> Typed Tool Calling &amp; SOAP Record Ingestion (Strict Pydantic contract validation)</text>

      <line x1="0" y1="80" x2="30" y2="80" stroke="#64748B" stroke-width="1.8" stroke-dasharray="4,3" marker-end="url(#arrow)"/>
      <text x="38" y="84" class="legend-text"><tspan font-weight="700">Dashed Arrow:</tspan> Streaming WebSockets audio, RAG semantic context search, or asynchronous webhook</text>
    </g>

    <!-- Legend Item 3: Key Properties -->
    <g transform="translate(1410, 24)">
      <text x="0" y="0" class="legend-title">KEY DESIGN PRINCIPLES</text>
      <text x="0" y="24" class="legend-text">• <tspan font-weight="700">Zero Direct DB Access:</tspan> Complete LLM isolation</text>
      <text x="0" y="44" class="legend-text">• <tspan font-weight="700">Egyptian Arabic Native:</tspan> ECA &amp; Med Code-Switching</text>
      <text x="0" y="64" class="legend-text">• <tspan font-weight="700">Dual-Core Operations:</tspan> Patient Agent + Doctor Scribe</text>
      <text x="0" y="84" class="legend-text">• <tspan font-weight="700">Sovereign &amp; Local-First:</tspan> 100% on-premise capable</text>
    </g>
  </g>

</svg>
"""

os.makedirs("docs/architecture", exist_ok=True)
svg_path = "docs/architecture/system-architecture-overview.svg"
png_path = "docs/architecture/system-architecture-overview.png"
root_png_path = "system-architecture-overview.png"
artifact_dir = r"C:\Users\hassa\.gemini\antigravity\brain\f3108404-1fee-452c-a1e2-9de8ad7affb3"
artifact_png_path = os.path.join(artifact_dir, "system-architecture-overview.png")

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
    if os.path.exists(artifact_dir):
        page.screenshot(path=artifact_png_path, full_page=True)
    browser.close()

print(f"Generated high-resolution PNG: {png_path}, {root_png_path}, and {artifact_png_path}")
