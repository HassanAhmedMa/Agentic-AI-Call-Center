# Voice Service (`services/voice`)

Real-time audio processing and streaming service for Agentic Clinic.

## Architecture Status
- **Current Phase:** Phase 0 (Foundation & Contracts)
- **Voice Contract & Provider Abstraction:** [docs/architecture/voice-architecture.md](../../docs/architecture/voice-architecture.md)

## Planned Tech Stack (Phase 1+)
- **Protocols:** WebSockets / WebRTC streaming
- **Providers:** Pluggable `VoiceProvider` supporting Realtime Voice APIs and Cascaded STT-TTS pipelines
- **Acoustic Focus:** Egyptian Arabic (`ar-EG`), Modern Standard Arabic (`ar`), and English (`en-US`)

## Key Invariants
- Audio provider replaceable via standard interface.
- Sub-50ms interruption / barge-in cutoff.
- Zero business logic or direct database access.
