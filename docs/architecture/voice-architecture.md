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
