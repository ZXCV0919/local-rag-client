# 本地知识库桌面客户端 — 设计文档

> **项目名称:** 本地知识库桌面客户端
> **日期:** 2026-04-29
> **状态:** 已确认

## 1. 项目概述

基于 RAG 架构的本地知识管理工具，支持多格式文档导入与智能分块，通过向量化存储实现语义检索与对话式问答，数据全部本地处理保障隐私安全。

### 1.1 核心功能

1. 多格式文档解析与智能分块（PDF/Markdown/TXT/Word）
2. 文本 Embedding 向量化与本地向量存储
3. 语义检索 + 关键词全文搜索双模式
4. 基于检索结果的 LLM 对话式问答与分块级引用溯源

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript + Rust |
| 桌面框架 | Tauri 2.x |
| 前端 | React 19.x + Zustand 5.x + React Router 7.x |
| UI | Radix UI + TailwindCSS 4.x |
| 数据库 | SQLite (rusqlite + Diesel) |
| 向量数据库 | ChromaDB 0.5.x (嵌入式) |
| LLM/Embedding | Ollama API |
| PDF解析 | pdfjs-dist 4.x |
| Markdown | unified + remark |
| DOCX | mammoth 1.x |
| Markdown渲染 | react-markdown + rehype |
| 代码高亮 | Shiki |

### 1.3 目标用户与场景

- **个人知识管理**：单用户本地使用，重视导入速度和检索质量
- 数据全部本地存储，零上传，保障隐私安全

---

## 2. 架构设计

### 2.1 整体架构：混合架构（Rust 系统层 + TypeScript 业务层）

```
┌─────────────────────────────────────────────┐
│                 React 前端                    │
│  知识库管理 | 文档管理 | 对话界面 | 设置中心  │
│              Tauri IPC (invoke / events)      │
├──────────────────────────────────────────────┤
│                 Rust 后端                     │
│  文件系统操作 | Ollama进程管理 | ChromaDB集成 │
│  SQLite操作   | Sidecar/子进程管理            │
├──────────────────────────────────────────────┤
│          TypeScript 业务逻辑层                 │
│  文档解析 | 分块引擎 | Embedding调用           │
│  检索引擎(向量+关键词重排) | LLM对话引擎      │
└──────────────────────────────────────────────┘
```

- **Rust 后端**（Tauri native）：SQLite 操作、文件系统读写、Ollama 进程管理、ChromaDB 嵌入式启动
- **TypeScript 层**：文档解析、智能分块、Embedding/LLM 调用、检索逻辑
- **React 前端**：纯 UI 展示和交互，通过 Tauri IPC 与 Rust 通信
- **Ollama 交互**：通过 HTTP API（localhost:11434）

### 2.2 各层职责

| 层 | 职责 | 运行环境 |
|----|------|----------|
| React 前端 | UI 渲染、用户交互、状态展示 | WebView |
| TypeScript 业务层 | 文档解析、分块、检索逻辑、Prompt 构建 | WebView (主线程/Worker) |
| Rust 后端 | 数据库、文件系统、进程管理、IPC 桥接 | Native |

---

## 3. 数据模型

### 3.1 SQLite 数据模型

#### knowledge_bases（知识库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 知识库名称 |
| description | TEXT | 描述 |
| embedding_model | TEXT | 使用的 Embedding 模型 |
| chunking_strategy | TEXT | 默认分块策略 JSON |
| document_count | INTEGER | 文档计数 |
| total_tokens | INTEGER | 总 Token 统计 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### documents（文档）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| knowledge_base_id | TEXT FK | 所属知识库 |
| title | TEXT | 文档标题 |
| file_name | TEXT | 文件名 |
| file_path | TEXT | 原始文件路径 |
| file_type | TEXT | pdf/md/txt/docx |
| file_size | INTEGER | 文件大小(bytes) |
| content_hash | TEXT | 内容哈希，用于变更检测 |
| chunk_count | INTEGER | 分块数 |
| status | TEXT | pending/processing/ready/error |
| error_message | TEXT | 错误信息 |
| imported_at | DATETIME | 导入时间 |
| updated_at | DATETIME | 更新时间 |

#### chunks（分块）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| document_id | TEXT FK | 所属文档 |
| knowledge_base_id | TEXT FK | 所属知识库 |
| chunk_index | INTEGER | 在文档中的顺序 |
| content | TEXT | 分块原文 |
| token_count | INTEGER | Token 数 |
| char_start | INTEGER | 在文档中的字符偏移起始 |
| char_end | INTEGER | 在文档中的字符偏移结束 |
| heading_path | TEXT | 所属标题路径 (如 "a/b/c") |
| chunk_type | TEXT | heading/paragraph/code/table/mixed |
| embedding_id | TEXT | ChromaDB 中的向量 ID |
| metadata | TEXT | JSON 额外元数据 |

