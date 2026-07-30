# Phase 9 · 秋招面试硬化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按秋招评估的 P0→P1→P2 路线，补齐测试/评测/文档防护网，再增强可选重排与 Worker，最后做 Key 代理与 CI 硬化。

**Architecture:** 不改动现有 RAG 主路径默认行为；以「可开关 / 可评测 / 可回归」方式叠加能力。短板级方案详见 `docs/superpowers/specs/2026-07-31-shortcomings-solutions.md`。

**Tech Stack:** Vitest、现有 TS retrieval/chunker/llm 模块、可选 LLM rerank、Web Worker、Tauri Rust 代理、GitHub Actions。

## Global Constraints

- 默认检索/生成行为与 v1.0 保持一致（新能力默认关闭或旁路）
- 评测与单测不得依赖真实 SiliconFlow 网络（可用 mock）
- 不引入与秋招无关的大规模重构（不换向量库、不重写 parser 到 Rust）
- 用户可见文案保持中文产品语气

---

## File map（预期新增/修改）

| 路径 | 职责 |
|------|------|
| `package.json` | `test` / `eval:retrieval` scripts；vitest 依赖 |
| `vitest.config.ts` | 测试配置 |
| `src/services/retrieval/*.test.ts` 等 | 核心单测 |
| `evals/golden.json` | 评测问答 |
| `evals/fixtures/**` | 迷你语料 |
| `evals/run-retrieval-eval.ts` | 离线评测入口 |
| `evals/RESULTS.md` | 基线结果（可提交） |
| `README.md` | 产品级说明 |
| `docs/ops/troubleshooting.md` | 依赖排障 |
| `src/services/retrieval/llm-rerank.ts` | 可选 LLM 重排（P1） |
| `src/types/settings.ts` + 设置 UI | `rerank_mode`（P1） |
| `src/services/importer/*` + worker | 解析分块进 Worker（P1） |
| `src-tauri/src/commands/*` + settings | Key 掩码与流式代理（P2） |
| `.github/workflows/ci.yml` | lint/test/build（P2，P0 可先本地 script） |

---

## P0 · 面试防护网（建议 1–2 周）

### Task A: Vitest 核心单测

**Files:**
- Create: `vitest.config.ts`
- Create: `src/services/retrieval/reranker.test.ts`
- Create: `src/services/retrieval/relevance-gate.test.ts`
- Create: `src/utils/citations.test.ts`
- Create: `src/services/chunker/overlap.test.ts`（或 heading 边界测）
- Create: `src/services/llm/context-window.test.ts`
- Modify: `package.json`（`vitest`、`npm run test`）

- [ ] **Step 1:** 安装 vitest，配置 `environment: 'node'`，path alias 与 `vite.config` 对齐

- [ ] **Step 2:** 为 `shouldDeclineAnswerDueToWeakEvidence` 写失败用例（空结果应拒；semantic 低分应拒；hybrid 弱向量+零关键词应拒；强证据不拒）

- [ ] **Step 3:** 实现/确认门控已满足用例，跑通 `npx vitest run src/services/retrieval/relevance-gate.test.ts`

- [ ] **Step 4:** 为 `rerank` 写用例：仅向量、仅关键词、双路融合顺序、文档多样性上限不被单一 doc 占满

- [ ] **Step 5:** 为 citation 解析写用例：合法 `[文件#1]`、缺序号、多引用

- [ ] **Step 6:** 为 overlap / context-window 各补 2–3 个边界用例

- [ ] **Step 7:** `npm test` 全绿；在 README 增加「运行测试」一节

- [ ] **Step 8:** Commit `test: add vitest coverage for retrieval gate, rerank, citations`

---

### Task B: Golden Q&A + 检索评测脚本

**Files:**
- Create: `evals/fixtures/mini-kb/*.md`（3–5 篇短文，主题可区分）
- Create: `evals/golden.json`
- Create: `evals/run-retrieval-eval.ts`
- Create: `evals/RESULTS.md`
- Modify: `package.json`（`eval:retrieval`）

- [ ] **Step 1:** 写 3–5 篇短 Markdown，人工记下关键句所在「逻辑 chunk」标记（可先用固定 chunker 跑一遍生成 id 映射）

- [ ] **Step 2:** 编写 `golden.json` ≥15 条：含 `query`、`relevant_ids` 或 `must_contain`、`expect_decline`

- [ ] **Step 3:** 实现评测脚本：对每个 query 调现有 `retrieve`（或可注入的纯函数路径）；若全链路依赖 Chroma，则允许「fixture 内存向量 + FTS mock」模式，并在 RESULTS 注明模式

- [ ] **Step 4:** 输出 Hit@5、MRR、decline precision/recall（简易即可）到 stdout + 写入 `RESULTS.md` 表格

- [ ] **Step 5:** 固定一次基线数字提交仓库

- [ ] **Step 6:** Commit `feat(evals): add golden set and retrieval Hit@K harness`

**面试交付物:** `evals/RESULTS.md` 可直接投屏。

---

