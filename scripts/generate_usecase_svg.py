"""
Generates clean, precise black-and-white SVG diagrams for standard UML Use Cases.
Strictly escapes XML entities (&amp;, &lt;, &gt;) to prevent XML parsing errors.
"""
import html
import os

def esc(text):
    return html.escape(str(text))

def generate_stickman(x, y, name, subtext=None):
    svg = []
    # Head
    svg.append(f'<circle cx="{x}" cy="{y}" r="12" fill="#ffffff" stroke="#000000" stroke-width="2"/>')
    # Torso
    svg.append(f'<line x1="{x}" y1="{y+12}" x2="{x}" y2="{y+42}" stroke="#000000" stroke-width="2"/>')
    # Arms
    svg.append(f'<line x1="{x-20}" y1="{y+22}" x2="{x+20}" y2="{y+22}" stroke="#000000" stroke-width="2"/>')
    # Legs
    svg.append(f'<line x1="{x}" y1="{y+42}" x2="{x-16}" y2="{y+70}" stroke="#000000" stroke-width="2"/>')
    svg.append(f'<line x1="{x}" y1="{y+42}" x2="{x+16}" y2="{y+70}" stroke="#000000" stroke-width="2"/>')
    # Label
    svg.append(f'<text x="{x}" y="{y+90}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#000000">{esc(name)}</text>')
    if subtext:
        svg.append(f'<text x="{x}" y="{y+106}" font-family="Arial, Helvetica, sans-serif" font-size="11" text-anchor="middle" fill="#333333">{esc(subtext)}</text>')
    return "\n".join(svg)

def generate_usecase(cx, cy, rx, ry, lines):
    svg = []
    svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>')
    n = len(lines)
    if n == 1:
        svg.append(f'<text x="{cx}" y="{cy+5}" font-family="Arial, Helvetica, sans-serif" font-size="12" text-anchor="middle" fill="#000000">{esc(lines[0])}</text>')
    elif n == 2:
        svg.append(f'<text x="{cx}" y="{cy-3}" font-family="Arial, Helvetica, sans-serif" font-size="12" text-anchor="middle" fill="#000000">{esc(lines[0])}</text>')
        svg.append(f'<text x="{cx}" y="{cy+13}" font-family="Arial, Helvetica, sans-serif" font-size="12" text-anchor="middle" fill="#000000">{esc(lines[1])}</text>')
    elif n == 3:
        svg.append(f'<text x="{cx}" y="{cy-11}" font-family="Arial, Helvetica, sans-serif" font-size="11" text-anchor="middle" fill="#000000">{esc(lines[0])}</text>')
        svg.append(f'<text x="{cx}" y="{cy+3}" font-family="Arial, Helvetica, sans-serif" font-size="11" text-anchor="middle" fill="#000000">{esc(lines[1])}</text>')
        svg.append(f'<text x="{cx}" y="{cy+17}" font-family="Arial, Helvetica, sans-serif" font-size="11" text-anchor="middle" fill="#000000">{esc(lines[2])}</text>')
    return "\n".join(svg)

