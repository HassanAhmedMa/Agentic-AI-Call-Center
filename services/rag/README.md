# RAG Service (`services/rag`)

Retrieval-Augmented Generation (RAG) knowledge retrieval service for Agentic Clinic.

## Architecture Status
- **Current Phase:** Phase 0 (Foundation & Contracts)
- **RAG Contract:** [docs/architecture/rag-contract.md](../../docs/architecture/rag-contract.md)

## Planned Tech Stack (Phase 1+)
- **Language:** Python 3.11+
- **Vector Store:** Qdrant / PGVector (behind pluggable adapter)
- **Embeddings:** Pluggable adapter interface

## Invariants
- Strictly read-only informational context.
- Never performs mutations, appointment bookings, or transactional queries.