### Task C: 重写根 README

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/README.md`（索引补 phase8/9 与本 spec）

- [ ] **Step 1:** 用产品概述替换模板（功能、技术栈、截图占位）

- [ ] **Step 2:** 写清依赖：Node、Rust、WebView2、Ollama、Chroma/Python

- [ ] **Step 3:** 开发 / 测试 / 评测 / 打包命令各一小节

- [ ] **Step 4:** 链到设计文档与排障文档；标明 `release/v1.0.0` 安装包

- [ ] **Step 5:** Commit `docs: rewrite README for v1.0 product and interview narrative`

---

### Task D: 依赖检测体验 + 排障文档

**Files:**
- Create: `docs/ops/troubleshooting.md`
- Modify: `src/components/settings/OllamaStatus.tsx`（或首启引导组件）— 强化不可达文案与下一步
- Modify: Chroma 状态展示处（若已有命令 `chromadb` health，复用）

- [ ] **Step 1:** 列出 Top5 故障：Ollama 未起、模型未 pull、Chroma 端口占用、嵌入模型不匹配、知识库无 ready 文档

- [ ] **Step 2:** 写入 `troubleshooting.md`，每条：现象 → 原因 → 命令/点击路径

- [ ] **Step 3:** 设置页在 Ollama/Chroma 失败时展示链到上述文档的要点（3 行内）

- [ ] **Step 4:** 写一页「演示前 Checklist」放进 README 或 `docs/ops/demo-checklist.md`

- [ ] **Step 5:** Commit `docs(ops): add troubleshooting and stronger dependency status copy`

---

## P1 · 深度加分（建议再 2–3 周）

### Task E: 可选 LLM 重排 + 评测对比

**Files:**
- Create: `src/services/retrieval/llm-rerank.ts`
- Modify: `src/services/retrieval/index.ts`（RRF 后可选第二阶段）
- Modify: `src/types/settings.ts`、`src/store/settings.ts`、`RetrievalSettings.tsx`
- Modify: `evals/run-retrieval-eval.ts`、`evals/RESULTS.md`

- [ ] **Step 1:** 增加设置 `rerank_mode: 'rrf' | 'llm'`，默认 `'rrf'`

- [ ] **Step 2:** 实现 `llmRerank(candidates, query)`：严格 JSON schema；失败回退原序

- [ ] **Step 3:** 接入 retrieve 流水线，仅当 mode=llm 且候选 >K 时触发

- [ ] **Step 4:** 单测：mock chat 返回乱序 id → 输出顺序正确；非法 JSON → 回退

- [ ] **Step 5:** 评测对比 RRF vs LLM，更新 RESULTS 表

- [ ] **Step 6:** Commit `feat(retrieval): optional LLM listwise rerank behind settings flag`

---

### Task F: 解析/分块 Web Worker

**Files:**
- Create: `src/services/importer/parse-chunk.worker.ts`
- Modify: `src/services/importer/index.ts`
- Modify: 进度事件类型（若需要）

- [ ] **Step 1:** 定义 worker 消息：`{ type: 'parse-chunk', payload }` / `{ type: 'progress' }` / `{ type: 'done' }` / `{ type: 'error' }`

- [ ] **Step 2:** 将 parser+chunker 调用迁入 worker；主线程订阅进度

- [ ] **Step 3:** 用大 PDF 手工验证 UI 可响应

- [ ] **Step 4:** Commit `perf(importer): move parse and chunk off UI thread via worker`

---

## P2 · 工程硬化（有余力）

### Task G: SiliconFlow Key 下沉 Rust 代理

**Files:**
- Modify: `src-tauri/src/commands/settings.rs` / `chat.rs`（新增代理）
- Modify: `src/services/llm/chat-provider.ts`、`openai-stream-handler.ts`
- Modify: `ChatProviderSettings.tsx`（掩码展示）

- [ ] **Step 1:** 设置读写改为「只存 Rust / 只回掩码」

- [ ] **Step 2:** Rust 侧发起上游流式请求，经 Tauri event 推 token

- [ ] **Step 3:** 前端去掉 Bearer；验证取消流仍工作

- [ ] **Step 4:** Commit `security: proxy SiliconFlow chat via Rust and mask API key in UI`

---

### Task H: CI + 演示资产

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/ops/demo-script.md`（或链到已有 checklist）
- Optional: 演示视频放到仓库外网盘，README 只放链接

- [ ] **Step 1:** CI：`npm ci` → `npm test` → `npm run build`（不做 tauri bundle）

- [ ] **Step 2:** 写 1–2 分钟演示脚本：导入 → 检索工作台 → 拒答 case → 正常引用回答

- [ ] **Step 3:** Commit `ci: add frontend test and build workflow`

---

## 执行顺序与依赖

```
P0-A 单测 ────────────────┐
P0-B 评测 ────────────────┼──► 面试可讲「可回归 + 有数字」
P0-C README ──────────────┤
P0-D 排障 ────────────────┘
         │
         ▼
P1-E LLM 重排（依赖 B 的对比数字更有说服力）
P1-F Worker（可与 E 并行）
         │
         ▼
P2-G Key 代理
P2-H CI / 演示脚本
```

## 完成定义（Definition of Done）

- [ ] P0 全部 Task 完成，本地 `npm test` 与 `npm run eval:retrieval` 可跑
- [ ] README 非模板，含依赖与演示 checklist
- [ ] （目标）P1 至少完成 E 或 F 之一，并有评测/录屏证据
- [ ] 面试口述稿能按评估建议的 30 秒 + 3–4 分钟结构讲完，并主动点出剩余短板

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 全链路 retrieve 难在 CI 跑 | 评测提供 fixture/mock 模式，RESULTS 标明 |
| LLM 重排不稳定 | fail-open + 默认关闭 |
| Worker 与 pdf.js worker 冲突 | 先迁 txt/md/docx，PDF 保持现有 worker 边界 |
| Rust 代理流式复杂 | P2 单独开；不阻塞 P0 面试档期 |