def build_system_usecase_svg():
    width = 1100
    height = 920
    
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<defs>',
        '  <style>',
        '    .title { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #000000; }',
        '    .edge { stroke: #000000; stroke-width: 1.5; fill: none; }',
        '  </style>',
        '</defs>',
        '<!-- Background -->',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
    ]

    # Boundary Rectangle
    bx, by, bw, bh = 240, 40, 620, 840
    svg.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="#ffffff" stroke="#000000" stroke-width="2"/>')
    svg.append(f'<text x="{bx+bw/2}" y="{by+28}" class="title" text-anchor="middle">Agentic Clinic Operations Boundary (System)</text>')

    # Actors
    # Patient on left
    pat_x, pat_y = 110, 400
    svg.append(generate_stickman(pat_x, pat_y, "Patient / Caller", "(Web & Voice)"))

    # Staff on right
    staff_x, staff_y = 980, 260
    svg.append(generate_stickman(staff_x, staff_y, "Clinic Staff", "(Reception & Care)"))

    # Admin on right bottom
    admin_x, admin_y = 980, 680
    svg.append(generate_stickman(admin_x, admin_y, "Administrator", "(Operations)"))

    # Use Cases inside boundary
    col_a_x = 400
    col_b_x = 700

    usecases_col_a = [
        (col_a_x, 100, 110, 24, ["Find Doctor & Specialty"]),
        (col_a_x, 175, 115, 24, ["Check Doctor Availability"]),
        (col_a_x, 250, 100, 24, ["Book Appointment"]),
        (col_a_x, 325, 100, 24, ["Cancel Appointment"]),
        (col_a_x, 400, 110, 24, ["Reschedule Appointment"]),
        (col_a_x, 480, 120, 25, ["View Patient Appointments", "(History & Details)"]),
        (col_a_x, 560, 125, 25, ["View Service Catalog", "& Pricing Details"]),
        (col_a_x, 640, 105, 24, ["Create Support Ticket"]),
        (col_a_x, 715, 115, 24, ["Track Support Ticket Status"]),
        (col_a_x, 795, 115, 25, ["Request Human Assistance", "(Escalation)"]),
    ]

    usecases_col_b = [
        (col_b_x, 200, 125, 26, ["Answer Escalated Calls", "& Inquiries"]),
        (col_b_x, 330, 125, 26, ["Update & Resolve", "Support Tickets"]),
        (col_b_x, 650, 130, 26, ["Manage Doctor Rosters", "& Clinic Shifts"]),
        (col_b_x, 780, 130, 26, ["Manage Services Catalog", "& Pricing Tables"]),
    ]

    # Draw usecases
    for cx, cy, rx, ry, lines in usecases_col_a:
        svg.append(generate_usecase(cx, cy, rx, ry, lines))

    for cx, cy, rx, ry, lines in usecases_col_b:
        svg.append(generate_usecase(cx, cy, rx, ry, lines))

    # Edges from Patient to Column A
    for cx, cy, rx, ry, _ in usecases_col_a:
        svg.append(f'<line x1="{pat_x+25}" y1="{pat_y+30}" x2="{cx-rx}" y2="{cy}" class="edge"/>')

    # Edges from Staff to Use Cases
    svg.append(f'<line x1="{staff_x-25}" y1="{staff_y+30}" x2="{col_b_x+125}" y2="{200}" class="edge"/>')
    svg.append(f'<line x1="{staff_x-25}" y1="{staff_y+30}" x2="{col_b_x+125}" y2="{330}" class="edge"/>')
    svg.append(f'<line x1="{staff_x-25}" y1="{staff_y+30}" x2="{col_a_x+120}" y2="{480}" class="edge"/>')
    svg.append(f'<line x1="{staff_x-25}" y1="{staff_y+30}" x2="{col_a_x+115}" y2="{175}" class="edge"/>')

    # Edges from Admin
    svg.append(f'<line x1="{admin_x-25}" y1="{admin_y+30}" x2="{col_b_x+130}" y2="{650}" class="edge"/>')
    svg.append(f'<line x1="{admin_x-25}" y1="{admin_y+30}" x2="{col_b_x+130}" y2="{780}" class="edge"/>')

    svg.append('</svg>')
    return "\n".join(svg)

