import json
import subprocess
from pathlib import Path

PRESENTATION_ID = "1oOYFdH4h0Alb7d1BeQ9TR288CkGXRWIGDcZQ5YgJyFw"
REPO_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic")

ops = [
    # Slide 6 card text polish
    {
        "op": "update-text",
        "element": "textbox_1791506740608434800_62",
        "text": "1. Voice Layer (`services/voice/`):\n   Audio stream buffer, STT/TTS adapters, and WebSockets gateway.\n\n2. AI Agent (`services/ai-agent/`):\n   Multi-turn conversation state, Arabic intent NLU, tool dispatching.\n\n3. Clinic Backend (`services/clinic-backend/`):\n   Deterministic REST API, appointment slot locks, business rules.\n\n4. RAG Service (`services/rag/`):\n   Semantic search over clinic FAQs, policies, and preparation guides.\n\n5. Relational Database:\n   PostgreSQL 16 ACID transactional persistence & exclusion constraints."
    },
    {
        "op": "style-text",
        "element": "textbox_1791506740608434800_62",
        "font_size": 9.2,
        "font_family": "Roboto",
        "color": "#334155"
    },

    # Slide 7 card text polish
    {
        "op": "update-text",
        "element": "textbox_1791506740608434800_71",
        "text": "• Step 1: Pre-Generation Safety Filter\n  Regex + classifier flags medical emergencies; bypasses LLM to warm handoff.\n\n• Step 2: Context Assembly & Intent Detection\n  Retrieves session history, patient profile, and relevant RAG policy chunks.\n\n• Step 3: Tool Decision & Validation\n  LLM selects tools based on typed Pydantic contracts; parameters validated.\n\n• Step 4: Confirmation Gate for State Changes\n  Mutations (booking, cancellation) require explicit affirmative consent.\n\n• Step 5: Post-Generation Fact Grounding\n  Guarantees medical diagnosis is avoided and responses are strictly grounded."
    },
    {
        "op": "style-text",
        "element": "textbox_1791506740608434800_71",
        "font_size": 9.2,
        "font_family": "Roboto",
        "color": "#334155"
    },

    # Slide 10 card text polish
    {
        "op": "update-text",
        "element": "textbox_1791506740608434800_95",
        "text": "• Core Entities:\n  - `patients`: Demographics, language preference, contact.\n  - `doctors`: Specialty, status, consultation fee, working shifts.\n  - `appointments`: Booking lifecycle status, time slot range, locks.\n  - `support_tickets`: Issue tracking, priority, resolution status.\n  - `audit_logs`: Immutable ledger of all data mutations.\n\n• Integrity & Concurrency Invariants:\n  - PostgreSQL exclusion constraints prevent double bookings.\n  - Optimistic locking (version checks) on appointment updates.\n  - Standard UTC timestamps enforced across all services."
    },
    {
        "op": "style-text",
        "element": "textbox_1791506740608434800_95",
        "font_size": 9.2,
        "font_family": "Roboto",
        "color": "#334155"
    }
]

file_path = REPO_ROOT / "scripts" / "polish_cards.json"
file_path.write_text(json.dumps(ops, indent=2), encoding="utf-8")

subprocess.run(["gslides", "mutate", "batch", PRESENTATION_ID, "-f", str(file_path)], shell=True, check=True)
print("Card typography polish complete.")
