# 阶段1：项目脚手架与基础设施 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Tauri 2 + React 项目骨架，包含 SQLite 数据库初始化、基础布局与路由、以及核心类型定义，为后续阶段提供可运行的应用框架。

**Architecture:** Tauri 2 混合架构，Rust 后端负责系统级操作（数据库、文件系统），React 前端负责 UI 与业务逻辑。Zustand 管理前端状态，React Router 管理页面路由。

**Tech Stack:** Tauri 2, React 19, TypeScript, Zustand 5, React Router 7, Radix UI, TailwindCSS 4, Diesel (Rust ORM), rusqlite

---

## File Structure

```
local-knowledge-base/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── src/an
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   └── migrations/
│   │   │       └── 001_init.sql
│   │   ├── commands/
│   │   │   └── mod.rs
│   │   └── errors.rs
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Titlebar.tsx
│   │   └── common/
│   │       ├── ProgressBar.tsx
│   │       ├── StatusBadge.tsx
│   │       └── Toast.tsx
│   ├── hooks/
│   │   └── useDatabase.ts
│   ├── store/
│   │   └── index.ts
│   ├── types/
│   │   ├── knowledge-base.ts
│   │   ├── document.ts
│   │   ├── chunk.ts
│   │   ├── conversation.ts
│   │   ├── ollama.ts
│   │   └── settings.ts
│   ├── styles/
│   │   ├── global.css
│   │   └── variables.css
│   └── utils/
│       └── hash.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

### Task 1: 初始化 Tauri 2 + React 项目

**Files:**
- Create: `package.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: 创建 Tauri 2 项目**

使用 `npm create tauri-app@latest` 初始化项目，选择 React + TypeScript 模板。项目名称 `local-knowledge-base`。

```bash
npm create tauri-app@latest local-knowledge-base -- --template react-ts
```

- [ ] **Step 2: 安装前端核心依赖**

```bash
cd local-knowledge-base
npm install react-router-dom zustand @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-toast @radix-ui/react-tooltip
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: 配置 TailwindCSS**

`vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

`src/styles/global.css`:

```css
@import "tailwindcss";
@import "./variables.css";
```

- [ ] **Step 4: 配置 Cargo.toml 添加 Diesel 和 rusqlite 依赖**

`src-tauri/Cargo.toml` 关键依赖:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
diesel = { version = "2", features = ["sqlite", "r2d2"] }
diesel_migrations = { version = "2" }
r2d2 = "0.8"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
sha2 = "0.10"
hex = "0.4"

[build-dependencies]
diesel = { version = "2", features = ["sqlite"] }
```

- [ ] **Step 5: 验证项目可以正常运行**

```bash
cd local-knowledge-base
npm run tauri dev
```

Expected: Tauri 窗口正常打开，显示默认 React 页面。

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: initialize Tauri 2 + React project with core dependencies"
```

---

### Task 2: SQLite 数据库初始化与迁移

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/migrations/001_init.sql`
- Create: `src-tauri/src/errors.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 创建数据库迁移脚本**

`src-tauri/src/db/migrations/001_init.sql`:

```sql
-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    embedding_model TEXT NOT NULL DEFAULT 'nomic-embed-text',
    chunking_strategy TEXT NOT NULL DEFAULT '{"max_chunk_size":800,"min_chunk_size":100,"overlap":50,"heading_as_context":true}',
    document_count INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 文档表
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'md', 'txt', 'docx')),
    file_size INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    error_message TEXT NOT NULL DEFAULT '',
    imported_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 分块表
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    char_start INTEGER NOT NULL DEFAULT 0,
    char_end INTEGER NOT NULL DEFAULT 0,
    heading_path TEXT NOT NULL DEFAULT '',
    chunk_type TEXT NOT NULL DEFAULT 'paragraph' CHECK (chunk_type IN ('heading', 'paragraph', 'code', 'table', 'mixed')),
    embedding_id TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}'
);

-- 对话表
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY NOT NULL,
    knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '新对话',
    llm_model TEXT NOT NULL DEFAULT 'qwen2.5:7b',
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    referenced_chunks TEXT NOT NULL DEFAULT '[]',
    token_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Ollama模型表
CREATE TABLE IF NOT EXISTS ollama_models (
    id TEXT PRIMARY KEY NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('embedding', 'chat')),
    size INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'downloading', 'error')),
    last_checked DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_documents_kb ON documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_kb ON chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_conversations_kb ON conversations(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- FTS5 全文搜索虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    content,
    content='chunks',
    content_rowid='rowid',
    tokenize='unicode61'
);

-- FTS5 同步触发器
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    INSERT INTO chunks_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- 初始设置
INSERT OR IGNORE INTO settings (key, value) VALUES ('ollama_url', '"http://localhost:11434"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_embedding_model', '"nomic-embed-text"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_chat_model', '"qwen2.5:7b"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('retrieval_mode', '"hybrid"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('vector_weight', '0.7');
INSERT OR IGNORE INTO settings (key, value) VALUES ('keyword_weight', '0.3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_results', '6');
INSERT OR IGNORE INTO settings (key, value) VALUES ('data_directory', '""');
```