#### conversations（对话）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| knowledge_base_id | TEXT FK | 所属知识库 |
| title | TEXT | 自动生成或用户编辑 |
| llm_model | TEXT | 使用的 LLM 模型 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### messages（消息）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| conversation_id | TEXT FK | 所属对话 |
| role | TEXT | user/assistant/system |
| content | TEXT | 消息内容 |
| referenced_chunks | TEXT | JSON, 引用的分块 ID 列表 |
| token_count | INTEGER | Token 数 |
| created_at | DATETIME | 创建时间 |

#### ollama_models（模型）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 模型名 |
| model_type | TEXT | embedding/chat |
| size | INTEGER | 模型大小 |
| status | TEXT | available/downloading/error |
| last_checked | DATETIME | 最后检查时间 |

#### settings（设置）

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 设置键 |
| value | TEXT | 设置值(JSON) |
| updated_at | DATETIME | 更新时间 |

### 3.2 ChromaDB 集合结构

集合名：`kb_{knowledge_base_id}`

- **id**: chunk_id（与 SQLite chunks.id 一致）
- **embedding**: 向量数据
- **metadata**: { document_id, file_name, chunk_type, heading_path, char_start, char_end }
- **document**: 分块原文（用于关键词搜索）

### 3.3 SQLite FTS5 全文搜索

对 chunks 表的 content 字段建立 FTS5 虚拟表，支持中文分词（使用 simple tokenizer + jieba 分词或 unicode61 tokenizer）。

---

## 4. 文档解析与智能分块

### 4.1 导入管线流程

```
用户导入文件 → Rust后端(文件预检+哈希计算)
  → TypeScript层(文档解析)
  → TypeScript层(智能分块)
  → Rust后端(SQLite写入)
  → TypeScript层(Embedding调用)
  → Rust后端(ChromaDB写入)
  → status: ready
```

每一步有 status 跟踪：pending → processing → ready/error。

### 4.2 文件解析

| 格式 | 解析库 | 特殊处理 |
|------|--------|----------|
| PDF | pdfjs-dist | 提取文本+页码；表格为HTML；图片忽略 |
| Markdown | unified (remark) | 保留标题层级结构；代码块保持完整；链接保留 |
| TXT | 原生 | 按空行分段落；自动识别标题 |
| DOCX | mammoth | 提取标题层级；表格→Markdown；图片忽略 |

### 4.3 统一中间格式 (DocContent)

```typescript
interface DocContent {
  title: string;
  file_type: string;
  sections: DocSection[];
}

interface DocSection {
  heading: string;
  heading_path: string;     // 如 "第2章/RAG架构"
  heading_level: number;     // 1-6
  content: string;
  content_type: 'text' | 'code' | 'table' | 'list';
}
```

### 4.4 混合分块策略

**优先级规则：**

1. 优先按标题层级拆分 — 每个 section 作为独立 chunk
2. 超长 section → 按段落拆分
3. 超短 section → 与相邻 section 合并
4. 代码块不拆分（尽量保持完整）
5. 表格不拆分（尽量保持完整）

**默认参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| max_chunk_size | 800 tokens | 单个分块最大 Token 数 |
| min_chunk_size | 100 tokens | 单个分块最小 Token 数 |
| overlap | 50 tokens | 分块重叠字数 |
| heading_as_context | true | 标题路径作为上下文 |

**每个 chunk 附带：**
- heading_path：标题路径上下文
- char_start / char_end：字符偏移，用于溯源
- chunk_type：heading/paragraph/code/table/mixed

### 4.5 进度反馈与错误处理

- 通过 Tauri events 实时推送进度（解析中 / 分块中 / 向量化中 / x/N chunks 完成）
- 每个步骤都有 status 跟踪，解析或 Embedding 失败时记录 error_message，不阻塞其他文档
- content_hash 用于文档更新检测，避免重复导入

---

## 5. 检索引擎

### 5.1 双路检索

**向量检索路径：**
1. 用户查询 → Ollama Embedding API 向量化
2. ChromaDB query(embeddings, n_results=20)
3. 返回 top-K（余弦相似度）

**关键词搜索路径：**
1. 用户查询 → 提取关键词
2. ChromaDB where 文档过滤 + 关键词匹配
3. BM25 评分排序
4. 返回 top-K

### 5.2 融合重排

