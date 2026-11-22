"""
Formal black-and-white system architecture diagram.
Clean, academic, no color, no emoji, no icons. Single arrow style.
Horizontal left-to-right flow.
"""

import os
from playwright.sync_api import sync_playwright

WIDTH = 1920
HEIGHT = 580

svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap');
      text {{ font-family: 'Inter', -apple-system, sans-serif; }}
    </style>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#000" />
    </marker>
  </defs>

  <rect width="{WIDTH}" height="{HEIGHT}" fill="#FFF"/>
  <rect x="1" y="1" width="{WIDTH-2}" height="{HEIGHT-2}" fill="none" stroke="#000" stroke-width="1.5"/>

  <!-- TITLE -->
  <text x="40" y="38" font-size="20px" font-weight="800" fill="#000" letter-spacing="-0.3px">Shiffaa Clinic — System Architecture</text>
  <line x1="40" y1="50" x2="380" y2="50" stroke="#000" stroke-width="2"/>
  <text x="40" y="68" font-size="12px" font-weight="500" fill="#555">Deterministic Healthcare Backend  |  Conversational AI Agent  |  Ambient Clinical Scribe</text>

  <!-- Invariant note top-right -->
  <rect x="1350" y="18" width="530" height="40" fill="none" stroke="#000" stroke-width="1.5"/>
  <text x="1366" y="36" font-size="11px" font-weight="700" fill="#000">Architectural Invariant:</text>
  <text x="1366" y="50" font-size="10.5px" font-weight="400" fill="#000">The LLM has zero direct database access. All mutations via typed REST API tools.</text>

  <!-- ================================================================ -->
  <!-- ROW 1: Main horizontal flow                                      -->
  <!-- Y=110 top, box height=120                                        -->
  <!-- ================================================================ -->

  <!-- Patient -->
  <rect x="40" y="110" width="120" height="120" fill="none" stroke="#000" stroke-width="1.5"/>
  <text x="100" y="162" text-anchor="middle" font-size="13px" font-weight="700" fill="#000">Patient</text>
  <text x="100" y="180" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Text / Voice</text>

  <!-- Arrow -->
  <line x1="160" y1="170" x2="200" y2="170" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>

  <!-- Patient Portal -->
  <rect x="208" y="110" width="150" height="120" fill="none" stroke="#000" stroke-width="1.5"/>
  <text x="283" y="148" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">CLIENT</text>
  <text x="283" y="170" text-anchor="middle" font-size="13px" font-weight="700" fill="#000">Patient Portal</text>
  <text x="283" y="188" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Bilingual Web App</text>

  <!-- Arrow -->
  <line x1="358" y1="170" x2="408" y2="170" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="383" y="163" text-anchor="middle" font-size="9px" font-weight="500" fill="#555">HTTPS</text>

  <!-- Ingress Gateway -->
  <rect x="416" y="110" width="150" height="120" fill="none" stroke="#000" stroke-width="1.5"/>
  <text x="491" y="148" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">GATEWAY</text>
  <text x="491" y="170" text-anchor="middle" font-size="13px" font-weight="700" fill="#000">Caddy Reverse Proxy</text>
  <text x="491" y="188" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">TLS / WSS / Routing</text>

  <!-- Arrow to Voice -->
  <line x1="566" y1="145" x2="620" y2="145" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="593" y="138" text-anchor="middle" font-size="9px" font-weight="500" fill="#555">WSS</text>

  <!-- Arrow to Backend (L-shaped, going down then right) -->
  <path d="M 566 195 L 590 195 L 590 385 L 780 385" fill="none" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="600" y="300" font-size="9px" font-weight="500" fill="#555">REST</text>

  <!-- Voice Gateway -->
  <rect x="628" y="110" width="160" height="70" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="708" y="140" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">VOICE LAYER</text>
  <text x="708" y="158" text-anchor="middle" font-size="12px" font-weight="700" fill="#000">ASR / TTS Engine</text>
  <text x="708" y="174" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Egyptian Arabic Whisper</text>

  <!-- Arrow Voice -> Agent -->
  <line x1="708" y1="180" x2="708" y2="208" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>

  <!-- AI Agent Orchestrator -->
  <rect x="628" y="216" width="160" height="70" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="708" y="244" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">AI ORCHESTRATOR</text>
  <text x="708" y="264" text-anchor="middle" font-size="12px" font-weight="700" fill="#000">LangGraph Agent</text>
  <text x="708" y="280" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Tool-Calling / Guardrails</text>

  <!-- Arrow Agent -> Backend -->
  <line x1="788" y1="251" x2="880" y2="251" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="834" y="244" text-anchor="middle" font-size="9px" font-weight="600" fill="#000">Tool Calls</text>

  <!-- Arrow Agent -> RAG -->
  <line x1="708" y1="286" x2="708" y2="316" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>

  <!-- RAG Knowledge -->
  <rect x="628" y="324" width="160" height="56" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="708" y="348" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">KNOWLEDGE BASE</text>
  <text x="708" y="368" text-anchor="middle" font-size="12px" font-weight="700" fill="#000">RAG Engine</text>

  <!-- ================================================================ -->
  <!-- CLINIC BACKEND (central tall box)                                -->
  <!-- ================================================================ -->
  <rect x="888" y="110" width="280" height="350" fill="none" stroke="#000" stroke-width="2"/>
  <text x="1028" y="138" text-anchor="middle" font-size="12px" font-weight="800" fill="#000" letter-spacing="0.5px">CLINIC BACKEND  [FastAPI]</text>
  <line x1="888" y1="148" x2="1168" y2="148" stroke="#000" stroke-width="1"/>

  <text x="908" y="174" font-size="12px" font-weight="600" fill="#000">Identity and Authentication</text>
  <line x1="908" y1="182" x2="1148" y2="182" stroke="#DDD" stroke-width="0.8"/>

  <text x="908" y="204" font-size="12px" font-weight="600" fill="#000">Doctor Directory and Catalog</text>
  <line x1="908" y1="212" x2="1148" y2="212" stroke="#DDD" stroke-width="0.8"/>

  <text x="908" y="234" font-size="12px" font-weight="600" fill="#000">Availability and Slot Engine</text>
  <line x1="908" y1="242" x2="1148" y2="242" stroke="#DDD" stroke-width="0.8"/>

  <text x="908" y="264" font-size="12px" font-weight="600" fill="#000">Appointment Manager (ACID)</text>
  <line x1="908" y1="272" x2="1148" y2="272" stroke="#DDD" stroke-width="0.8"/>

  <text x="908" y="294" font-size="12px" font-weight="600" fill="#000">EHR and SOAP Record Ingestion</text>
  <line x1="908" y1="302" x2="1148" y2="302" stroke="#DDD" stroke-width="0.8"/>

  <text x="908" y="324" font-size="12px" font-weight="600" fill="#000">WebSocket Broadcast Hub</text>
  <line x1="908" y1="332" x2="1148" y2="332" stroke="#DDD" stroke-width="0.8"/>

  <text x="908" y="354" font-size="12px" font-weight="600" fill="#000">Asynchronous Automation (n8n)</text>

  <!-- Arrow Backend -> DB -->
  <line x1="1168" y1="285" x2="1230" y2="285" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="1199" y="278" text-anchor="middle" font-size="9px" font-weight="600" fill="#000">SQL</text>

  <!-- ================================================================ -->
  <!-- DATABASE                                                         -->
  <!-- ================================================================ -->
  <rect x="1238" y="110" width="220" height="350" fill="none" stroke="#000" stroke-width="2"/>
  <text x="1348" y="138" text-anchor="middle" font-size="12px" font-weight="800" fill="#000" letter-spacing="0.5px">POSTGRESQL 17</text>
  <line x1="1238" y1="148" x2="1458" y2="148" stroke="#000" stroke-width="1"/>

  <text x="1258" y="174" font-size="11.5px" font-weight="500" fill="#000">doctors</text>
  <text x="1258" y="198" font-size="11.5px" font-weight="500" fill="#000">patients</text>
  <text x="1258" y="222" font-size="11.5px" font-weight="500" fill="#000">appointments</text>
  <text x="1258" y="246" font-size="11.5px" font-weight="500" fill="#000">doctor_availability</text>
  <text x="1258" y="270" font-size="11.5px" font-weight="500" fill="#000">medical_records</text>
  <text x="1258" y="294" font-size="11.5px" font-weight="500" fill="#000">support_tickets</text>
  <text x="1258" y="318" font-size="11.5px" font-weight="500" fill="#000">clinic_holidays</text>
  <text x="1258" y="342" font-size="11.5px" font-weight="500" fill="#000">audit_logs</text>

  <!-- Zero-access note at the bottom of DB box -->
  <rect x="1248" y="365" width="200" height="40" fill="none" stroke="#000" stroke-width="1"/>
  <text x="1348" y="382" text-anchor="middle" font-size="10px" font-weight="700" fill="#000">No Direct LLM Access</text>
  <text x="1348" y="398" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Backend-mediated only</text>

  <!-- Vector Store (small) -->
  <rect x="1238" y="480" width="220" height="50" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6,3"/>
  <text x="1348" y="504" text-anchor="middle" font-size="11px" font-weight="700" fill="#000">Vector Store and Config</text>
  <text x="1348" y="520" text-anchor="middle" font-size="10px" font-weight="400" fill="#555">Embeddings / Feature Flags</text>

  <!-- Arrow DB -> Vector -->
  <line x1="1348" y1="460" x2="1348" y2="480" stroke="#000" stroke-width="1.2" marker-end="url(#a)"/>

  <!-- ================================================================ -->
  <!-- ROW 2 (bottom-left): Admin + Scribe                              -->
  <!-- ================================================================ -->

  <!-- Admin Dashboard -->
  <rect x="40" y="290" width="150" height="90" fill="none" stroke="#000" stroke-width="1.5"/>
  <text x="115" y="318" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">STAFF</text>
  <text x="115" y="338" text-anchor="middle" font-size="13px" font-weight="700" fill="#000">Admin Dashboard</text>
  <text x="115" y="356" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Doctor Console</text>

  <!-- Arrow Admin -> Gateway -->
  <path d="M 190 335 L 380 335 L 380 230 L 416 230" fill="none" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>

  <!-- Ambient Clinical Scribe -->
  <rect x="208" y="420" width="225" height="90" fill="none" stroke="#000" stroke-width="2"/>
  <text x="320" y="448" text-anchor="middle" font-size="10px" font-weight="600" fill="#555" letter-spacing="0.5px">AMBIENT CLINICAL INTELLIGENCE</text>
  <text x="320" y="470" text-anchor="middle" font-size="13px" font-weight="700" fill="#000">Clinical Scribe</text>
  <text x="320" y="488" text-anchor="middle" font-size="10px" font-weight="400" fill="#444">Automated SOAP Note Generation</text>

  <!-- Arrow Scribe -> Backend -->
  <path d="M 433 465 L 520 465 L 520 430 L 888 430" fill="none" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="700" y="424" text-anchor="middle" font-size="9px" font-weight="500" fill="#555">SOAP Record Sync</text>

  <!-- ================================================================ -->
  <!-- LEGEND (minimal, bottom strip)                                   -->
  <!-- ================================================================ -->
  <line x1="40" y1="540" x2="1880" y2="540" stroke="#CCC" stroke-width="0.8"/>

  <rect x="40" y="552" width="14" height="14" fill="none" stroke="#000" stroke-width="1.5"/>
  <text x="62" y="564" font-size="10.5px" font-weight="600" fill="#000">Solid</text>
  <text x="88" y="564" font-size="10.5px" font-weight="400" fill="#555">= Implemented</text>

  <rect x="200" y="552" width="14" height="14" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="4,2"/>
  <text x="222" y="564" font-size="10.5px" font-weight="600" fill="#000">Dashed</text>
  <text x="260" y="564" font-size="10.5px" font-weight="400" fill="#555">= Planned</text>

  <line x1="370" y1="559" x2="396" y2="559" stroke="#000" stroke-width="1.5" marker-end="url(#a)"/>
  <text x="404" y="564" font-size="10.5px" font-weight="400" fill="#555">= Data Flow</text>

</svg>
"""

BASE_DIR = r"c:\Users\hassa\Desktop\GraduationProjectClinic"
os.makedirs(os.path.join(BASE_DIR, "docs", "architecture"), exist_ok=True)
svg_path = os.path.join(BASE_DIR, "docs", "architecture", "system-architecture-overview.svg")
png_path = os.path.join(BASE_DIR, "docs", "architecture", "system-architecture-overview.png")
root_png = os.path.join(BASE_DIR, "system-architecture-overview.png")
artifact_dir = r"C:\Users\hassa\.gemini\antigravity\brain\f3108404-1fee-452c-a1e2-9de8ad7affb3"
artifact_png = os.path.join(artifact_dir, "system-architecture-overview.png")

with open(svg_path, "w", encoding="utf-8") as f:
    f.write(svg_content)
print(f"SVG: {svg_path}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=2)
    page = ctx.new_page()
    page.set_content(svg_content)
    page.wait_for_timeout(1000)
    page.screenshot(path=png_path, full_page=True)
    page.screenshot(path=root_png, full_page=True)
    if os.path.exists(artifact_dir):
        page.screenshot(path=artifact_png, full_page=True)
    browser.close()
print("Done.")
