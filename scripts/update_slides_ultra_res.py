import json
import subprocess
import sys
from pathlib import Path

PRESENTATION_ID = "1oOYFdH4h0Alb7d1BeQ9TR288CkGXRWIGDcZQ5YgJyFw"
REPO_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic")
DIAGRAMS_ROOT = REPO_ROOT / "docs" / "diagrams"

def get_presentation():
    res = subprocess.run(
        ["gslides", "readonly", "info", PRESENTATION_ID, "--json"],
        capture_output=True, encoding="utf-8", errors="replace", shell=True
    )
    return json.loads(res.stdout)

def main():
    pres = get_presentation()
    slides = pres.get("slides", [])
    print(f"Found {len(slides)} slides.")

    # 1. Identify and delete all existing image elements on slides
    delete_ops = []
    slide_map = {}
    for idx, slide in enumerate(slides):
        slide_id = slide["objectId"]
        slide_map[idx + 1] = slide_id
        for el in slide.get("pageElements", []):
            if "image" in el:
                delete_ops.append({"op": "delete-element", "element": el["objectId"]})
    
    if delete_ops:
        print(f"Deleting {len(delete_ops)} old image elements...")
        del_file = REPO_ROOT / "scripts" / "del_images.json"
        del_file.write_text(json.dumps(delete_ops, indent=2), encoding="utf-8")
        subprocess.run(
            ["gslides", "mutate", "batch", PRESENTATION_ID, "-f", str(del_file)],
            shell=True, check=True
        )

    # 2. Fix Slide 11 right card text to ensure zero truncation
    # Let's inspect slide 11 elements
    slide11_id = slide_map[11]
    slide11 = slides[10]
    s11_textboxes = [el["objectId"] for el in slide11.get("pageElements", []) if "shape" in el and el["shape"].get("shapeType") == "TEXT_BOX"]
    print(f"Slide 11 textboxes: {s11_textboxes}")
    
    # We want to update the body textbox of slide 11
    # Typically the last textbox in the slide's elements is the body
    fix_s11_ops = []
    if len(s11_textboxes) >= 2:
        body_id = s11_textboxes[-1]
        fix_s11_ops.append({
            "op": "update-text",
            "element": body_id,
            "text": "• Local Development:\n  Docker Compose spins up FastAPI, AI Agent, Postgres DB, and Mock Voice.\n\n• Zero Flaky Dependencies:\n  Every service runs with mock adapters for offline local testing.\n\n• CI/CD Pipeline:\n  GitHub Actions validates contracts, schemas, and tests on PRs.\n\n• Cloud Production:\n  Stateless containers deployable to AWS / GCP / Azure with managed PostgreSQL."
        })
        fix_s11_ops.append({
            "op": "style-text",
            "element": body_id,
            "font_size": 9.2,
            "font_family": "Roboto",
            "color": "#334155"
        })
        s11_fix_file = REPO_ROOT / "scripts" / "fix_s11.json"
        s11_fix_file.write_text(json.dumps(fix_s11_ops, indent=2), encoding="utf-8")
        subprocess.run(
            ["gslides", "mutate", "batch", PRESENTATION_ID, "-f", str(s11_fix_file)],
            shell=True, check=True
        )
        print("Updated Slide 11 card text to prevent any overflow.")

    # 3. New Ultra-High-Resolution Insertions with exact proportional geometry
    insertions = [
        {
            "slide_num": 3,
            "file": DIAGRAMS_ROOT / "01-system-context" / "context-diagram.png",
            "x": 35, "y": 105, "width": 445, "height": 229,
            "name": "System Context Diagram"
        },
        {
            "slide_num": 4,
            "file": DIAGRAMS_ROOT / "02-use-cases" / "use-case-system.png",
            "x": 35, "y": 82, "width": 395, "height": 305,
            "name": "UML System Use Case (Stickman)"
        },
        {
            "slide_num": 5,
            "file": DIAGRAMS_ROOT / "02-use-cases" / "use-case-ai-agent.png",
            "x": 35, "y": 82, "width": 395, "height": 305,
            "name": "UML AI Agent Use Case (Stickman)"
        },
        {
            "slide_num": 6,
            "file": DIAGRAMS_ROOT / "03-architecture" / "architecture-subsystems.png",
            "x": 35, "y": 82, "width": 295, "height": 305,
            "name": "Subsystems & Component Architecture"
        },
        {
            "slide_num": 7,
            "file": DIAGRAMS_ROOT / "03-architecture" / "ai-agent-workflow.png",
            "x": 45, "y": 82, "width": 220, "height": 305,
            "name": "AI Agent Control Flow"
        },
        {
            "slide_num": 8,
            "file": DIAGRAMS_ROOT / "05-sequence" / "seq-appointment-booking.png",
            "x": 80, "y": 82, "width": 560, "height": 303,
            "name": "UML Sequence: Appointment Booking"
        },
        {
            "slide_num": 9,
            "file": DIAGRAMS_ROOT / "05-sequence" / "seq-human-handoff.png",
            "x": 35, "y": 145, "width": 475, "height": 127,
            "name": "UML Sequence: Human Handoff"
        },
        {
            "slide_num": 10,
            "file": DIAGRAMS_ROOT / "04-data" / "entity-relationship-diagram.png",
            "x": 35, "y": 82, "width": 340, "height": 305,
            "name": "Entity Relationship Diagram (ERD)"
        },
        {
            "slide_num": 11,
            "file": DIAGRAMS_ROOT / "07-deployment" / "deployment-diagram.png",
            "x": 35, "y": 115, "width": 455, "height": 229,
            "name": "Deployment Architecture"
        }
    ]

    for item in insertions:
        slide_id = slide_map[item["slide_num"]]
        print(f"Uploading ultra-res {item['name']} to Slide {item['slide_num']} ({slide_id})...")
        cmd = [
            "gslides", "mutate", "insert-image-from-file", PRESENTATION_ID,
            "--slide", slide_id,
            "--file", str(item["file"]),
            "--x", str(item["x"]),
            "--y", str(item["y"]),
            "--width", str(item["width"]),
            "--height", str(item["height"])
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=True)
        if res.returncode != 0:
            print(f"  [ERROR] {res.stderr}")
        else:
            print(f"  [OK] {res.stdout.strip()}")

    print("All slides updated with ultra-high-resolution diagrams successfully.")

if __name__ == "__main__":
    main()
