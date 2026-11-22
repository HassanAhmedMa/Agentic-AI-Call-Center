# Voice Architecture Contract & Provider Abstraction

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Voice Layer Architecture & Replaceable Interface  
> **SERVICE:** `services/voice`  
> **PHASE:** Phase 0 Architecture Contract (Do NOT implement in Phase 0)

---

## 1. Objectives & Replaceability Principle

Low conversational latency and natural voice interaction in Arabic and English are paramount. However, voice and speech AI technologies are rapidly evolving.

> 🛡️ **ARCHITECTURAL REQUIREMENT:**  
> The system must **never permanently couple** to a single proprietary voice vendor or fixed pipeline. All voice interactions are mediated via an abstract `VoiceProvider` interface.

---

## 2. Pluggable Architectural Options

During later phases, the engineering team will benchmark two core options:

### Option A: Direct Realtime Voice API
```
User Audio Stream ◄──► [Realtime Voice API (e.g. OpenAI Realtime / Gemini Live)] ◄──► Tool Calling Gateway
```
- **Pros:** Lowest possible turn-taking latency, native handling of inflections and barge-in.
- **Cons:** Higher cost, potential vendor lock-in, varying support for colloquial Egyptian Arabic.

### Option B: Cascaded Pipeline (STT ➔ Agent ➔ TTS)
```
User Audio ──► [STT Provider] ──► Text ──► [AI Agent Orchestration] ──► Text ──► [TTS Provider] ──► User Audio
```
- **Pros:** Full granular control over prompt inspection, modular model swapping, dedicated Arabic phoneme tuning.
- **Cons:** Higher end-to-end latency (compounded network round trips).

---

## 3. The `VoiceProvider` Abstract Interface

All voice implementations must implement this conceptual contract:

```typescript
// Conceptual Interface Definition (TypeScript / Python equivalent)

export interface VoiceSessionConfig {
  sessionId: string;
  sampleRate: number;      // e.g., 16000 or 24000 Hz
  language: string;        // 'en-US' | 'ar-EG' | 'ar-SA' | 'auto'
  voiceId?: string;        // Preferred speaker persona
  enableInterruption: boolean;
}

export interface AudioChunk {
  data: Buffer | Uint8Array;
  timestampMs: number;
  isFinal: boolean;
}

export interface VoiceEvents {
  onSpeechStarted: () => void;
  onSpeechStopped: () => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onInterruptionDetected: () => void;
  onError: (error: Error) => void;
}

export interface VoiceProvider {
  /** Initialize and establish the voice stream session */
  startSession(config: VoiceSessionConfig, callbacks: VoiceEvents): Promise<void>;

  /** Stream inbound audio chunk from client microphone */
  receiveAudio(chunk: AudioChunk): Promise<void>;

  /** Stream synthesized outbound audio to client speaker */
  sendAudio(chunk: AudioChunk): Promise<void>;

  /** Halt current audio output immediately when user speaks over assistant */
  detectInterruption(): Promise<boolean>;

  /** Cleanly tear down audio connection and buffers */
  endSession(sessionId: string): Promise<void>;
}
```

---

## 4. Latency Budgets & Interruption (Barge-in) Guidelines

- **Target End-to-End Latency:** < 1200 ms for cascaded pipeline; < 600 ms for realtime API.
- **Barge-in Support:** When a user interrupts while the system is speaking:
  1. The client-side or server-side VoiceProvider emits `onInterruptionDetected`.
  2. The outgoing audio stream buffer is truncated immediately.
  3. The agent halts playback generation and listens to the user's new turn.


## 5. Browser channel and identity controls (ADR-002 / proposed ADR-003)

- MVP transport is browser Web Audio plus WSS; no PSTN or WebRTC server. Use the cascaded STT→agent→TTS baseline. A provider that sends raw speech directly to an LLM cannot satisfy OTP isolation through transcript redaction; evaluate it separately before enabling it.
- Mobile-first controls: Call/End, transcript, direct email-code box, registration bottom panel, status/resume. Phase 1 includes a minimal text page with those forms; the full voice page follows.
- Browser creates `/api/v1/conversations`. Authenticate WSS in its first control frame over TLS, never a token in the URL. Gateway holds service credentials, binds the socket to that conversation, strips authentication frames before provider/model processing and rejects duplicate live transports. Authenticate and validate browser origin against a configured allowlist; the origin check supplements token authentication.
- Control messages use `{version:1,type,payload}`. Server→page types: `registration_form_requested` (no PII), `verification_state` (state, purpose, expiry only), `proposal_summary` (allowlisted summary), `action_result` (sanitized result), `handoff_status` (unavailable/queued/accepted/connected). Page→gateway types: `ready`, `summary_delivered` (server-issued proposal id), `end`. Audio and caller text are separate frames. Page acknowledgements establish delivery only, never patient identity or affirmative consent.
- `start_registration` emits its control event only to the bound page and returns `form_shown=true` only after page acknowledgement; lack of acknowledgement yields `SERVICE_UNAVAILABLE`. Browser `/registrations` and `/verification/verify` requests go directly to the backend. No code/form control frame is accepted by the gateway.
- During an open challenge, redact digit sequences in Arabic and Latin from transcripts **before** model context, live display or logs. Warn callers to type codes. This is best effort: an STT provider may hear a mistakenly spoken code. Do not persist raw audio, provider transcript/debug dumps or code request bodies. Prefer pausing microphone capture while the code field is focused. Apply the same prohibition to text-chat code entry.
- Gateway polls backend verification; forwards only sanitized state changes and invalidates proposals when binding validity changes. Browser clocks/UI cannot authorize actions. Track liveness; report disconnected/reconnected/ended with service credentials. Preserve a five-minute resume window across mobile app switches. Wake Lock is best effort; reacquire on visibility change where supported.
- Deploy HTTPS before mobile testing; test Android and iPhone over Wi-Fi and 4G, speakerphone/earphones, microphone permissions, app switching for email, reconnect, interruptions and expired sessions. Existing latency figures are targets to benchmark, not proven capabilities.
