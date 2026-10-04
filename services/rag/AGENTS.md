# AGENTS.md - RAG Service Guidelines for AI Coding Agents

> **SERVICE:** `services/rag`  
> **DOMAIN:** Knowledge Retrieval, Vector Search & Clinical Policy Grounding  
> **CONTRACT REFERENCE:** [docs/architecture/rag-contract.md](../../docs/architecture/rag-contract.md)

---

## 1. Service Responsibilities

The RAG service indexes and retrieves verified clinic policies, operational hours, doctor biographies, examination guidelines, and FAQs to supply factual context to the AI Agent.

---

## 2. Inviolable Architectural Rules for AI Agents

1. **READ-ONLY CONTRACT:**
   - The RAG service is strictly read-only.
   - It **NEVER** mutates appointment schedules, patient profiles, or database rows.
2. **NO TRANSACTIONAL AUTHORIZATION:**
   - RAG retrieval results must never be used to bypass authentication or authorize state-altering tools.
3. **GROUNDING WITH CITATIONS:**
   - All retrieved chunks returned by `POST /api/v1/rag/retrieve` must include chunk metadata, source document name, and relevance scores.
4. **VECTOR STORE ABSTRACTION:**
   - All vector interactions must sit behind an abstract vector store interface (allowing swaps between Qdrant, PGVector, Chroma, or mock stores).
5. **ZERO DIRECT RELATIONAL DB ACCESS:**
   - RAG indexes approved document corpora (PDF/Markdown/JSON), not direct relational database tables.

---

## 3. Technology Stack (Phase 1+)

- **Language:** Python 3.11+
- **Embeddings:** Pluggable adapter (OpenAI / Vertex / Sentence Transformers)
- **Vector DB:** Qdrant or PGVector
- **Framework:** FastAPI / LangChain or LlamaIndex retrieval adapters
