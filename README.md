# 本地知识库

基于 RAG 的 **本地文档知识库桌面客户端**（Tauri 2 + React + Rust）。支持多格式导入、智能分块、向量检索与带引用的对话问答；嵌入默认走本机 Ollama，生成可选 Ollama 或 SiliconFlow。

当前版本：**1.0.0**（Windows x64 安装包见 `release/v1.0.0/`）

## 功能概览

- 多知识库隔离管理
- PDF / Markdown / TXT / DOCX 导入，解析 → 分块 → 向量化 → 写入 ChromaDB
- 混合检索：Chroma 向量 + SQLite FTS5 关键词 + 加权 RRF 重排
- 弱证据拒答、强制引用格式、可选回答 groundedness 自检
- 检索工作台与分块预览（便于排查「搜错了」还是「答错了」）
- 设置：外观、Ollama、SiliconFlow、切分/检索参数、数据导出与清理

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri 2 |
| 前端 | React 19、TypeScript、Vite 7、Zustand、Tailwind 4 |
| 后端 | Rust、Diesel、SQLite（含 FTS5） |
| 向量 | ChromaDB（本机进程） |
| 模型 | Ollama（嵌入 + 可选对话）；SiliconFlow（可选对话） |

## 环境依赖

| 依赖 | 说明 |
|------|------|
| Node.js 20+ | 前端开发与打包 |
| Rust（stable） | Tauri 后端编译 |
| WebView2 | Windows 运行时（Win10/11 通常已自带） |
| [Ollama](https://ollama.com) | 默认 `http://127.0.0.1:11434`；需拉取嵌入模型（默认 `nomic-embed-text`） |
| ChromaDB | 本机 Python/`chromadb` 或可用服务；应用可尝试自动启动 |

排障见 [`docs/ops/troubleshooting.md`](docs/ops/troubleshooting.md)。

## 快速开始（开发）

```bash
npm install
npm run tauri dev
```

仅前端（无原生能力）：

```bash
npm run dev
```

## 测试与评测

```bash
# 核心纯函数单测（门控 / 重排 / 引用 / 切分 overlap / 上下文预算 / LLM 重排 fail-open）
npm test

# 离线检索评测（不依赖 Ollama/Chroma；mock 向量 + 真实 rerank/gate）
npm run eval:retrieval

# 真嵌入小样本评测（需本机 Ollama；可对比 RRF vs LLM 重排）
npm run eval:retrieval:live
```

基线结果：

- 离线：[`evals/RESULTS.md`](evals/RESULTS.md)
- Live：[`evals/LIVE_RESULTS.md`](evals/LIVE_RESULTS.md)（跑过 live 后生成）

技术取舍（面试一页纸）：[`docs/superpowers/specs/2026-07-31-technical-tradeoffs.md`](docs/superpowers/specs/2026-07-31-technical-tradeoffs.md)

CI（GitHub Actions）：push/PR 时自动 `npm ci` → `npm test` → `npm run build` → `npm run eval:retrieval`（见 `.github/workflows/ci.yml`）。离线 eval 进 CI；live eval 需本机模型，不进 CI。

## 打包发布

```bash
npm run tauri:build
```

产物默认在 `src-tauri/target/release/bundle/nsis/`。已整理的 1.0 安装包：

- `release/v1.0.0/LocalKnowledgeBase-1.0.0-x64-setup.exe` — 安装程序（推荐分发）
- `release/v1.0.0/LocalKnowledgeBase-1.0.0-x64-portable.exe` — 便携版

## 演示前 Checklist

1. Ollama 已启动，且已 `ollama pull nomic-embed-text`（对话模型按需拉取）
2. 设置页中 Ollama / ChromaDB 状态为可用
3. 至少导入 1 份文档且状态为「就绪」
4. 准备一问「库内可答」+ 一问「应拒答」以展示门控

更完整的脚本见 [`docs/ops/demo-checklist.md`](docs/ops/demo-checklist.md)。

## 文档索引

- 设计：[`docs/superpowers/specs/2026-04-29-local-knowledge-base-design.md`](docs/superpowers/specs/2026-04-29-local-knowledge-base-design.md)
- 阶段计划：[`docs/superpowers/README.md`](docs/superpowers/README.md)
- 技术取舍：[`docs/superpowers/specs/2026-07-31-technical-tradeoffs.md`](docs/superpowers/specs/2026-07-31-technical-tradeoffs.md)
- 评测结果：[`evals/LIVE_RESULTS.md`](evals/LIVE_RESULTS.md) · [`evals/RESULTS.md`](evals/RESULTS.md)

## 架构一览

```
导入 → Parser → Chunker → SQLite(chunks/FTS5) → Ollama Embed → ChromaDB
问答 → Hybrid Retrieve → Relevance Gate → Prompt/Context Budget → Stream (Ollama | SiliconFlow) → 引用 UI
```

前端 TypeScript 负责 RAG 编排；Rust 负责持久化、FTS、文件与 Chroma/Ollama 进程桥接。

## 说明

- SiliconFlow 模式下：**生成**走云端，**嵌入与检索**仍本地。
- API Key 明文只写在本地 SQLite；`get_setting` / `get_all_settings` 对外只返回掩码；聊天与测试连接经 Rust 命令代理，前端不再带 `Authorization: Bearer`。
- 本仓库评测为离线 fixture 模式，用于回归与面试演示，不替代生产环境真实向量评测。
