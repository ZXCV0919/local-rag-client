# Retrieval eval results (baseline)

**Mode:** offline-fixture: bag-of-words cosine as mock vector + term-overlap keyword; real rerank + relevance-gate

**Date:** 2026-07-30

**Fixture chunks:** 5

| Metric | Value |
|--------|-------|
| Hit@5 | 100.0% (15/15) |
| MRR | 0.967 |
| Decline precision | 100.0% |
| Decline recall | 100.0% |
| Cases | 18 |

## Per-case

| id | expect_decline | status | top_file |
|----|----------------|--------|----------|
| ollama-port | no | HIT | ollama-setup.md |
| ollama-embed-model | no | HIT | ollama-setup.md |
| ollama-chat-model | no | HIT | ollama-setup.md |
| hybrid-why | no | HIT | hybrid-retrieval.md |
| hybrid-rrf | no | HIT | hybrid-retrieval.md |
| hybrid-weights | no | HIT | hybrid-retrieval.md |
| hybrid-diversity | no | HIT | hybrid-retrieval.md |
| sf-boundary | no | HIT | siliconflow-privacy.md |
| sf-key | no | HIT | siliconflow-privacy.md |
| sf-use-case | no | HIT | siliconflow-privacy.md |
| chunk-max | no | HIT | chunking-strategy.md |
| chunk-overlap | no | HIT | chunking-strategy.md |
| chunk-heading | no | HIT | hybrid-retrieval.md |
| chroma-role | no | HIT | chromadb-lifecycle.md |
| chroma-clear | no | HIT | chromadb-lifecycle.md |
| decline-weather | yes | DECLINE_OK | — |
| decline-cooking | yes | DECLINE_OK | — |
| decline-stock | yes | DECLINE_OK | — |

## Notes

- This is an **offline mock-vector** harness for regression / interview demos, not a substitute for production Chroma+Ollama eval.
- Re-run with `npm run eval:retrieval` after changing `rerank` / `relevance-gate`.