- [ ] **Step 2: 创建数据库模块**

`src-tauri/src/db/mod.rs`:

```rust
use diesel::sqlite::SqliteConnection;
use diesel::connection::SimpleConnection;
use diesel::r2d2::{self, ConnectionManager, Pool};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::AppHandle;

pub mod migrations;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

static DB_POOL: OnceLock<DbPool> = OnceLock::new();

pub fn init_database(app_handle: &AppHandle) -> Result<DbPool, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_dir.join("knowledge_base.db");
    let db_url = format!("sqlite://{}?rwc=true", db_path.display());

    let manager = ConnectionManager::<SqliteConnection>::new(&db_url);
    let pool = r2d2::Pool::builder()
        .max_size(10)
        .build(manager)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    run_migrations(&pool)?;

    DB_POOL.set(pool.clone()).map_err(|_| "Database already initialized".to_string())?;

    Ok(pool)
}

fn run_migrations(pool: &DbPool) -> Result<(), String> {
    let conn = pool.get().map_err(|e| format!("Failed to get connection: {}", e))?;
    conn.batch_run(migrations::MIGRATIONS)
        .map_err(|e| format!("Failed to run migrations: {}", e))?;
    Ok(())
}

pub fn get_pool() -> Result<&'static DbPool, String> {
    DB_POOL.get().ok_or_else(|| "Database not initialized".to_string())
}
```

`src-tauri/src/db/migrations/mod.rs`:

```rust
pub const MIGRATIONS: &str = include_str!("001_init.sql");
```

- [ ] **Step 3: 创建统一错误处理**

`src-tauri/src/errors.rs`:

```rust
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn db(message: impl Into<String>) -> Self {
        Self::new("DB_ERROR", message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", message)
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new("VALIDATION_ERROR", message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("INTERNAL_ERROR", message)
    }
}

impl From<diesel::result::Error> for AppError {
    fn from(err: diesel::result::Error) -> Self {
        AppError::db(err.to_string())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(err: r2d2::Error) -> Self {
        AppError::db(err.to_string())
    }
}
```

- [ ] **Step 4: 更新 lib.rs 注册数据库初始化**

`src-tauri/src/lib.rs`:

```rust
mod db;
mod commands;
mod errors;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            db::init_database(&app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: 验证编译和运行**

```bash
cd src-tauri && cargo build
```

Expected: 编译成功，无错误。

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: add SQLite database initialization with migrations and error handling"
```

---

### Task 3: 前端 TypeScript 类型定义

**Files:**
- Create: `src/types/knowledge-base.ts`
- Create: `src/types/document.ts`
- Create: `src/types/chunk.ts`
- Create: `src/types/conversation.ts`
- Create: `src/types/ollama.ts`
- Create: `src/types/settings.ts`

- [ ] **Step 1: 创建知识库类型**

`src/types/knowledge-base.ts`:

```typescript
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  chunking_strategy: ChunkingStrategy;
  document_count: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface ChunkingStrategy {
  max_chunk_size: number;
  min_chunk_size: number;
  overlap: number;
  heading_as_context: boolean;
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  embedding_model?: string;
  chunking_strategy?: Partial<ChunkingStrategy>;
}
```

- [ ] **Step 2: 创建文档类型**

`src/types/document.ts`:

```typescript
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';
export type FileType = 'pdf' | 'md' | 'txt' | 'docx';

export interface Document {
  id: string;
  knowledge_base_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: FileType;
  file_size: number;
  content_hash: string;
  chunk_count: number;
  status: DocumentStatus;
  error_message: string;
  imported_at: string;
  updated_at: string;
}

export interface ImportProgress {
  document_id: string;
  status: DocumentStatus;
  current_step: string;
  completed: number;
  total: number;
  error_message?: string;
}
```

- [ ] **Step 3: 创建分块类型**

`src/types/chunk.ts`:

