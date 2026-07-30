# 本地知识库桌面客户端 — 项目文档索引

## 项目概述

基于 RAG 架构的本地知识管理桌面工具，支持多格式文档导入与智能分块，通过向量化存储实现语义检索与对话式问答，数据全部本地处理保障隐私安全。

**技术栈：** TypeScript + Rust | Tauri 2 + React | SQLite + ChromaDB | Ollama

---

## 文档结构

```
docs/superpowers/
├── README.md                                    ← 你在这里
├── specs/
│   ├── 2026-04-29-local-knowledge-base-design.md   ← 设计文档（架构/数据模型/UI/技术选型）
│   └── 2026-07-31-technical-tradeoffs.md           ← 技术取舍一页纸（面试）
└── plans/
    ├── 2026-04-29-phase1-scaffolding.md        ← 阶段1：项目脚手架与基础设施
    ├── 2026-04-29-phase2-data-layer.md         ← 阶段2：数据层
    ├── 2026-04-29-phase3-parsing-chunking.md   ← 阶段3：文档解析与智能分块
    ├── 2026-04-29-phase4-embedding-storage.md   ← 阶段4：向量化与存储
    ├── 2026-04-29-phase5-retrieval.md          ← 阶段5：检索引擎
    ├── 2026-04-29-phase6-rag-chat.md           ← 阶段6：RAG对话引擎
    ├── 2026-04-29-phase6.5-visual-youth-polish.md
    ├── 2026-04-29-phase7-settings-polish.md    ← 阶段7：设置与打磨
    └── 2026-05-30-phase8-siliconflow-chat-provider.md
```

## 阅读顺序

**先读设计文档，再按顺序读计划。**

1. `specs/2026-04-29-local-knowledge-base-design.md` — 理解全局架构、数据模型、UI设计
2. `plans/phase1` → `phase8` — 按阶段顺序实现
3. `specs/2026-07-31-technical-tradeoffs.md` — 技术取舍（本地嵌入 / 云边界 / Key 威胁模型）
4. 根目录 `README.md`、`docs/ops/troubleshooting.md`、`evals/LIVE_RESULTS.md` — 运行、排障与评测

---

## 阶段依赖关系

```
阶段1：项目脚手架 ─────────────────────────── 所有后续阶段的前提
   │
   ▼
阶段2：数据层 ───────────────────────────── 阶段3/4/5/6 需要 CRUD 和 Ollama/ChromaDB
   │
   ├──────────────────┐
   ▼                  ▼
阶段3：解析与分块    阶段2 的 Ollama/ChromaDB 连接
   │
   ▼
阶段4：向量化与存储 ── 依赖阶段3的分块产出 → Ollama Embedding + ChromaDB 写入
   │
   ▼
阶段5：检索引擎 ──── 依赖阶段4的向量数据 → ChromaDB 查询 + FTS5 搜索
   │
   ▼
阶段6：RAG对话引擎 ── 依赖阶段5的检索结果 → Ollama Chat API + 流式输出
   │
   ▼
阶段7：设置与打磨 ─── 依赖阶段1-6的完整功能 → 设置页/错误处理/优化
```

**关键交叉依赖：**

| 依赖 | 说明 |
|------|------|
| 阶段3→阶段4 | 分块数据是 Embedding 的输入，ChunkResult 类型在阶段3定义 |
| 阶段4→阶段5 | ChromaDB 中的向量数据是检索的输入 |
| 阶段5→阶段6 | 检索返回的 RerankedResult 是 Prompt 构建的输入 |
| 阶段2(Ollama)→阶段4 | Embedding 调用依赖 Ollama 连接 |
| 阶段2(ChromaDB)→阶段4,5 | 向量存储和查询依赖 ChromaDB |
| 阶段1(Types)→所有阶段 | TypeScript 类型定义在阶段1创建，后续阶段扩展 |

---

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 架构 | Rust+TS 混合 | Rust做系统交互，TS做业务逻辑，Tauri2天然支持 |
| 数据库 | SQLite + ChromaDB | 结构化+向量双存储 |
| 分块 | 混合策略(结构优先+长度兜底) | 保留语义完整性 |
| 检索 | 向量优先+关键词重排(α=0.7, β=0.3) | 主流RAG方案 |
| 引用 | 分块级 | 平衡精确度和复杂度 |
| 对话 | 可恢复续聊 | 用户体验优先 |
| 知识库 | 多知识库隔离 | 知识域隔离 |
| Ollama | 双模式(连接+内嵌管理) | 灵活性最大 |
| 数据 | 纯本地存储 | 隐私安全核心诉求 |

---

## 核心数据流

```
用户导入文档
    → Rust: 文件读取 + 哈希计算
    → TS: 文档解析(PDF/MD/TXT/DOCX) → DocContent
    → TS: 智能分块(混合策略) → Chunk[]
    → Rust: 写入 SQLite(chunks表 + FTS5索引)
    → TS: Embedding(Ollama API) → 向量[]
    → Rust: 写入 ChromaDB(collection)
    → 文档状态: ready

用户提问
    → TS: 查询预处理
    → TS: 向量检索(ChromaDB) + 关键词搜索(FTS5) → 双路召回
    → TS: 融合重排 → Top-K
    → TS: Prompt构建(系统提示 + 检索上下文 + 历史 + 问题)
    → TS: Ollama Chat API(流式)
    → 前端: Markdown渲染 + 引用溯源
```

---

## 技术注意事项

### Rust 侧 (src-tauri/)

- 使用 Diesel ORM + SQLite，手动 SQL 迁移（非 Diesel migration macro）
- Schema 在 `src-tauri/src/db/schema.rs` 手动维护，需与迁移脚本保持同步
- 所有 Tauri Command 返回 `Result<T, AppError>`，AppError 统一错误处理
- ChromaDB 通过子进程启动（`python -m chromadb.server`），端口范围 8100-8200
- Ollama 通过 HTTP API 交互（localhost:11434），支持连接外部服务或内嵌管理

### TypeScript 侧 (src/)

- 状态管理用 Zustand，不要用 Redux/Context
- UI 组件用 Radix UI + TailwindCSS，不要用其他组件库
- 文档解析和分块在前端完成，重型计算考虑 Web Worker
- Ollama API 直接从前端调用（localhost:11434），不需要通过 Rust 转发
- ChromaDB 操作通过 Tauri Command 让 Rust 侧调用 REST API

### 类型系统

- 核心 TypeScript 类型定义在 `src/types/` 目录
- Rust 侧模型定义在 `src-tauri/src/db/models.rs`
- 两侧类型需手动保持同步（字段名、枚举值）
- Tauri Command 的序列化/反序列化走 serde

### 编码规范

- 不添加注释（除非用户要求）
- 文件名使用 kebab-case
- 组件名使用 PascalCase
- 导出使用命名导出（不用 default export）
- Rust 函数使用 snake_case

---

## 开发启动检查清单

开始开发前确认：

- [ ] Node.js 18+ 已安装
- [ ] Rust 工具链已安装（rustup）
- [ ] Tauri CLI 已安装（`cargo install tauri-cli`）
- [ ] Ollama 已安装并运行（`ollama serve`）
- [ ] Python 3.8+ 已安装（ChromaDB 依赖）
- [ ] 已阅读设计文档
- [ ] 已理解阶段依赖关系
- [ ] 从阶段1开始，按顺序执行