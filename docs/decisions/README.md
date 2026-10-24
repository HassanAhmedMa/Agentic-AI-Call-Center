# Architectural Decision Records (ADRs)

> **PROJECT:** Agentic Clinic  
> **DIRECTORY:** `docs/decisions/`

---

## 1. What is an ADR?
An Architectural Decision Record (ADR) captures an important architectural decision made along with its context and consequences.

## 2. When Must an ADR be Written?
An ADR is **mandatory** whenever a proposed change significantly affects:
1. **Architecture & Service Boundaries:** Splitting or merging services.
2. **Infrastructure & Hosting:** Changing databases, message queues, or container orchestration.
3. **AI Model Strategy:** Choosing or altering the LLM orchestration framework, base models, or prompting paradigms.
4. **Voice Provider Strategy:** Deciding between Realtime Voice API vs. Cascaded STT-TTS pipelines.
5. **Database Strategy:** Selecting or changing relational databases, ORMs, or caching layers.
6. **Authentication & Authorization:** Choosing authentication mechanisms (e.g. JWT vs. session cookies, patient identity verification).
7. **Major External Dependencies:** Adding frameworks or libraries that influence multiple services.

## 3. ADR Lifecycle & Template
All ADRs follow the standard format:
- **Title:** `ADR-XXX-<short-title>.md`
- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Context:** What is the problem or opportunity?
- **Decision:** What are we doing?
- **Consequences:** Positive, negative, and neutral trade-offs.

## 4. Current ADR Index
| ADR | Title | Status | Date |
| :--- | :--- | :--- | :--- |
| [ADR-001](ADR-001-monorepo.md) | Adoption of a Modular Monorepo Architecture | Accepted | 2026-10-04 |
| [ADR-002](ADR-002-technology-candidates-and-scope-simplification.md) | Technology Candidates, Scope Simplification & Feasibility | Accepted | 2026-10-05 |
| [ADR-003](ADR-003-patient-identity-booking-rules-and-channel.md) | Patient Identity Verification, Booking Rules, Bilingual Catalog & Browser Call Channel | Proposed | 2026-10-09 |

| [ADR-005](ADR-005-patient-portal-password-auth.md) | Patient portal password authentication | Accepted | 2026-10-17 |