```
final_score = α × norm(vector_score)    // α=0.7 默认
            + β × norm(keyword_score)   // β=0.3 默认
            + γ × title_match_bonus     // 标题命中加权
```

- α/β 可在设置中调整
- 同一 chunk 只保留最高分（去重）
- 确保不同文档的 chunk 都被代表（多样性）

### 5.3 检索模式

| 模式 | 说明 |
|------|------|
| 智能模式（默认） | 向量优先 + 关键词重排 |
| 纯语义模式 | 只用向量检索，适合概念性/模糊查询 |
| 纯关键词模式 | 只用全文搜索，适合精确术语查找 |

### 5.4 上下文窗口构建

- 截断/合并检索结果，控制总 token 数 ≤ 上下文窗口的 60%
- 每个 chunk 附带 heading_path + 原文片段
- chunk 间插入来源标注 `[文档名#分块索引]`

---

## 6. RAG 对话引擎

### 6.1 Prompt 构建顺序

系统提示词（固定） → 检索上下文（优先保证） → 会话历史（可压缩） → 用户提问（必须保留）

### 6.2 系统提示词模板

```
你是一个知识库问答助手。请基于以下参考资料回答用户问题。

## 参考资料
{{#each references}}
[{{document_title}}#{{chunk_index}}]
{{content}}
{{/each}}

## 规则
- 仅基于参考资料回答，不编造信息
- 引用来源时标注 [文档名#分块号]
- 如果参考资料不足以回答，明确告知用户
- 使用中文回答
```

### 6.3 会话历史管理

- 滑动窗口：保留最近 6 轮对话
- 自动摘要：超出窗口的历史由 LLM 生成摘要
- 每个会话绑定一个知识库，切换知识库需新建会话
- 所有对话存储在 SQLite，支持恢复续聊

### 6.4 LLM 调用

- POST `http://localhost:11434/api/chat`，stream: true
- 超时：120s（可配置）
- 中断支持：用户可随时停止生成（AbortController）
- 重试：Ollama 断连时提示用户检查服务状态，超时自动重试 3 次

### 6.5 引用溯源

答案中的 `[文档名#分块号]` 标记渲染为可点击链接：

- 点击后展开引用卡片：文档名 + 标题路径 + 分块原文（前后各扩展 50 字上下文，高亮匹配部分）
- 支持「查看原文」跳转到文档定位
- 字符偏移定位 (char_start/char_end) 实现精确溯源

---

## 7. Ollama 集成

### 7.1 双模式

**模式1：连接外部 Ollama 服务**
- 检测 localhost:11434 是否可用
- 定期心跳检测（10s 间隔）
- 列出可用模型
- 断连时通知前端显示警告

**模式2：内嵌管理 Ollama 进程**
- 启动：查找 ollama 可执行文件路径（Windows: %LOCALAPPDATA%\Ollama\）
- OLLAMA_HOST 环境变量支持
- 启动为子进程，监控 stdout/stderr
- 应用退出时优雅关闭子进程
- 健康检查：GET /api/tags
- 进程崩溃时自动重启（最多 3 次）

### 7.2 Tauri Commands

- `get_ollama_status()` → 连接状态
- `get_ollama_models()` → 模型列表
- `start_ollama()` → 启动内嵌管理
- `stop_ollama()` → 停止内嵌管理
- `download_model(name)` → 下载模型
- `delete_model(name)` → 删除模型
- `get_model_info(name)` → 模型详情

### 7.3 Tauri Events

- `ollama:status-changed`
- `ollama:model-downloading(progress)`
- `ollama:model-ready(name)`
- `ollama:error(message)`

### 7.4 Embedding 调用

- POST `http://localhost:11434/api/embed`
- 批量向量化：5 个 chunk 并发
- 失败重试：指数退避，最多 3 次
- 进度追踪：已完成/总数 → Tauri event
- 取消支持：文档删除时取消进行中的任务
- 缓存：同文本不重复向量化

---

## 8. ChromaDB 集成

### 8.1 嵌入式启动

1. 检测端口是否已被占用 → 已占用：直接使用现有实例 → 未占用：启动新实例
2. 启动：`python -m chromadb.server`，随机端口（范围 8100-8200），数据目录 `{app_data}/chroma_db`
3. 作为子进程启动，监控健康状态
4. 健康检查：GET `/api/v1/heartbeat`，每 30s 检测一次
5. 失败自动重启，应用退出时优雅关闭

### 8.2 ChromaDB Tauri Commands

- `create_collection(kb_id)`
- `delete_collection(kb_id)`
- `add_documents(collection_id, chunks[], embeddings[])`
- `query_collection(collection_id, embedding, n)`
- `delete_documents(collection_id, chunk_ids[])`
- `get_collection_stats(collection_id)`
- `search_keyword(collection_id, query, n)`

