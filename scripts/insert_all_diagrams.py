import subprocess
import sys
from pathlib import Path

PRESENTATION_ID = "1oOYFdH4h0Alb7d1BeQ9TR288CkGXRWIGDcZQ5YgJyFw"
REPO_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic")

insertions = [
    {
        "slide": "slide_1791506740608434800_37",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "02-use-cases" / "use-case-system.png"),
        "x": 35, "y": 82, "width": 405, "height": 305,
        "name": "System Use Case (Stickman)"
    },
    {
        "slide": "slide_1791506740608434800_46",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "02-use-cases" / "use-case-ai-agent.png"),
        "x": 35, "y": 82, "width": 415, "height": 305,
        "name": "AI Agent Use Case (Stickman)"
    },
    {
        "slide": "slide_1791506740608434800_55",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "03-architecture" / "architecture-subsystems.png"),
        "x": 35, "y": 82, "width": 290, "height": 305,
        "name": "Architecture Subsystems"
    },
    {
        "slide": "slide_1791506740608434800_64",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "03-architecture" / "ai-agent-workflow.png"),
        "x": 35, "y": 82, "width": 230, "height": 305,
        "name": "AI Agent Workflow"
    },
    {
        "slide": "slide_1791506740608434800_73",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "05-sequence" / "seq-appointment-booking.png"),
        "x": 35, "y": 82, "width": 650, "height": 305,
        "name": "Sequence: Appointment Booking"
    },
    {
        "slide": "slide_1791506740608434800_79",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "05-sequence" / "seq-human-handoff.png"),
        "x": 35, "y": 82, "width": 475, "height": 305,
        "name": "Sequence: Human Handoff"
    },
    {
        "slide": "slide_1791506740608434800_88",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "04-data" / "entity-relationship-diagram.png"),
        "x": 35, "y": 82, "width": 330, "height": 305,
        "name": "Entity Relationship Diagram (ERD)"
    },
    {
        "slide": "slide_1791506740608434800_97",
        "file": str(REPO_ROOT / "docs" / "diagrams" / "07-deployment" / "deployment-diagram.png"),
        "x": 35, "y": 82, "width": 440, "height": 305,
        "name": "Deployment Diagram"
    }
]

def run():
    for item in insertions:
        print(f"Inserting {item['name']} into slide {item['slide']}...")
        cmd = [
            "gslides", "mutate", "insert-image-from-file", PRESENTATION_ID,
            "--slide", item["slide"],
            "--file", item["file"],
            "--x", str(item["x"]),
            "--y", str(item["y"]),
            "--width", str(item["width"]),
            "--height", str(item["height"])
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        if res.returncode != 0:
            print(f"  [ERROR] {res.stderr}")
        else:
            print(f"  [OK] {res.stdout.strip()}")

if __name__ == "__main__":
    run()