def build_ai_agent_usecase_svg():
    width = 1180
    height = 680

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%">',
        '<defs>',
        '  <style>',
        '    .title { font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; fill: #000000; }',
        '    .edge { stroke: #000000; stroke-width: 1.5; fill: none; }',
        '    .include { stroke: #000000; stroke-width: 1.5; stroke-dasharray: 6,4; fill: none; }',
        '    .annot { font-family: Arial, sans-serif; font-size: 11px; fill: #000000; text-anchor: middle; }',
        '  </style>',
        '  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        '    <path d="M 0 1 L 10 5 L 0 9 z" fill="#000000"/>',
        '  </marker>',
        '  <marker id="open_arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">',
        '    <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="#000000" stroke-width="1.5"/>',
        '  </marker>',
        '</defs>',
        '<!-- Background -->',
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
    ]

    # Actors
    pat_x, pat_y = 90, 240
    svg.append(generate_stickman(pat_x, pat_y, "Patient / Caller", "(Voice / Chat)"))

    staff_x, staff_y = 1090, 480
    svg.append(generate_stickman(staff_x, staff_y, "Clinic Human Staff", "(Escalation Desk)"))

    # Boundary 1: AI Agent
    b1_x, b1_y, b1_w, b1_h = 200, 30, 560, 620
    svg.append(f'<rect x="{b1_x}" y="{b1_y}" width="{b1_w}" height="{b1_h}" fill="#ffffff" stroke="#000000" stroke-width="2"/>')
    svg.append(f'<text x="{b1_x+b1_w/2}" y="{b1_y+26}" class="title" text-anchor="middle">AI Agent Conversational Boundary</text>')

    # Boundary 2: Backend API
    b2_x, b2_y, b2_w, b2_h = 800, 80, 260, 320
    svg.append(f'<rect x="{b2_x}" y="{b2_y}" width="{b2_w}" height="{b2_h}" fill="#ffffff" stroke="#000000" stroke-width="2"/>')
    svg.append(f'<text x="{b2_x+b2_w/2}" y="{b2_y+26}" class="title" text-anchor="middle">Clinic Backend API</text>')

    # Main Use Cases in Agent
    uc_main = (350, 280, 130, 34, ["Engage in Voice / Text Dialogue", "(Arabic / Egyptian / English)"])
    svg.append(generate_usecase(*uc_main))

    # Extended / Included use cases in Agent
    uc_clarify = (350, 100, 120, 28, ["Clarify Intent & Missing Slots", "(Doctor, Specialty, Date)"])
    uc_rag     = (630, 120, 115, 28, ["Query Knowledge (RAG)", "(Policies, Hours, Prep)"])
    uc_tools   = (630, 280, 115, 28, ["Invoke Controlled Tools", "(13 Typed Schemas)"])
    uc_confirm = (630, 420, 120, 30, ["Solicit User Confirmation", "for State Mutations"])
    uc_escalate= (460, 540, 130, 30, ["Escalate via Safety Rules", "(Urgent Indicators / Request)"])

    svg.append(generate_usecase(*uc_clarify))
    svg.append(generate_usecase(*uc_rag))
    svg.append(generate_usecase(*uc_tools))
    svg.append(generate_usecase(*uc_confirm))
    svg.append(generate_usecase(*uc_escalate))

    # Backend Use Cases
    uc_val = (930, 160, 115, 28, ["Validate Slot & Rules", "(Conflict Prevention)"])
    uc_mut = (930, 280, 115, 28, ["Execute Atomic Mutation", "(DB Commit / Lock)"])
    svg.append(generate_usecase(*uc_val))
    svg.append(generate_usecase(*uc_mut))

    # Connections
    svg.append(f'<line x1="{pat_x+25}" y1="{pat_y+30}" x2="{uc_main[0]-uc_main[2]}" y2="{uc_main[1]}" class="edge"/>')

    # Main ..> Clarify <<extend>>
    svg.append(f'<path d="M {uc_main[0]} {uc_main[1]-uc_main[3]} L {uc_clarify[0]} {uc_clarify[1]+uc_clarify[3]}" class="include" marker-end="url(#open_arrow)"/>')
    svg.append(f'<text x="350" y="180" class="annot">&lt;&lt;extend&gt;&gt;</text>')

    # Main ..> RAG <<extend>>
    svg.append(f'<path d="M {uc_main[0]+100} {uc_main[1]-20} L {uc_rag[0]-60} {uc_rag[1]+20}" class="include" marker-end="url(#open_arrow)"/>')
    svg.append(f'<text x="490" y="180" class="annot">&lt;&lt;extend&gt;&gt;</text>')

    # Main ..> Tools <<include>>
    svg.append(f'<path d="M {uc_main[0]+uc_main[2]} {uc_main[1]} L {uc_tools[0]-uc_tools[2]} {uc_tools[1]}" class="include" marker-end="url(#open_arrow)"/>')
    svg.append(f'<text x="495" y="272" class="annot">&lt;&lt;include&gt;&gt;</text>')

    # Main ..> Escalate <<extend>>
    svg.append(f'<path d="M {uc_main[0]+40} {uc_main[1]+uc_main[3]} L {uc_escalate[0]-60} {uc_escalate[1]-uc_escalate[3]}" class="include" marker-end="url(#open_arrow)"/>')
    svg.append(f'<text x="360" y="440" class="annot">&lt;&lt;extend&gt;&gt;</text>')

    # Tools ..> Confirm <<include>>
    svg.append(f'<path d="M {uc_tools[0]} {uc_tools[1]+uc_tools[3]} L {uc_confirm[0]} {uc_confirm[1]-uc_confirm[3]}" class="include" marker-end="url(#open_arrow)"/>')
    svg.append(f'<text x="630" y="360" class="annot">&lt;&lt;include&gt;&gt;</text>')

    # Tools --> Backend Validate
    svg.append(f'<path d="M {uc_tools[0]+uc_tools[2]} {uc_tools[1]-10} L {uc_val[0]-uc_val[2]} {uc_val[1]+10}" class="edge" marker-end="url(#arrow)"/>')

    # Validate --> Mutate
    svg.append(f'<path d="M {uc_val[0]} {uc_val[1]+uc_val[3]} L {uc_mut[0]} {uc_mut[1]-uc_mut[3]}" class="edge" marker-end="url(#arrow)"/>')

    # Escalate -> Staff
    svg.append(f'<line x1="{uc_escalate[0]+uc_escalate[2]}" y1="{uc_escalate[1]}" x2="{staff_x-25}" y2="{staff_y+30}" class="edge"/>')

    svg.append('</svg>')
    return "\n".join(svg)

# Write files
base_path = r"c:\Users\hassa\Desktop\GraduationProjectClinic\docs\diagrams\02-use-cases"
with open(os.path.join(base_path, "use-case-system.svg"), "w", encoding="utf-8") as f:
    f.write(build_system_usecase_svg())

with open(os.path.join(base_path, "use-case-ai-agent.svg"), "w", encoding="utf-8") as f:
    f.write(build_ai_agent_usecase_svg())

print("Clean SVG generation complete with proper XML entity escaping.")
