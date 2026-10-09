import json
import subprocess
import sys
from pathlib import Path

PRESENTATION_ID = "1oOYFdH4h0Alb7d1BeQ9TR288CkGXRWIGDcZQ5YgJyFw"
REPO_ROOT = Path(r"c:\Users\hassa\Desktop\GraduationProjectClinic")

def build_batch_ops():
    ops = []

    # 1. Clean Title Slide (slide 'p')
    ops.append({"op": "delete-element", "element": "i0"})
    ops.append({"op": "delete-element", "element": "i1"})
    ops.append({"op": "set-background", "slide": "p", "color": "#0F172A"})
    
    # Title Slide Accents & Text
    ops.append({
        "op": "add-shape", "slide": "p", "shape_type": "RECTANGLE",
        "x": 260, "y": 80, "width": 200, "height": 3,
        "background_color": "#0284C7"
    })
    ops.append({
        "op": "add-textbox", "slide": "p", "text": "AGENTIC CLINIC",
        "x": 50, "y": 100, "width": 620, "height": 65,
        "font_size": 42, "bold": True, "color": "#FFFFFF",
        "font_family": "Roboto", "alignment": "center"
    })
    ops.append({
        "op": "add-textbox", "slide": "p", "text": "System Architecture & Technical Foundation",
        "x": 50, "y": 175, "width": 620, "height": 35,
        "font_size": 20, "color": "#38BDF8",
        "font_family": "Roboto", "alignment": "center"
    })
    ops.append({
        "op": "add-textbox", "slide": "p",
        "text": "Simulated Clinic Customer-Service AI Platform across Realtime Voice & Text\nEnglish • Modern Standard Arabic • Egyptian Arabic",
        "x": 50, "y": 220, "width": 620, "height": 45,
        "font_size": 13, "color": "#94A3B8",
        "font_family": "Roboto", "alignment": "center", "line_spacing": 140
    })
    ops.append({
        "op": "add-shape", "slide": "p", "shape_type": "RECTANGLE",
        "x": 160, "y": 290, "width": 400, "height": 45,
        "background_color": "#1E293B", "outline_color": "#334155", "outline_weight": 1
    })
    ops.append({
        "op": "add-textbox", "slide": "p",
        "text": "Graduation Project 2026-2027  |  Phase 0 Architecture Foundation  |  Team of 5 Engineers",
        "x": 165, "y": 302, "width": 390, "height": 25,
        "font_size": 11, "color": "#CBD5E1",
        "font_family": "Roboto", "alignment": "center"
    })
    ops.append({
        "op": "set-notes", "slide": "p",
        "text": "Welcome to the Phase 0 System Architecture presentation for Agentic Clinic. We are a team of 5 software engineering students presenting the system foundation, contracts, and UML architecture designed for parallel development."
    })

    # =========================================================================
    # Helper to add standard header to content slides
    # =========================================================================
    def add_header(slide_id, title_text, subtitle_text):
        ops.append({
            "op": "add-textbox", "slide": slide_id, "text": title_text,
            "x": 35, "y": 16, "width": 650, "height": 32,
            "font_size": 20, "bold": True, "color": "#0F172A", "font_family": "Roboto"
        })
        ops.append({
            "op": "add-textbox", "slide": slide_id, "text": subtitle_text,
            "x": 35, "y": 48, "width": 650, "height": 18,
            "font_size": 11, "color": "#64748B", "font_family": "Roboto"
        })
        ops.append({
            "op": "add-shape", "slide": slide_id, "shape_type": "RECTANGLE",
            "x": 35, "y": 70, "width": 650, "height": 1.5,
            "background_color": "#E2E8F0"
        })

    # =========================================================================
    # SLIDE 2: Core Architectural Principles
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_2"})
    ops.append({"op": "set-background", "slide": "SLIDE_2", "color": "#F8FAFC"})
    add_header("SLIDE_2", "Architectural Principles & Core Tenets", "Non-negotiable architectural invariants designed for clinical safety and determinism")

    # Card 1: Core Tenet
    ops.append({"op": "add-shape", "slide": "SLIDE_2", "shape_type": "RECTANGLE", "x": 35, "y": 85, "width": 205, "height": 290, "background_color": "#FFFFFF", "outline_color": "#0284C7", "outline_weight": 2})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "THE GOLDEN TENET", "x": 45, "y": 95, "width": 185, "height": 24, "font_size": 13, "bold": True, "color": "#0284C7", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "No Direct DB Access", "x": 45, "y": 120, "width": 185, "height": 24, "font_size": 16, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "• The LLM acts strictly as an orchestrator.\n• Never receives SQL connections, ORM models, or DB credentials.\n• All actions are proposed via explicitly typed, controlled tools.\n• Backend REST APIs validate and execute all state changes.", "x": 45, "y": 150, "width": 185, "height": 215, "font_size": 11, "color": "#334155", "font_family": "Roboto", "line_spacing": 150})

    # Card 2: Deterministic Business Rules
    ops.append({"op": "add-shape", "slide": "SLIDE_2", "shape_type": "RECTANGLE", "x": 255, "y": 85, "width": 205, "height": 290, "background_color": "#FFFFFF", "outline_color": "#0D9488", "outline_weight": 2})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "DETERMINISTIC RULES", "x": 265, "y": 95, "width": 185, "height": 24, "font_size": 13, "bold": True, "color": "#0D9488", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "Backend Enforcement", "x": 265, "y": 120, "width": 185, "height": 24, "font_size": 16, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "• Backend validates all inputs, invariants, time conflicts, and authorization.\n• Never rely on LLM prompts to enforce healthcare rules.\n• Explicit affirmative confirmation is required before any booking or cancellation.\n• Atomic transactions prevent slot double-booking.", "x": 265, "y": 150, "width": 185, "height": 215, "font_size": 11, "color": "#334155", "font_family": "Roboto", "line_spacing": 150})

    # Card 3: RAG & Safety Tripwires
    ops.append({"op": "add-shape", "slide": "SLIDE_2", "shape_type": "RECTANGLE", "x": 475, "y": 85, "width": 205, "height": 290, "background_color": "#FFFFFF", "outline_color": "#6366F1", "outline_weight": 2})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "KNOWLEDGE & SAFETY", "x": 485, "y": 95, "width": 185, "height": 24, "font_size": 13, "bold": True, "color": "#6366F1", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "RAG is Informational Only", "x": 485, "y": 120, "width": 185, "height": 24, "font_size": 16, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_2", "text": "• RAG provides clinic context: operating hours, preparation guidelines, policies.\n• RAG NEVER mutates state or grants clinical authorization.\n• Hardcoded safety tripwires detect emergency keywords immediately.\n• Warm transfer protocol seamlessly escalates callers to human staff.", "x": 485, "y": 150, "width": 185, "height": 215, "font_size": 11, "color": "#334155", "font_family": "Roboto", "line_spacing": 150})

    ops.append({
        "op": "set-notes", "slide": "SLIDE_2",
        "text": "The core architectural principle of the project is strict isolation: the LLM never touches the database. All operations flow through controlled tools, which call validated REST APIs. RAG provides informational context only."
    })

    # =========================================================================
    # SLIDE 3: System Context Diagram
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_3"})
    ops.append({"op": "set-background", "slide": "SLIDE_3", "color": "#FFFFFF"})
    add_header("SLIDE_3", "System Context & External Boundaries", "High-level environment boundaries connecting callers, clinic personnel, and clinic core")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_3", "shape_type": "RECTANGLE", "x": 490, "y": 82, "width": 195, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_3", "text": "Boundary Analysis", "x": 500, "y": 92, "width": 175, "height": 24, "font_size": 14, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_3", "text": "• Patient / Caller:\n  Reaches clinic via phone (WebRTC / SIP) or web chat.\n  Languages: English, Arabic, and Egyptian Arabic.\n\n• Clinic Staff / Personnel:\n  Receives warm-transferred escalations with transcript & context.\n\n• Clinic System Boundary:\n  Encapsulates voice processing, AI orchestration, tools, REST API, RAG, and PostgreSQL.", "x": 500, "y": 122, "width": 175, "height": 255, "font_size": 11, "color": "#334155", "font_family": "Roboto", "line_spacing": 145})
    ops.append({"op": "set-notes", "slide": "SLIDE_3", "text": "The System Context diagram outlines the external actors and interaction channels. Patients interact via voice or text, while human clinic staff handle warm escalations."})

    # =========================================================================
    # SLIDE 4: UML Use Case Diagram - System Operations
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_4"})
    ops.append({"op": "set-background", "slide": "SLIDE_4", "color": "#FFFFFF"})
    add_header("SLIDE_4", "UML Use Case Diagram: Clinic Operations", "Standard UML specification: Stickman actors and operations use case boundary")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_4", "shape_type": "RECTANGLE", "x": 455, "y": 82, "width": 230, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_4", "text": "Operations Summary", "x": 465, "y": 92, "width": 210, "height": 24, "font_size": 14, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_4", "text": "• Primary Actor (Patient):\n  - Find Doctor & Specialty\n  - Check Doctor Availability\n  - Book Appointment\n  - Cancel Appointment\n  - Reschedule Appointment\n  - View Patient Appointments\n  - View Services & Pricing\n  - Create / Track Support Tickets\n  - Request Human Escalation\n\n• Secondary Actors:\n  - Clinic Staff (Escalations & Tickets)\n  - Administrator (Rosters & Services)", "x": 465, "y": 118, "width": 210, "height": 260, "font_size": 10.5, "color": "#334155", "font_family": "Roboto", "line_spacing": 140})
    ops.append({"op": "set-notes", "slide": "SLIDE_4", "text": "This UML Use Case diagram strictly follows standard UML formatting with stickman figures for actors and horizontal ellipses for use cases within the clinic boundary."})

    # =========================================================================
    # SLIDE 5: UML Use Case Diagram - AI Agent Interactions
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_5"})
    ops.append({"op": "set-background", "slide": "SLIDE_5", "color": "#FFFFFF"})
    add_header("SLIDE_5", "UML Use Case Diagram: AI Conversational Agent", "Agent dialogue boundary, controlled tool execution, and deterministic handoff")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_5", "shape_type": "RECTANGLE", "x": 465, "y": 82, "width": 220, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_5", "text": "AI Orchestrator Scope", "x": 475, "y": 92, "width": 200, "height": 24, "font_size": 14, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_5", "text": "• Dialogue Orchestration:\n  Multi-turn Arabic & English conversation with slot clarification.\n\n• Controlled Tool Execution:\n  <<include>> relations to 13 strict tool schemas.\n\n• Explicit Confirmation Gate:\n  <<include>> mandatory user confirmation before state mutations.\n\n• Safety Escalations:\n  <<extend>> warm transfer to Clinic Human Staff on urgent red flags.", "x": 475, "y": 120, "width": 200, "height": 255, "font_size": 10.5, "color": "#334155", "font_family": "Roboto", "line_spacing": 145})
    ops.append({"op": "set-notes", "slide": "SLIDE_5", "text": "The AI Agent use case diagram details conversational boundaries, showing how slot clarification, RAG retrieval, tool execution, and human escalation interact."})

    # =========================================================================
    # SLIDE 6: Subsystem & Component Architecture
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_6"})
    ops.append({"op": "set-background", "slide": "SLIDE_6", "color": "#FFFFFF"})
    add_header("SLIDE_6", "Subsystem & Component Architecture", "Decoupled service boundaries connected exclusively via documented REST & Tool DTOs")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_6", "shape_type": "RECTANGLE", "x": 340, "y": 82, "width": 345, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_6", "text": "Subsystem Responsibilities", "x": 355, "y": 92, "width": 315, "height": 24, "font_size": 14, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_6", "text": "1. Voice Layer (`services/voice/`):\n   Audio streaming gateway, STT/TTS adapters, and WebSockets connection management.\n\n2. AI Agent Orchestrator (`services/ai-agent/`):\n   Multi-turn conversational memory, intent classifier, tool execution engine, and safety tripwires.\n\n3. Clinic Backend (`services/clinic-backend/`):\n   FastAPI REST service enforcing appointments, doctors, schedules, tickets, and slot locks.\n\n4. RAG Knowledge Base (`services/rag/`):\n   Semantic search over clinic FAQs, policies, and preparation procedures.\n\n5. Relational Database:\n   PostgreSQL ACID transactional persistence.", "x": 355, "y": 120, "width": 315, "height": 260, "font_size": 10, "color": "#334155", "font_family": "Roboto", "line_spacing": 140})
    ops.append({"op": "set-notes", "slide": "SLIDE_6", "text": "The subsystem architecture demonstrates the clean separation between services. Each component has an explicit AGENTS.md and typed contract, allowing all 5 team members to develop in parallel."})

    # =========================================================================
    # SLIDE 7: AI Agent Control Flow
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_7"})
    ops.append({"op": "set-background", "slide": "SLIDE_7", "color": "#FFFFFF"})
    add_header("SLIDE_7", "AI Agent Control Flow & State Machine", "Deterministic reasoning loop with safety filters, tool execution, and confirmation gates")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_7", "shape_type": "RECTANGLE", "x": 280, "y": 82, "width": 405, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_7", "text": "Control Loop Pipeline", "x": 295, "y": 92, "width": 375, "height": 24, "font_size": 14, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_7", "text": "• Step 1: Pre-Generation Safety Filter\n  Regex + classifier inspects user input for medical emergencies or red flags.\n  Urgent triggers bypass the LLM and initiate warm human handoff immediately.\n\n• Step 2: Context Assembly & Intent Classification\n  Retrieves session history, patient profile, and relevant RAG policy chunks.\n\n• Step 3: Tool Decision & Schema Validation\n  LLM selects tools based on typed Pydantic contracts; parameters validated.\n\n• Step 4: Confirmation Gate for State Mutations\n  Mutations (booking, cancellation) must receive explicit user approval first.\n\n• Step 5: Post-Generation Grounding & Response\n  Ensures medical diagnosis is avoided and responses are grounded in tool data.", "x": 295, "y": 120, "width": 375, "height": 260, "font_size": 10.5, "color": "#334155", "font_family": "Roboto", "line_spacing": 140})
    ops.append({"op": "set-notes", "slide": "SLIDE_7", "text": "The agent control flow guarantees safe execution. The LLM is constrained by pre/post safety filters and an explicit confirmation step before any booking is committed."})

    # =========================================================================
    # SLIDE 8: UML Sequence Diagram - Appointment Booking
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_8"})
    ops.append({"op": "set-background", "slide": "SLIDE_8", "color": "#FFFFFF"})
    add_header("SLIDE_8", "UML Sequence Diagram: Appointment Booking Flow", "End-to-end multi-turn interaction: Egyptian Arabic speech to atomic PostgreSQL transaction")
    ops.append({"op": "set-notes", "slide": "SLIDE_8", "text": "This standard UML sequence diagram traces the complete appointment booking flow. Notice the lifelines for Patient, Voice Layer, AI Agent Orchestrator, Tool Dispatcher, Clinic Backend API, and PostgreSQL DB. Explicit confirmation is verified before SQL transaction execution."})

    # =========================================================================
    # SLIDE 9: UML Sequence Diagram - Safety Escalation & Human Handoff
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_9"})
    ops.append({"op": "set-background", "slide": "SLIDE_9", "color": "#FFFFFF"})
    add_header("SLIDE_9", "UML Sequence Diagram: Safety Escalation & Warm Handoff", "Deterministic safety tripwires triggering zero-latency transfer to human personnel")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_9", "shape_type": "RECTANGLE", "x": 525, "y": 82, "width": 160, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_9", "text": "Safety Tripwires", "x": 535, "y": 92, "width": 140, "height": 24, "font_size": 13, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_9", "text": "• Urgent Red Flags:\n  Chest pain, severe bleeding, breathing distress.\n\n• Zero-Latency Bypass:\n  Immediate triage advice; bypasses LLM tool loop.\n\n• Warm Transfer Context:\n  Human agent receives full dialogue transcript, patient ID, and urgency summary.", "x": 535, "y": 120, "width": 140, "height": 255, "font_size": 10, "color": "#334155", "font_family": "Roboto", "line_spacing": 145})
    ops.append({"op": "set-notes", "slide": "SLIDE_9", "text": "The safety escalation sequence diagram demonstrates how clinical emergencies are handled. Pre-generation tripwires immediately execute a warm transfer without relying on LLM judgment."})

    # =========================================================================
    # SLIDE 10: Relational Data Model (PostgreSQL)
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_10"})
    ops.append({"op": "set-background", "slide": "SLIDE_10", "color": "#FFFFFF"})
    add_header("SLIDE_10", "Relational Database Schema (PostgreSQL)", "Third normal form (3NF) relational design with exclusion constraints and audit logging")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_10", "shape_type": "RECTANGLE", "x": 380, "y": 82, "width": 305, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_10", "text": "Data Model & Integrity Invariants", "x": 395, "y": 92, "width": 275, "height": 24, "font_size": 13, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_10", "text": "• Core Entities:\n  - `patients`: Demographics, language preference, contact.\n  - `doctors`: Specialty, license, status, consultation fee.\n  - `schedules`: Weekly recurring shifts and exception rules.\n  - `appointments`: Booking status, time range, cancellation reason.\n  - `support_tickets`: Issue tracking, urgency, resolution status.\n  - `audit_logs`: Immutable ledger of all data mutations.\n\n• Concurrency & Consistency:\n  - PostgreSQL exclusion constraints prevent overlapping slots.\n  - Optimistic concurrency control (version checks) on updates.\n  - UTC timestamps used uniformly across all services.", "x": 395, "y": 118, "width": 275, "height": 260, "font_size": 9.8, "color": "#334155", "font_family": "Roboto", "line_spacing": 140})
    ops.append({"op": "set-notes", "slide": "SLIDE_10", "text": "The ERD illustrates our relational data model in PostgreSQL. Database-level exclusion constraints guarantee that no double bookings can occur even under high concurrency."})

    # =========================================================================
    # SLIDE 11: Deployment Topology
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_11"})
    ops.append({"op": "set-background", "slide": "SLIDE_11", "color": "#FFFFFF"})
    add_header("SLIDE_11", "Deployment Architecture & Infrastructure", "Local Docker Compose foundation for 5 developers with direct cloud migration path")
    # Right side card
    ops.append({"op": "add-shape", "slide": "SLIDE_11", "shape_type": "RECTANGLE", "x": 490, "y": 82, "width": 195, "height": 305, "background_color": "#F8FAFC", "outline_color": "#CBD5E1", "outline_weight": 1})
    ops.append({"op": "add-textbox", "slide": "SLIDE_11", "text": "Deployment Strategy", "x": 500, "y": 92, "width": 175, "height": 24, "font_size": 14, "bold": True, "color": "#0F172A", "font_family": "Roboto"})
    ops.append({"op": "add-textbox", "slide": "SLIDE_11", "text": "• Local Development:\n  Single `docker-compose.yml` spins up all 4 micro-services + PostgreSQL DB + Mock Voice adapter.\n\n• Zero Flaky Dependencies:\n  Every service can run with mock adapters for offline local testing.\n\n• CI/CD Pipeline:\n  GitHub Actions runs automated linting, schema validation, and integration tests on pull requests.\n\n• Cloud Production:\n  Stateless containers deployable to AWS / GCP / Azure with managed PostgreSQL.", "x": 500, "y": 120, "width": 175, "height": 255, "font_size": 10, "color": "#334155", "font_family": "Roboto", "line_spacing": 140})
    ops.append({"op": "set-notes", "slide": "SLIDE_11", "text": "The deployment topology balances local simplicity for a 5-student team with a clear cloud production pathway. Docker Compose provides instant reproducible environments."})

    # =========================================================================
    # SLIDE 12: Summary & Phase 1 Implementation Plan
    # =========================================================================
    ops.append({"op": "add-slide", "layout": "BLANK", "id": "SLIDE_12"})
    ops.append({"op": "set-background", "slide": "SLIDE_12", "color": "#0F172A"})
    ops.append({
        "op": "add-textbox", "slide": "SLIDE_12", "text": "Phase 0 Summary & Phase 1 Roadmap",
        "x": 40, "y": 25, "width": 640, "height": 36,
        "font_size": 22, "bold": True, "color": "#FFFFFF", "font_family": "Roboto", "alignment": "center"
    })
    ops.append({
        "op": "add-textbox", "slide": "SLIDE_12", "text": "Phase 0 Foundation Complete — Parallel Engineering Plan for 5 Team Members",
        "x": 40, "y": 62, "width": 640, "height": 22,
        "font_size": 13, "color": "#38BDF8", "font_family": "Roboto", "alignment": "center"
    })

    # 4 Roadmap cards in 2x2 grid
    cards = [
        {"x": 45, "y": 100, "w": 305, "h": 115, "accent": "#0284C7", "title": "Workstream 1: Clinic Backend", "desc": "• Implement FastAPI REST endpoints\n• PostgreSQL migrations & seed data\n• Slot locking & booking conflict validation\n• Lead Workspace: `services/clinic-backend/`"},
        {"x": 370, "y": 100, "w": 305, "h": 115, "accent": "#0D9488", "title": "Workstream 2: AI Agent Orchestrator", "desc": "• Implement multi-turn conversation manager\n• Controlled tool execution & confirmation gate\n• Multilingual NLU (Egyptian Arabic + English)\n• Lead Workspace: `services/ai-agent/`"},
        {"x": 45, "y": 230, "w": 305, "h": 115, "accent": "#6366F1", "title": "Workstream 3: RAG Knowledge Service", "desc": "• Index clinic procedures, FAQs & prep guides\n• Hybrid semantic search & reranking\n• Strict informational-only retrieval adapter\n• Lead Workspace: `services/rag/`"},
        {"x": 370, "y": 230, "w": 305, "h": 115, "accent": "#F59E0B", "title": "Workstream 4: Voice Gateway & Telephony", "desc": "• Audio stream buffer & WebSocket adapter\n• STT/TTS engine interfaces & latency benchmarking\n• Human escalation warm-transfer gateway\n• Lead Workspace: `services/voice/`"}
    ]
    for c in cards:
        ops.append({"op": "add-shape", "slide": "SLIDE_12", "shape_type": "RECTANGLE", "x": c["x"], "y": c["y"], "width": c["w"], "height": c["h"], "background_color": "#1E293B", "outline_color": c["accent"], "outline_weight": 1.5})
        ops.append({"op": "add-textbox", "slide": "SLIDE_12", "text": c["title"], "x": c["x"]+12, "y": c["y"]+8, "width": c["w"]-24, "height": 22, "font_size": 13, "bold": True, "color": "#FFFFFF", "font_family": "Roboto"})
        ops.append({"op": "add-textbox", "slide": "SLIDE_12", "text": c["desc"], "x": c["x"]+12, "y": c["y"]+32, "width": c["w"]-24, "height": 75, "font_size": 9.5, "color": "#CBD5E1", "font_family": "Roboto", "line_spacing": 135})

    ops.append({
        "op": "add-textbox", "slide": "SLIDE_12",
        "text": "Agentic Clinic  •  University Graduation Project  •  Priorities: Reliability > Latency (<1.5s) > Accuracy > Natural Dialogue",
        "x": 50, "y": 365, "width": 620, "height": 20,
        "font_size": 10.5, "color": "#94A3B8", "font_family": "Roboto", "alignment": "center"
    })
    ops.append({
        "op": "set-notes", "slide": "SLIDE_12",
        "text": "With Phase 0 complete, our parallel development matrix enables each student to build their workstream against documented contracts without blocking one another. We are ready for Phase 1 implementation."
    })

    return ops

if __name__ == "__main__":
    ops = build_batch_ops()
    batch_file = REPO_ROOT / "scripts" / "slides_batch.json"
    batch_file.write_text(json.dumps(ops, indent=2), encoding="utf-8")
    print(f"Generated slides_batch.json with {len(ops)} operations.")