```typescript
export type ChunkType = 'heading' | 'paragraph' | 'code' | 'table' | 'mixed';

export interface Chunk {
  id: string;
  document_id: string;
  knowledge_base_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  char_start: number;
  char_end: number;
  heading_path: string;
  chunk_type: ChunkType;
  embedding_id: string;
  metadata: Record<string, unknown>;
}

export interface DocContent {
  title: string;
  file_type: string;
  sections: DocSection[];
}

export interface DocSection {
  heading: string;
  heading_path: string;
  heading_level: number;
  content: string;
  content_type: 'text' | 'code' | 'table' | 'list';
}
```

- [ ] **Step 4: 创建对话类型**

`src/types/conversation.ts`:

```typescript
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Conversation {
  id: string;
  knowledge_base_id: string;
  title: string;
  llm_model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  referenced_chunks: string[];
  token_count: number;
  created_at: string;
}

export interface ChatRequest {
  conversation_id: string;
  message: string;
  retrieval_mode: RetrievalMode;
}

export type RetrievalMode = 'hybrid' | 'semantic' | 'keyword';
```

- [ ] **Step 5: 创建 Ollama 类型**

`src/types/ollama.ts`:

```typescript
export type OllamaStatus = 'connected' | 'disconnected' | 'starting';
export type ModelType = 'embedding' | 'chat';
export type ModelStatus = 'available' | 'downloading' | 'error';

export interface OllamaModel {
  id: string;
  model_type: ModelType;
  size: number;
  status: ModelStatus;
  last_checked: string;
}

export interface OllamaInfo {
  status: OllamaStatus;
  url: string;
  models: OllamaModel[];
}

export interface ModelDownloadProgress {
  model_name: string;
  status: string;
  completed: number;
  total: number;
}
```

- [ ] **Step 6: 创建设置类型**

`src/types/settings.ts`:

```typescript
export interface AppSettings {
  ollama_url: string;
  default_embedding_model: string;
  default_chat_model: string;
  retrieval_mode: 'hybrid' | 'semantic' | 'keyword';
  vector_weight: number;
  keyword_weight: number;
  max_results: number;
  data_directory: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollama_url: 'http://localhost:11434',
  default_embedding_model: 'nomic-embed-text',
  default_chat_model: 'qwen2.5:7b',
  retrieval_mode: 'hybrid',
  vector_weight: 0.7,
  keyword_weight: 0.3,
  max_results: 6,
  data_directory: '',
};
```

- [ ] **Step 7: 提交**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for all domain models"
```

---

### Task 4: 基础布局与路由

**Files:**
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/Titlebar.tsx`
- Create: `src/components/common/StatusBadge.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/styles/variables.css`

- [ ] **Step 1: 创建 CSS 变量和全局样式**

`src/styles/variables.css`:

```css
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-bg-sidebar: #1a1b2e;
  --color-bg-hover: #252640;
  --color-bg-active: #2d2e4a;
  --color-text-primary: #1a1b2e;
  --color-text-secondary: #6b7280;
  --color-text-sidebar: #e2e8f0;
  --color-text-sidebar-dim: #94a3b8;
  --color-accent: #6366f1;
  --color-accent-hover: #4f46e5;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-border: #e5e7eb;
  --color-border-dark: #374151;
  --sidebar-width: 248px;
  --titlebar-height: 38px;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

`src/styles/global.css` (追加):

```css
@import "tailwindcss";
@import "./variables.css";

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  font-family: var(--font-sans);
}

