# RAG & Knowledge Retrieval Contract

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Retrieval-Augmented Generation (RAG) Contract  
> **SERVICE:** `services/rag`  
> **PHASE:** Phase 0 Architecture Contract (Do NOT implement in Phase 0)

---

## 1. Scope & Purpose

The RAG subsystem provides **retrieval-augmented grounding** for the conversational agent. Its sole purpose is to retrieve accurate, verified, non-transactional clinic knowledge to prevent hallucinations during patient dialogues.

### Approved Informational Domains:
- Clinic operating hours, emergency hours, and holiday schedules.
- Cancellation and refund policies.
- Clinic location, directions, parking, and building access.
- Descriptions of medical tests, examinations, and diagnostic procedures.
- Patient preparation instructions (e.g. fasting guidelines before blood tests).
- Accepted health insurance networks and copay guidelines.
- Doctor biographies, qualifications, and areas of clinical expertise.
- General clinic FAQs.

---

## 2. Strict Negative Boundaries (What RAG Must NEVER Do)

> 🚫 **CRITICAL INVARIANTS:**
> - RAG must **NEVER** create, update, or cancel appointments.
> - RAG must **NEVER** authenticate or authorize patients.
> - RAG must **NEVER** directly query or modify the relational PostgreSQL database.
> - RAG must **NEVER** make clinical diagnoses or prescribe medication.
> - RAG must **NEVER** return confidential patient records or PII.

---

## 3. RAG Retrieval Interface Contract

When the AI Agent orchestrator determines a user question is informational, it calls the internal RAG retrieval endpoint:

### Request Contract
- **Endpoint:** `POST /api/v1/rag/retrieve`
- **Payload:**
  ```json
  {
    "query": "What are your cancellation policies for Saturday visits?",
    "language": "en",
    "top_k": 3,
    "filter_category": "policies"
  }
  ```

### Response Contract
- **Response Status:** `200 OK`
- **Payload:**
  ```json
  {
    "query": "What are your cancellation policies for Saturday visits?",
    "retrieved_chunks": [
      {
        "chunk_id": "doc_pol_012_chunk_03",
        "title": "General Appointment Cancellation Policy",
        "content": "Appointments cancelled at least 4 hours before the scheduled time incur no cancellation fee. Saturday clinics follow standard weekday cancellation terms.",
        "score": 0.892,
        "metadata": {
          "source_document": "clinic_policies_2026.pdf",
          "category": "policies",
          "last_reviewed": "2026-09-01"
        }
      }
    ],
    "context_summary": "Appointments can be cancelled without fee up to 4 hours in advance.",
    "execution_time_ms": 42
  }
  ```

---

## 4. Vector Store & Embedding Abstraction

The RAG layer must sit behind a clean adapter interface:
- **Embedding Provider Abstraction:** Allows swapping between OpenAI embeddings, Google Vertex embeddings, or local HuggingFace sentence transformers.
- **Vector Database Abstraction:** Allows swapping between Qdrant, Chroma, PGVector, or in-memory mock search.
