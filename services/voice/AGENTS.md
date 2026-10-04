# AGENTS.md - Voice Layer Guidelines for AI Coding Agents

> **SERVICE:** `services/voice`  
> **DOMAIN:** Real-time Audio Streaming, STT, TTS, Interruption Detection & Telephony  
> **CONTRACT REFERENCE:** [docs/architecture/voice-architecture.md](../../docs/architecture/voice-architecture.md)

---

## 1. Service Responsibilities

The Voice service is responsible for real-time bidirectional audio transport between the patient and the AI Agent.
- Manages audio streaming via WebSockets / WebRTC.
- Converts inbound speech to text (STT) and outbound responses to audio (TTS).
- Detects user interruption (barge-in) and immediately cuts off playback.
- Supports Egyptian Arabic and English acoustic models.

---

## 2. Inviolable Architectural Rules for AI Agents

1. **REPLACEABLE PROVIDER PATTERN:**
   - **Never hardcode vendor-specific SDK logic into core transport classes.**
   - All voice providers must implement the abstract `VoiceProvider` interface defined in `docs/architecture/voice-architecture.md`.
2. **NO DIRECT DB ACCESS OR CLINIC BUSINESS LOGIC:**
   - The voice service is purely an audio gateway. It does not decide medical logic, inspect database records, or book appointments.
3. **IMMEDIATE BARGE-IN RESPONSE:**
   - When caller speech is detected while outbound audio is playing, the service must emit an interruption event and halt transmission in < 50ms.
4. **LATENCY OPTIMIZATION:**
   - Avoid buffering full audio files. Process and stream chunked PCM/Opus frames.

---

## 3. Technology Stack (Phase 1+)

- **Language:** Python 3.11+ or Node.js / TypeScript (FastAPI / WebSockets)
- **Protocols:** WebSockets / WebRTC
- **Audio Standards:** Linear PCM 16kHz / 24kHz, 16-bit mono