body {
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
```

- [ ] **Step 2: 创建自定义标题栏**

`src/components/layout/Titlebar.tsx`:

```tsx
import { useEffect, useState } from 'react';

export function Titlebar() {
  return (
    <div
      className="flex items-center justify-between h-[38px] bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-dark)] select-none"
      data-tauri-drag-region
    >
      <div data-tauri-drag-region className="flex items-center gap-2 pl-3 text-[var(--color-text-sidebar)]">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <span className="text-sm font-medium">本地知识库</span>
      </div>
      <div data-tauri-drag-region className="flex items-center gap-0 h-full" />
    </div>
  );
}
```

- [ ] **Step 3: 创建侧边栏**

`src/components/layout/Sidebar.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface KnowledgeBaseItem {
  id: string;
  name: string;
  document_count: number;
}

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);

  return (
    <aside className="w-[248px] min-w-[248px] bg-[var(--color-bg-sidebar)] text-[var(--color-text-sidebar)] flex flex-col h-full overflow-hidden">
      <div className="p-3 flex items-center justify-between border-b border-[var(--color-border-dark)]">
        <span className="text-xs uppercase tracking-wider text-[var(--color-text-sidebar-dim)]">知识库</span>
        <button
          onClick={() => navigate('/kb/new')}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-sidebar-dim)] hover:text-white transition-colors"
          title="新建知识库"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        <div className="px-3 py-2">
          <span className="text-xs text-[var(--color-text-sidebar-dim)]">暂无知识库</span>
        </div>
        {knowledgeBases.map((kb) => (
          <button
            key={kb.id}
            onClick={() => navigate(`/kb/${kb.id}`)}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              location.pathname.startsWith(`/kb/${kb.id}`)
                ? 'bg-[var(--color-bg-active)] text-white'
                : 'text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-white'
            }`}
          >
            <span className="truncate">{kb.name}</span>
            <span className="text-xs opacity-60 ml-1">({kb.document_count})</span>
          </button>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-dark)] p-2">
        <button
          onClick={() => navigate('/settings')}
          className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
            location.pathname.startsWith('/settings')
              ? 'bg-[var(--color-bg-active)] text-white'
              : 'text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            设置
          </span>
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: 创建主布局组件**

`src/components/layout/AppLayout.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-primary)]">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 StatusBadge 通用组件**

`src/components/common/StatusBadge.tsx`:

```tsx
type StatusType = 'pending' | 'processing' | 'ready' | 'error' | 'available' | 'downloading' | 'connected' | 'disconnected';

const STATUS_STYLES: Record<StatusType, string> = {
  pending: 'bg-gray-100 text-gray-700',
  processing: 'bg-blue-100 text-blue-700',
  ready: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  available: 'bg-green-100 text-green-700',
  downloading: 'bg-blue-100 text-blue-700',
  connected: 'bg-green-100 text-green-700',
  disconnected: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<StatusType, string> = {
  pending: '等待中',
  processing: '处理中',
  ready: '就绪',
  error: '错误',
  available: '可用',
  downloading: '下载中',
  connected: '已连接',
  disconnected: '已断开',
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status]} ${className}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 6: 配置路由**

`src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';

