# 07 - Deployment Diagram

This directory contains the conceptual deployment topology for **Agentic Clinic**.

Rendered with an **opaque solid white canvas** for high-contrast viewing on both dark and light modes.

---

## Diagram Preview

![Conceptual Deployment Diagram](deployment-diagram.svg)

---

## Specifications

- **Vector Image:** [`deployment-diagram.svg`](deployment-diagram.svg)
- **High-Res PNG:** [`deployment-diagram.png`](deployment-diagram.png)
- **Source File:** [`deployment-diagram.mmd`](deployment-diagram.mmd)
- **Feasibility Rationale:** Per [ADR-002](../../decisions/ADR-002-technology-candidates-and-scope-simplification.md), this topology avoids multi-cloud Kubernetes clusters and telecom PBX hardware. All micro-services run cleanly within a single Docker Compose network on a developer laptop or a simple cloud Linux virtual machine.
