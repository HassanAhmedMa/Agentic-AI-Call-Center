# 06 - Component Diagram

This directory contains the UML Component Diagram modeling service decoupling, structural dependencies, interfaces, and the controlled execution barrier.

Rendered with an **opaque solid white canvas** for high-contrast viewing on both dark and light modes.

---

## Diagram Preview

![UML Component Diagram](component-diagram.svg)

---

## Specifications

- **Vector Image:** [`component-diagram.svg`](component-diagram.svg)
- **High-Res PNG:** [`component-diagram.png`](component-diagram.png)
- **Source File:** [`component-diagram.mmd`](component-diagram.mmd)
- **Key Takeaway:** Formally anchors the structural dependencies:
  1. `AI Agent` depends strictly on `Tool Dispatcher`, which communicates with `Clinic Backend` via documented REST APIs.
  2. The LLM has zero direct link to `PostgreSQL`.
  3. `RAG Knowledge Service` is isolated from the transactional database and performs read-only semantic searches.