function WelcomePage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">欢迎使用本地知识库</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">创建一个知识库开始使用</p>
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-[var(--color-text-secondary)]">{title} — 开发中</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<WelcomePage />} />
          <Route path="kb/:id" element={<PlaceholderPage title="知识库首页" />} />
          <Route path="kb/:id/documents" element={<PlaceholderPage title="文档管理" />} />
          <Route path="kb/:id/chat" element={<PlaceholderPage title="对话" />} />
          <Route path="kb/:id/chat/:conversationId" element={<PlaceholderPage title="对话" />} />
          <Route path="documents/:id" element={<PlaceholderPage title="文档详情" />} />
          <Route path="settings" element={<PlaceholderPage title="设置" />} />
          <Route path="settings/ollama" element={<PlaceholderPage title="Ollama 管理" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: 更新入口文件**

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: 验证应用正常运行**

```bash
npm run tauri dev
```

Expected: 窗口正常打开，显示侧边栏和欢迎页面，路由正常工作。

- [ ] **Step 9: 提交**

```bash
git add .
git commit -m "feat: add app layout, sidebar, titlebar, routing and status badge component"
```

---

### Task 5: Zustand 状态管理初始化

**Files:**
- Create: `src/store/index.ts`
- Create: `src/store/knowledge-base.ts`
- Create: `src/store/settings.ts`
- Create: `src/hooks/useDatabase.ts`

- [ ] **Step 1: 创建知识库 Store**

`src/store/knowledge-base.ts`:

```typescript
import { create } from 'zustand';
import type { KnowledgeBase } from '../types/knowledge-base';

interface KnowledgeBaseState {
  knowledgeBases: KnowledgeBase[];
  currentId: string | null;
  loading: boolean;
  error: string | null;
  setKnowledgeBases: (kbs: KnowledgeBase[]) => void;
  setCurrentId: (id: string | null) => void;
  addKnowledgeBase: (kb: KnowledgeBase) => void;
  updateKnowledgeBase: (id: string, updates: Partial<KnowledgeBase>) => void;
  removeKnowledgeBase: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set) => ({
  knowledgeBases: [],
  currentId: null,
  loading: false,
  error: null,
  setKnowledgeBases: (kbs) => set({ knowledgeBases: kbs }),
  setCurrentId: (id) => set({ currentId: id }),
  addKnowledgeBase: (kb) => set((state) => ({ knowledgeBases: [...state.knowledgeBases, kb] })),
  updateKnowledgeBase: (id, updates) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.map((kb) =>
        kb.id === id ? { ...kb, ...updates } : kb
      ),
    })),
  removeKnowledgeBase: (id) =>
    set((state) => ({
      knowledgeBases: state.knowledgeBases.filter((kb) => kb.id !== id),
      currentId: state.currentId === id ? null : state.currentId,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 2: 创建设置 Store**

`src/store/settings.ts`:

```typescript
import { create } from 'zustand';
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings';

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  setSettings: (settings: Partial<AppSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: { ...DEFAULT_SETTINGS },
  loading: false,
  error: null,
  setSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 3: 创建 Store 索引**

`src/store/index.ts`:

```typescript
export { useKnowledgeBaseStore } from './knowledge-base';
export { useSettingsStore } from './settings';
```

- [ ] **Step 4: 创建 Tauri IPC 调用工具**

`src/hooks/useDatabase.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export async function tauriCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const result = await invoke<T>(command, args);
    return result;
  } catch (error) {
    throw new Error(`Command '${command}' failed: ${String(error)}`);
  }
}
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add Zustand stores for knowledge-base and settings, and Tauri IPC utility"
```

---

### Task 6: Rust 端知识库 CRUD Commands

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/knowledge_base.rs`
- Create: `src-tauri/src/db/knowledge_base.rs`
- Create: `src-tauri/src/db/models.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 Diesel 模型定义**

`src-tauri/src/db/models.rs`:

```rust
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Queryable, Selectable, Serialize, Deserialize)]
#[diesel(table_name = crate::db::schema::knowledge_bases)]
pub struct KnowledgeBase {
    pub id: String,
    pub name: String,
    pub description: String,
    pub embedding_model: String,
    pub chunking_strategy: String,
    pub document_count: i32,
    pub total_tokens: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Insertable, Serialize, Deserialize)]
#[diesel(table_name = crate::db::schema::knowledge_bases)]
pub struct NewKnowledgeBase {
    pub id: String,
    pub name: String,
    pub description: String,
    pub embedding_model: String,
    pub chunking_strategy: String,
}
```

注意：实际的 Diesel schema 需要通过 `diesel print-schema` 生成或手动定义。由于我们使用 SQL 迁移文件而非 Diesel 迁移，需手动创建 `src-tauri/src/db/schema.rs`。

`src-tauri/src/db/schema.rs`：

```rust
diesel::table! {
    knowledge_bases (id) {
        id -> Text,
        name -> Text,
        description -> Text,
        embedding_model -> Text,
        chunking_strategy -> Text,
        document_count -> Integer,
        total_tokens -> Integer,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    documents (id) {
        id -> Text,
        knowledge_base_id -> Text,
        title -> Text,
        file_name -> Text,
        file_path -> Text,
        file_type -> Text,
        file_size -> Integer,
        content_hash -> Text,
        chunk_count -> Integer,
        status -> Text,
        error_message -> Text,
        imported_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    chunks (id) {
        id -> Text,
        document_id -> Text,
        knowledge_base_id -> Text,
        chunk_index -> Integer,
        content -> Text,
        token_count -> Integer,
        char_start -> Integer,
        char_end -> Integer,
        heading_path -> Text,
        chunk_type -> Text,
        embedding_id -> Text,
        metadata -> Text,
    }
}

diesel::table! {
    conversations (id) {
        id -> Text,
        knowledge_base_id -> Text,
        title -> Text,
        llm_model -> Text,
        created_at -> Text,
        updated_at -> Text,
    }
}

diesel::table! {
    messages (id) {
        id -> Text,
        conversation_id -> Text,
        role -> Text,
        content -> Text,
        referenced_chunks -> Text,
        token_count -> Integer,
        created_at -> Text,
    }
}

diesel::table! {
    ollama_models (id) {
        id -> Text,
        model_type -> Text,
        size -> Integer,
        status -> Text,
        last_checked -> Text,
    }
}

diesel::table! {
    settings (key) {
        key -> Text,
        value -> Text,
        updated_at -> Text,
    }
}
```

- [ ] **Step 2: 创建知识库 CRUD 操作**

`src-tauri/src/db/knowledge_base.rs`:

```rust
use crate::db::models::{KnowledgeBase, NewKnowledgeBase};
use crate::db::{get_pool, schema::knowledge_bases};
use crate::errors::AppError;
use diesel::prelude::*;
use uuid::Uuid;

pub fn list() -> Result<Vec<KnowledgeBase>, AppError> {
    let pool = get_pool()?;
    let mut conn = pool.get().map_err(|e| AppError::db(e.to_string()))?;
    knowledge_bases::table
        .order(knowledge_bases::created_at.desc())
        .load::<KnowledgeBase>(&mut conn)
        .map_err(|e| AppError::db(e.to_string()))
}

pub fn get_by_id(id: &str) -> Result<KnowledgeBase, AppError> {
    let pool = get_pool()?;
    let mut conn = pool.get().map_err(|e| AppError::db(e.to_string()))?;
    knowledge_bases::table
        .find(id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(|e| match e {
            diesel::result::Error::NotFound => AppError::not_found(format!("Knowledge base {} not found", id)),
            _ => AppError::db(e.to_string()),
        })
}

pub fn create(name: &str, description: &str, embedding_model: &str, chunking_strategy: &str) -> Result<KnowledgeBase, AppError> {
    let pool = get_pool()?;
    let mut conn = pool.get().map_err(|e| AppError::db(e.to_string()))?;
    let id = Uuid::new_v4().to_string();
    let new_kb = NewKnowledgeBase {
        id,
        name: name.to_string(),
        description: description.to_string(),
        embedding_model: embedding_model.to_string(),
        chunking_strategy: chunking_strategy.to_string(),
    };
    diesel::insert_into(knowledge_bases::table)
        .values(&new_kb)
        .execute(&mut conn)
        .map_err(|e| AppError::db(e.to_string()))?;
    knowledge_bases::table
        .find(&new_kb.id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(|e| AppError::db(e.to_string()))
}

pub fn delete(id: &str) -> Result<(), AppError> {
    let pool = get_pool()?;
    let mut conn = pool.get().map_err(|e| AppError::db(e.to_string()))?;
    diesel::delete(knowledge_bases::table.find(id))
        .execute(&mut conn)
        .map_err(|e| AppError::db(e.to_string()))?;
    Ok(())
}

pub fn update(id: &str, name: Option<&str>, description: Option<&str>) -> Result<KnowledgeBase, AppError> {
    let pool = get_pool()?;
    let mut conn = pool.get().map_err(|e| AppError::db(e.to_string()))?;
    let target = knowledge_bases::table.find(id);
    if let Some(n) = name {
        diesel::update(target).set(knowledge_bases::name.eq(n))
            .execute(&mut conn).map_err(|e| AppError::db(e.to_string()))?;
    }
    if let Some(d) = description {
        diesel::update(target).set(knowledge_bases::description.eq(d))
            .execute(&mut conn).map_err(|e| AppError::db(e.to_string()))?;
    }
    knowledge_bases::table
        .find(id)
        .first::<KnowledgeBase>(&mut conn)
        .map_err(|e| AppError::db(e.to_string()))
}
```

- [ ] **Step 3: 创建 Tauri Commands**

`src-tauri/src/commands/knowledge_base.rs`:

```rust
use crate::db::knowledge_base;
use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize)]
pub struct KnowledgeBaseResponse {
    pub id: String,
    pub name: String,
    pub description: String,
    pub embedding_model: String,
    pub chunking_strategy: String,
    pub document_count: i32,
    pub total_tokens: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::db::models::KnowledgeBase> for KnowledgeBaseResponse {
    fn from(kb: crate::db::models::KnowledgeBase) -> Self {
        Self {
            id: kb.id,
            name: kb.name,
            description: kb.description,
            embedding_model: kb.embedding_model,
            chunking_strategy: kb.chunking_strategy,
            document_count: kb.document_count,
            total_tokens: kb.total_tokens,
            created_at: kb.created_at,
            updated_at: kb.updated_at,
        }
    }
}

#[derive(Deserialize)]
pub struct CreateKnowledgeBaseRequest {
    pub name: String,
    pub description: Option<String>,
    pub embedding_model: Option<String>,
    pub chunking_strategy: Option<String>,
}

#[tauri::command]
pub fn list_knowledge_bases() -> Result<Vec<KnowledgeBaseResponse>, AppError> {
    knowledge_base::list().map(|kbs| kbs.into_iter().map(KnowledgeBaseResponse::from).collect())
}

#[tauri::command]
pub fn get_knowledge_base(id: String) -> Result<KnowledgeBaseResponse, AppError> {
    knowledge_base::get_by_id(&id).map(KnowledgeBaseResponse::from)
}

#[tauri::command]
pub fn create_knowledge_base(request: CreateKnowledgeBaseRequest) -> Result<KnowledgeBaseResponse, AppError> {
    let description = request.description.unwrap_or_default();
    let embedding_model = request.embedding_model.unwrap_or_else(|| "nomic-embed-text".to_string());
    let chunking_strategy = request.chunking_strategy.unwrap_or_else(|| {
        r#"{"max_chunk_size":800,"min_chunk_size":100,"overlap":50,"heading_as_context":true}"#.to_string()
    });
    knowledge_base::create(&request.name, &description, &embedding_model, &chunking_strategy)
        .map(KnowledgeBaseResponse::from)
}

#[tauri::command]
pub fn delete_knowledge_base(id: String) -> Result<(), AppError> {
    knowledge_base::delete(&id)
}

#[tauri::command]
pub fn update_knowledge_base(id: String, name: Option<String>, description: Option<String>) -> Result<KnowledgeBaseResponse, AppError> {
    knowledge_base::update(&id, name.as_deref(), description.as_deref())
        .map(KnowledgeBaseResponse::from)
}
```

- [ ] **Step 4: 注册模块和 Commands**

`src-tauri/src/commands/mod.rs`:

```rust
pub mod knowledge_base;
```

`src-tauri/src/db/mod.rs`（更新）：

```rust
pub mod migrations;
pub mod models;
pub mod schema;
pub mod knowledge_base;

use diesel::sqlite::SqliteConnection;
use diesel::connection::SimpleConnection;
use diesel::r2d2::{self, ConnectionManager, Pool};
use std::sync::OnceLock;
use tauri::AppHandle;

type DbPool = Pool<ConnectionManager<SqliteConnection>>;

static DB_POOL: OnceLock<DbPool> = OnceLock::new();

pub fn init_database(app_handle: &AppHandle) -> Result<DbPool, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_dir.join("knowledge_base.db");
    let db_url = format!("sqlite://{}?rwc=true", db_path.display());

    let manager = ConnectionManager::<SqliteConnection>::new(&db_url);
    let pool = r2d2::Pool::builder()
        .max_size(10)
        .build(manager)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    {
        let conn = pool.get().map_err(|e| format!("Failed to get connection: {}", e))?;
        conn.batch_run(migrations::MIGRATIONS)
            .map_err(|e| format!("Failed to run migrations: {}", e))?;
    }

    DB_POOL.set(pool.clone()).map_err(|_| "Database already initialized".to_string())?;

    Ok(pool)
}

pub fn get_pool() -> Result<&'static DbPool, String> {
    DB_POOL.get().ok_or_else(|| "Database not initialized".to_string())
}
```

`src-tauri/src/lib.rs`（更新）：

```rust
mod db;
mod commands;
mod errors;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            db::init_database(&app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::knowledge_base::list_knowledge_bases,
            commands::knowledge_base::get_knowledge_base,
            commands::knowledge_base::create_knowledge_base,
            commands::knowledge_base::delete_knowledge_base,
            commands::knowledge_base::update_knowledge_base,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: 验证编译**

```bash
cd src-tauri && cargo check
```

Expected: 编译通过，无错误。可能需要根据 Diesel 实际 API 做小调整。

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: add knowledge-base CRUD operations with Rust backend and Tauri commands"
```

---

### Task 7: 前端知识库管理界面

**Files:**
- Create: `src/components/knowledge-base/KnowledgeBaseCard.tsx`
- Create: `src/components/knowledge-base/KnowledgeBaseList.tsx`
- Create: `src/components/knowledge-base/KnowledgeBaseOverview.tsx`
- Create: `src/components/knowledge-base/CreateKnowledgeBaseDialog.tsx`
- Modify: `src/components/layout/Sidebar.tsx`（接入真实数据）
- Modify: `src/App.tsx`（接入知识库页面）

- [ ] **Step 1: 创建知识库卡片组件**

`src/components/knowledge-base/KnowledgeBaseCard.tsx`:

```tsx
import type { KnowledgeBase } from '../../types/knowledge-base';
import { StatusBadge } from '../common/StatusBadge';
import { useNavigate } from 'react-router-dom';

interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase;
}

export function KnowledgeBaseCard({ knowledgeBase: kb }: KnowledgeBaseCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/kb/${kb.id}`)}
      className="w-full text-left p-4 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{kb.name}</h3>
        <StatusBadge status="ready" />
      </div>
      {kb.description && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-2">{kb.description}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        <span>{kb.document_count} 文档</span>
        <span>{kb.embedding_model}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: 创建创建知识库对话框**

`src/components/knowledge-base/CreateKnowledgeBaseDialog.tsx`:

```tsx
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { CreateKnowledgeBaseInput } from '../../types/knowledge-base';

interface CreateKnowledgeBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateKnowledgeBaseInput) => Promise<void>;
}

export function CreateKnowledgeBaseDialog({ open, onOpenChange, onSubmit }: CreateKnowledgeBaseDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-lg p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">新建知识库</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--color-text-secondary)]">
            创建一个新的知识库来管理你的文档
          </Dialog.Description>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入知识库名称"
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入知识库描述（可选）"
                rows={3}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
                >
                  取消
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 3: 创建知识库列表和概览页面**

`src/components/knowledge-base/KnowledgeBaseList.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { tauriCommand } from '../../hooks/useDatabase';
import { KnowledgeBaseCard } from './KnowledgeBaseCard';
import { CreateKnowledgeBaseDialog } from './CreateKnowledgeBaseDialog';
import type { KnowledgeBase, CreateKnowledgeBaseInput } from '../../types/knowledge-base';

export function KnowledgeBaseList() {
  const { knowledgeBases, setKnowledgeBases, addKnowledgeBase, loading, setLoading } = useKnowledgeBaseStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    setLoading(true);
    try {
      const kbs = await tauriCommand<KnowledgeBase[]>('list_knowledge_bases');
      setKnowledgeBases(kbs);
    } catch (err) {
      console.error('Failed to load knowledge bases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (input: CreateKnowledgeBaseInput) => {
    const kb = await tauriCommand<KnowledgeBase>('create_knowledge_base', { request: input });
    addKnowledgeBase(kb);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">知识库</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
        >
          新建知识库
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">加载中...</div>
      ) : knowledgeBases.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-secondary)]">还没有知识库</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
          >
            创建第一个知识库
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeBases.map((kb) => (
            <KnowledgeBaseCard key={kb.id} knowledgeBase={kb} />
          ))}
        </div>
      )}

      <CreateKnowledgeBaseDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
    </div>
  );
}
```

`src/components/knowledge-base/KnowledgeBaseOverview.tsx`:

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { tauriCommand } from '../../hooks/useDatabase';
import type { KnowledgeBase } from '../../types/knowledge-base';

export function KnowledgeBaseOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadKnowledgeBase();
  }, [id]);

  const loadKnowledgeBase = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await tauriCommand<KnowledgeBase>('get_knowledge_base', { id });
      setKb(data);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">加载中...</div>;
  if (!kb) return null;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">{kb.name}</h1>
      {kb.description && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{kb.description}</p>}

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold">{kb.document_count}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">文档</div>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold">{kb.total_tokens}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">Tokens</div>
        </div>
        <div className="p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold">{kb.embedding_model}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">Embedding模型</div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/kb/${id}/chat`)}
          className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
        >
          开始对话
        </button>
        <button
          onClick={() => navigate(`/kb/${id}/documents`)}
          className="px-4 py-2 text-sm rounded border hover:bg-gray-50"
        >
          管理文档
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 更新 App.tsx 和 Sidebar 接入真实数据**

