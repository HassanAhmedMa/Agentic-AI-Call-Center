# LLM & Conversation Evaluation Suites (`tests/evaluation`)

Automated evaluation benchmarks measuring model accuracy, hallucination rate, and dialectal robustness.

## Metrics Evaluated
- **Intent & Slot Extraction Accuracy:** Precision/Recall on dates, doctors, and specialties.
- **Dialectal Understanding:** Performance on Egyptian colloquial Arabic expressions.
- **RAG Faithfulness:** Verified absence of hallucinated policies or nonexistent fees.
- **Safety Compliance:** 100% adherence to clinical emergency handoff rules.

See [docs/evaluation/evaluation-plan.md](../../docs/evaluation/evaluation-plan.md) and [docs/evaluation/benchmark-categories.md](../../docs/evaluation/benchmark-categories.md).
