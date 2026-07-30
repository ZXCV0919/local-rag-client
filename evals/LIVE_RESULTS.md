# 真实检索评测结果（小样本）

**评测方式：** 真 Ollama 嵌入（`nomic-embed-text`）+ 关键词重叠 + 线上同款 `rerank` / 相关度门控；可选 LLM 重排（`qwen2.5:7b`）

**日期：** 2026-07-30

**Ollama 地址：** http://127.0.0.1:11434

**固定语料块数：** 5（`evals/fixtures/mini-kb` = 小样本知识库）

**题目数：** 18

## 对比表

| 指标 | RRF（默认） | RRF → LLM 重排 |
|------|-------------|----------------|
| Hit@5（前5命中率） | 100.0% (15/15) | 100.0% (15/15) |
| MRR（平均倒数排名） | 0.889 | 0.889 |
| 拒答精确率 | 100.0% | 100.0% |
| 拒答召回率 | 100.0% | 100.0% |


## 面试怎么讲

- 这是**真嵌入向量**小样本评测，不经过 Tauri/Chroma；关键词腿用词项重叠，用来复现 hybrid 融合逻辑。
- 和 `npm run eval:retrieval`（假向量 / CI 回归）互补：假向量保证改代码不回归；本报告证明真嵌入空间上的 Hit@K。
- 产品默认走 RRF；LLM 列表重排更慢，设置里开关，失败则 fail-open（退回 RRF）。
- 本轮对比中 Hit@5 / MRR 两者持平（小样本已饱和）；价值在于证明「开 LLM 重排不会破坏命中，且可对比延迟/成本」。拒答题用远离产品语料的域外问题，避免假相关。

## 逐题 · RRF

| 题号 | 期望拒答 | 结果 | 排名第一的文件 |
|------|----------|------|----------------|
| ollama-port | 否 | 命中 | ollama-setup.md |
| ollama-embed-model | 否 | 命中 | ollama-setup.md |
| ollama-chat-model | 否 | 命中 | ollama-setup.md |
| hybrid-why | 否 | 命中 | hybrid-retrieval.md |
| hybrid-rrf | 否 | 命中 | hybrid-retrieval.md |
| hybrid-weights | 否 | 命中 | hybrid-retrieval.md |
| hybrid-diversity | 否 | 命中 | chunking-strategy.md |
| sf-boundary | 否 | 命中 | siliconflow-privacy.md |
| sf-key | 否 | 命中 | siliconflow-privacy.md |
| sf-use-case | 否 | 命中 | ollama-setup.md |
| chunk-max | 否 | 命中 | chunking-strategy.md |
| chunk-overlap | 否 | 命中 | chunking-strategy.md |
| chunk-heading | 否 | 命中 | hybrid-retrieval.md |
| chroma-role | 否 | 命中 | chromadb-lifecycle.md |
| chroma-clear | 否 | 命中 | chromadb-lifecycle.md |
| decline-weather | 是 | 拒答正确 | chunking-strategy.md |
| decline-cooking | 是 | 拒答正确 | siliconflow-privacy.md |
| decline-stock | 是 | 拒答正确 | chromadb-lifecycle.md |

## 逐题 · LLM 重排

| 题号 | 期望拒答 | 结果 | 排名第一的文件 |
|------|----------|------|----------------|
| ollama-port | 否 | 命中 | ollama-setup.md |
| ollama-embed-model | 否 | 命中 | ollama-setup.md |
| ollama-chat-model | 否 | 命中 | ollama-setup.md |
| hybrid-why | 否 | 命中 | hybrid-retrieval.md |
| hybrid-rrf | 否 | 命中 | hybrid-retrieval.md |
| hybrid-weights | 否 | 命中 | hybrid-retrieval.md |
| hybrid-diversity | 否 | 命中 | chunking-strategy.md |
| sf-boundary | 否 | 命中 | siliconflow-privacy.md |
| sf-key | 否 | 命中 | siliconflow-privacy.md |
| sf-use-case | 否 | 命中 | ollama-setup.md |
| chunk-max | 否 | 命中 | chunking-strategy.md |
| chunk-overlap | 否 | 命中 | chunking-strategy.md |
| chunk-heading | 否 | 命中 | hybrid-retrieval.md |
| chroma-role | 否 | 命中 | chromadb-lifecycle.md |
| chroma-clear | 否 | 命中 | chromadb-lifecycle.md |
| decline-weather | 是 | 拒答正确 | chunking-strategy.md |
| decline-cooking | 是 | 拒答正确 | siliconflow-privacy.md |
| decline-stock | 是 | 拒答正确 | chromadb-lifecycle.md |


## 如何重跑

```bash
# 需本机 Ollama，并已 pull 模型
ollama pull nomic-embed-text
ollama pull qwen2.5:7b
npm run eval:retrieval:live

# 只跑 RRF（不跑 LLM 重排）
SKIP_LLM_RERANK=1 npm run eval:retrieval:live
```