更新 `src/App.tsx` 中的路由：

```tsx
import { KnowledgeBaseOverview } from './components/knowledge-base/KnowledgeBaseOverview';
// ... 其他导入不变

// 在 Routes 中更新:
<Route path="kb/:id" element={<KnowledgeBaseOverview />} />
```

更新 `Sidebar.tsx` 中加载知识库列表的 `useEffect`：

```tsx
// 在 Sidebar 组件中添加 useEffect 从后端加载知识库
useEffect(() => {
  const load = async () => {
    try {
      const kbs = await tauriCommand<KnowledgeBaseItem[]>('list_knowledge_bases');
      setKnowledgeBases(kbs);
    } catch (err) {
      console.error('Failed to load knowledge bases:', err);
    }
  };
  load();
}, []);
```

- [ ] **Step 5: 验证知识库创建/列表功能**

```bash
npm run tauri dev
```

Expected: 可以打开创建知识库对话框，输入名称创建，列表正常显示。

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: add knowledge-base management UI with create, list, and overview pages"
```

---

## 阶段1完成标准

- [ ] Tauri 2 + React 项目骨架运行正常
- [ ] SQLite 数据库初始化和迁移正确
- [ ] 所有 TypeScript 类型定义就位
- [ ] 前端路由和布局（侧边栏+内容区）正常工作
- [ ] 知识库 CRUD 通过 Tauri IPC 完整可用
- [ ] 知识库创建/列表/详情界面可用