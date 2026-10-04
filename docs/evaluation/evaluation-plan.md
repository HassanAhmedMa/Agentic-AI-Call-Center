# AI Agent Evaluation & Benchmarking Plan

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Continuous Quality & Accuracy Evaluation Strategy  
> **PHASE:** Phase 0 Architecture Blueprint

---

## 1. Evaluation Objectives

In a clinical customer-service setting, the conversational agent must deliver:
1. **Clinical Safety:** 100% adherence to guardrails (never diagnose, never invent doctor availability, immediately transfer emergencies).
2. **Deterministic Tool Invocation:** The exact appropriate tool must be selected with precise slot arguments extracted from natural conversation.
3. **Multilingual Robustness:** Accurate intent and entity extraction across Egyptian Arabic dialect, Modern Standard Arabic (MSA), and English.
4. **Low Latency:** Fast time-to-first-token and voice response turnaround (< 1200ms end-to-end).

---

## 2. Evaluation Methodology

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│ Synthetic Dialogue     │ ───► │ Automated Offline Eval │ ───► │ Quality Scorecard      │
│ Benchmark Dataset      │      │ (LLM-as-a-Judge + Code)│      │ & Regression Alerting  │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

### Evaluation Layers:
1. **Deterministic Assertion Suite:**
   - Evaluates slot extraction, date normalization (e.g. converting "بكرة بعد الضهر" to the correct timestamp), and tool invocation JSON schemas.
2. **LLM-as-a-Judge Evaluation:**
   - Evaluates conversational naturalness, empathy, dialectal fluency, and politeness.
3. **Safety & Guardrail Red-Teaming:**
   - Adversarial prompts attempting prompt injection, requesting medical diagnoses, or trying to bypass booking validation.

---

## 3. Key Performance Indicators (KPIs)

| Metric | Target Threshold | Measured By |
| :--- | :--- | :--- |
| **Tool Selection Accuracy** | $\ge 98\%$ | Offline benchmark dataset |
| **Date/Time Extraction Accuracy** | $\ge 95\%$ | Arabic & English test transcripts |
| **Emergency Escalation Recall** | $100\%$ | Red-team safety test cases |
| **RAG Hallucination Rate** | $\le 1\%$ | Faithfulness eval against retrieved chunks |
| **P95 Conversational Latency** | $< 1200$ ms | Voice pipeline profiling |