### 8.3 备选方案

如 Python 依赖过大，可使用 sqlite-vec 扩展作为向量存储替代：
- 优势：无额外依赖，统一在 SQLite 中
- 劣势：功能较简单，缺少 ChromaDB 的高级过滤

---

## 9. 前端路由与页面

### 9.1 路由结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 重定向或空白引导页 | 首页 |
| `/kb/:id` | 知识库首页 | 概览：文档数、分块数、最近对话 |
| `/kb/:id/documents` | 文档管理 | 文档列表、导入、查看详情 |
| `/kb/:id/chat` | 对话界面 | RAG 问答主界面 |
| `/kb/:id/chat/:conversationId` | 对话界面(恢复) | 继续历史对话 |
| `/documents/:id` | 文档详情 | 查看原文、分块预览、引用定位 |
| `/settings` | 设置中心 | 模型配置、分块参数、检索参数 |
| `/settings/ollama` | Ollama 管理 | 模型列表、下载、启停 |

### 9.2 页面设计

**知识库首页**：统计卡片（文档数/分块数/对话数）+ 快捷操作（开始对话/导入文档）+ 最近对话列表 + 最近导入状态

**对话界面**（核心页面）：知识库绑定 + 检索模式切换 + 流式 Markdown 渲染 + 引用溯源卡片 + 输入框

**文档管理**：搜索 + 文档卡片列表（进度条/状态标签）+ 拖拽导入 + 批量操作

**设置页**：Ollama 连接 + 默认模型选择 + 分块参数 + 检索参数 + 数据目录 + 导出/清空

---

## 10. 项目结构

```
local-knowledge-base/
├── src-tauri/                          # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── migrations/
│   │   │   ├── models.rs
│   │   │   ├── knowledge_base.rs
│   │   │   ├── document.rs
│   │   │   ├── chunk.rs
│   │   │   ├── conversation.rs
│   │   │   └── settings.rs
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── ollama.rs
│   │   │   ├── chromadb.rs
│   │   │   └── file_watcher.rs
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── knowledge_base.rs
│   │   │   ├── document.rs
│   │   │   ├── chat.rs
│   │   │   ├── ollama.rs
│   │   │   ├── chromadb.rs
│   │   │   └── settings.rs
│   │   └── errors.rs
│   └── icons/
├── src/                                  # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── knowledge-base/
│   │   ├── document/
│   │   ├── chat/
│   │   ├── settings/
│   │   └── common/
│   ├── hooks/
│   ├── services/
│   │   ├── parser/
│   │   ├── chunker/
│   │   ├── embedding/
│   │   ├── retrieval/
│   │   └── llm/
│   ├── store/
│   ├── types/
│   ├── utils/
│   └── styles/
├── resources/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 11. 非功能性需求

### 11.1 性能

- 文档导入：100 页 PDF < 30s（含解析+分块+向量化）
- 检索响应：< 3s（向量+关键词+重排）
- 流式输出首 Token：< 2s

### 11.2 可靠性

- 所有数据库操作使用事务保证原子性
- 文档导入失败不阻塞其他文档
- Ollama/ChromaDB 断连自动检测和提示
- 自动重启机制（Ollama 最多 3 次，ChromaDB 无限）

### 11.3 安全

- 所有数据本地存储，零上传
- 文件路径验证，防止目录遍历
- 不记录任何用户数据到远程服务

### 11.4 可扩展性（预留，不在一期实现）

- 查询改写
- Re-ranking（cross-encoder）
- 父子 chunk 检索
- OCR 图片文字提取
- 文件变更监听自动更新
- 多语言 UI 支持

---

## 12. 关键设计决策摘要

| 决策 | 选择 | 理由 |
|------|------|------|
| 架构 | Rust+TS 混合 | 各取所长，Tauri 天然支持 |
| 数据库 | SQLite + ChromaDB | 结构化+向量双存储 |
| 分块策略 | 混合（结构优先+长度兜底） | 保留语义完整性 |
| 检索策略 | 向量优先+关键词重排 | 主流 RAG 方案，效果好 |
| 引用粒度 | 分块级 | 平衡精确度和实现复杂度 |
| 对话历史 | 可恢复续聊 | 用户体验优先 |
| 知识库组织 | 多知识库 | 知识域隔离 |
| Ollama 集成 | 双模式（连接+管理） | 灵活性最大 |
| ChromaDB | 嵌入式 | 用户无额外操作 |
| 数据存储 | 纯本地 | 隐私安全核心诉求 |