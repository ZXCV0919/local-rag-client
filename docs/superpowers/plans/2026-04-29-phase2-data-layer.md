# 阶段2：数据层 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成所有 Rust 端数据模型 CRUD 操作、ChromaDB 集成、Ollama 连接检测，以及对应的前端管理界面。

**Architecture:** Rust 后端通过 Tauri Commands 暴露 CRUD 接口，TypeScript 前端通过 Zustand Store 和 invoke 调用。ChromaDB 作为 Python 子进程嵌入启动，Ollama 通过 HTTP API 检测连接状态。

**Tech Stack:** Diesel (Rust ORM), rusqlite, ChromaDB Python client, Ollama HTTP API

---

## File Structure

```
src-tauri/src/
├── db/
│   ├── mod.rs               (更新：添加新模块)
│   ├── schema.rs            (已有)
│   ├── models.rs            (更新：添加所有模型)
│   ├── knowledge_base.rs    (已有)
│   ├── document.rs          (新增)
│   ├── chunk.rs             (新增)
│   ├── conversation.rs      (新增)
│   ├── settings.rs          (新增)
├── services/
│   ├── mod.rs               (新增)
│   ├── ollama.rs            (新增)
│   └── chromadb.rs          (新增)
├── commands/
│   ├── mod.rs               (更新：注册所有命令)
│   ├── knowledge_base.rs    (已有)
│   ├── document.rs          (新增)
│   ├── chat.rs              (新增)
│   ├── ollama.rs            (新增)
│   └── settings.rs          (新增)
src/
├── components/
│   ├── document/
│   │   ├── DocumentList.tsx
│   │   └── DocumentCard.tsx
│   ├── chat/
│   │   └── ConversationList.tsx
│   └── settings/
│       └── OllamaStatus.tsx
├── hooks/
│   ├── useOllama.ts         (新增)
│   └── useDocument.ts       (新增)
└── store/
    ├── document.ts          (新增)
    └── chat.ts              (新增)
```

---

### Task 1: 完善数据模型与所有 CRUD 操作

**Files:**
- Update: `src-tauri/src/db/models.rs`
- Create: `src-tauri/src/db/document.rs`
- Create: `src-tauri/src/db/chunk.rs`
- Create: `src-tauri/src/db/conversation.rs`
- Create: `src-tauri/src/db/settings.rs`
- Update: `src-tauri/src/db/mod.rs`

- [ ] **Step 1: 扩展 Diesel 模型定义**

更新 `src-tauri/src/db/models.rs`，添加 Document, Chunk, Conversation, Message, Settings 模型。每个模型包含 `Queryable` (读取) 和 `Insertable` (写入) 两个派生结构体，所有字段使用 `String`/`i32` 类型（SQLite 不支持原生 datetime，TEXT 存 ISO 字符串）。

关键模型要点：
- `Document` 包含 `status` 字段（`pending`/`processing`/`ready`/`error`），`content_hash` 用于增量检测
- `Chunk` 包含 `heading_path`、`char_start`/`char_end`、`chunk_type`，`embedding_id` 关联到 ChromaDB
- `Message` 的 `referenced_chunks` 是 JSON 数组字符串
- `Settings` 是 KV 存储，`value` 是 JSON 字符串

- [ ] **Step 2: 实现文档 CRUD (`document.rs`)**

```rust
pub fn create(kb_id: &str, title: &str, file_name: &str, file_path: &str, file_type: &str, file_size: i32, content_hash: &str) -> Result<Document, AppError>
pub fn get_by_id(id: &str) -> Result<Document, AppError>
pub fn list_by_knowledge_base(kb_id: &str) -> Result<Vec<Document>, AppError>
pub fn update_status(id: &str, status: &str, error_message: Option<&str>) -> Result<Document, AppError>
pub fn update_chunk_count(id: &str, count: i32) -> Result<Document, AppError>
pub fn delete(id: &str) -> Result<(), AppError>
pub fn find_by_hash(kb_id: &str, content_hash: &str) -> Result<Option<Document>, AppError>
```

- [ ] **Step 3: 实现分块 CRUD (`chunk.rs`)**

```rust
pub fn create_bulk(chunks: Vec<NewChunk>) -> Result<Vec<Chunk>, AppError>  // 批量插入
pub fn list_by_document(doc_id: &str) -> Result<Vec<Chunk>, AppError>
pub fn list_by_knowledge_base(kb_id: &str) -> Result<Vec<Chunk>, AppError>
pub fn get_by_id(id: &str) -> Result<Chunk, AppError>
pub fn update_embedding_id(id: &str, embedding_id: &str) -> Result<(), AppError>
pub fn delete_by_document(doc_id: &str) -> Result<(), AppError>
pub fn delete_by_knowledge_base(kb_id: &str) -> Result<(), AppError>
pub fn search_fulltext(kb_id: &str, query: &str, limit: i32) -> Result<Vec<Chunk>, AppError>   // FTS5 搜索
```

- [ ] **Step 4: 实现对话和消息 CRUD (`conversation.rs`)**

```rust
// 对话
pub fn create(kb_id: &str, title: &str, llm_model: &str) -> Result<Conversation, AppError>
pub fn get_by_id(id: &str) -> Result<Conversation, AppError>
pub fn list_by_knowledge_base(kb_id: &str) -> Result<Vec<Conversation>, AppError>
pub fn update_title(id: &str, title: &str) -> Result<Conversation, AppError>
pub fn delete(id: &str) -> Result<(), AppError>

// 消息
pub fn add_message(conv_id: &str, role: &str, content: &str, referenced_chunks: &str, token_count: i32) -> Result<Message, AppError>
pub fn list_by_conversation(conv_id: &str) -> Result<Vec<Message>, AppError>
pub fn get_recent_messages(conv_id: &str, limit: i32) -> Result<Vec<Message>, AppError>   // 滑动窗口
```

- [ ] **Step 5: 实现设置 CRUD (`settings.rs`)**

```rust
pub fn get(key: &str) -> Result<Option<String>, AppError>
pub fn set(key: &str, value: &str) -> Result<(), AppError>
pub fn get_all() -> Result<HashMap<String, String>, AppError>
pub fn delete(key: &str) -> Result<(), AppError>
```

- [ ] **Step 6: 更新 db/mod.rs 注册新模块**

```rust
pub mod migrations;
pub mod models;
pub mod schema;
pub mod knowledge_base;
pub mod document;
pub mod chunk;
pub mod conversation;
pub mod settings;
```

- [ ] **Step 7: 验证编译**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 8: 提交**

```bash
git add .
git commit -m "feat: add all data model CRUD operations for documents, chunks, conversations and settings"
```

---

### Task 2: Ollama 服务层

**Files:**
- Create: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/ollama.rs`
- Create: `src-tauri/src/commands/ollama.rs`
- Update: `src-tauri/src/commands/mod.rs`
- Update: `src-tauri/src/lib.rs`

- [ ] **Step 1: 实现 Ollama 状态检测和服务管理**

`src-tauri/src/services/ollama.rs`:

```rust
use reqwest;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
    pub connected: bool,
    pub url: String,
    pub models: Vec<OllamaModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub model_type: String,  // "embedding" or "chat"
    pub size: i64,
    pub parameter_size: String,
}

pub struct OllamaService {
    url: String,
    client: reqwest::Client,
}

impl OllamaService {
    pub fn new(url: &str) -> Self {
        Self {
            url: url.to_string(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    pub async fn check_status(&self) -> OllamaStatus {
        match self.client.get(format!("{}/api/tags", self.url)).send().await {
            Ok(resp) if resp.status().is_success() => {
                let tags: serde_json::Value = resp.json().await.unwrap_or_default();
                let models = self.parse_models(&tags);
                OllamaStatus {
                    connected: true,
                    url: self.url.clone(),
                    models,
                }
            }
            _ => OllamaStatus {
                connected: false,
                url: self.url.clone(),
                models: vec![],
            },
        }
    }

    pub async fn list_models(&self) -> Result<Vec<OllamaModel>, String> {
        let resp = self.client
            .get(format!("{}/api/tags", self.url))
            .send()
            .await
            .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Ollama returned status: {}", resp.status()));
        }

        let tags: serde_json::Value = resp.json().await.map_err(|e| format!("Failed to parse response: {}", e))?;
        Ok(self.parse_models(&tags))
    }

    pub async fn get_model_info(&self, name: &str) -> Result<serde_json::Value, String> {
        let resp = self.client
            .post(format!("{}/api/show", self.url))
            .json(&serde_json::json!({ "name": name }))
            .send()
            .await
            .map_err(|e| format!("Failed to get model info: {}", e))?;
        resp.json().await.map_err(|e| format!("Failed to parse response: {}", e))
    }

    fn parse_models(&self, tags: &serde_json::Value) -> Vec<OllamaModel> {
        tags.get("models")
            .and_then(|m| m.as_array())
            .map(|arr| {
                arr.iter().filter_map(|m| {
                    let name = m.get("name")?.as_str()?.to_string();
                    let size = m.get("size")?.as_i64().unwrap_or(0);
                    // 简单判断模型类型：包含 embed 的为 embedding，否则为 chat
                    let model_type = if name.contains("embed") { "embedding".to_string() } else { "chat".to_string() };
                    let details = m.get("details");
                    let parameter_size = details
                        .and_then(|d| d.get("parameter_size"))
                        .and_then(|p| p.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    Some(OllamaModel { name, model_type, size, parameter_size })
                }).collect()
            })
            .unwrap_or_default()
    }
}
```

- [ ] **Step 2: 创建 Ollama Tauri Commands**

`src-tauri/src/commands/ollama.rs`:

```rust
use crate::services::ollama::OllamaService;
use crate::errors::AppError;
use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

pub struct OllamaState(pub Mutex<OllamaService>);

#[derive(Serialize)]
pub struct OllamaStatusResponse {
    pub connected: bool,
    pub url: String,
    pub model_count: usize,
    pub models: Vec<OllamaModelResponse>,
}

#[derive(Serialize)]
pub struct OllamaModelResponse {
    pub name: String,
    pub model_type: String,
    pub size: i64,
    pub parameter_size: String,
}

#[tauri::command]
pub async fn check_ollama_status(state: State<'_, OllamaState>) -> Result<OllamaStatusResponse, AppError> {
    let service = state.0.lock().map_err(|e| AppError::internal(e.to_string()))?;
    let status = service.check_status().await;
    Ok(OllamaStatusResponse {
        connected: status.connected,
        url: status.url,
        model_count: status.models.len(),
        models: status.models.into_iter().map(|m| OllamaModelResponse {
            name: m.name,
            model_type: m.model_type,
            size: m.size,
            parameter_size: m.parameter_size,
        }).collect(),
    })
}

#[tauri::command]
pub async fn list_ollama_models(state: State<'_, OllamaState>) -> Result<Vec<OllamaModelResponse>, AppError> {
    let service = state.0.lock().map_err(|e| AppError::internal(e.to_string()))?;
    let models = service.list_models().await.map_err(|e| AppError::internal(e))?;
    Ok(models.into_iter().map(|m| OllamaModelResponse {
        name: m.name,
        model_type: m.model_type,
        size: m.size,
        parameter_size: m.parameter_size,
    }).collect())
}

#[tauri::command]
pub async fn get_ollama_model_info(state: State<'_, OllamaState>, name: String) -> Result<serde_json::Value, AppError> {
    let service = state.0.lock().map_err(|e| AppError::internal(e.to_string()))?;
    service.get_model_info(&name).await.map_err(|e| AppError::internal(e))
}
```

- [ ] **Step 3: 注册 Ollama 状态到 Tauri**

更新 `src-tauri/src/lib.rs`：

```rust
use commands::ollama::OllamaState;
use services::ollama::OllamaService;

// 在 run() 函数的 setup 之前添加 .manage()
.manage(OllamaState(Mutex::new(OllamaService::new("http://localhost:11434"))))

// 在 invoke_handler 中注册
commands::ollama::check_ollama_status,
commands::ollama::list_ollama_models,
commands::ollama::get_ollama_model_info,
```

- [ ] **Step 4: 验证编译**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add Ollama service layer with status check and model listing"
```

---

### Task 3: 文档与对话 Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/document.rs`
- Create: `src-tauri/src/commands/chat.rs`
- Create: `src-tauri/src/commands/settings.rs`
- Update: `src-tauri/src/commands/mod.rs`
- Update: `src-tauri/src/lib.rs`

- [ ] **Step 1: 实现文档 Commands**

`src-tauri/src/commands/document.rs` 包含：
- `import_document(kb_id, file_path, file_name, file_type, file_size, content_hash)` → 创建文档记录，status=pending
- `list_documents(kb_id)` → 列出知识库下所有文档
- `get_document(id)` → 获取文档详情
- `update_document_status(id, status, error_message)` → 更新文档状态
- `delete_document(id)` → 删除文档及其所有分块

每个 Command 调用 `db::document` 和 `db::chunk` 中对应的 CRUD 函数。删除文档时同步调用 `chromadb.delete_documents`（如果 ChromaDB 可用）。

- [ ] **Step 2: 实现对话 Commands**

`src-tauri/src/commands/chat.rs` 包含：
- `create_conversation(kb_id, title, llm_model)` → 创建新对话
- `list_conversations(kb_id)` → 列出知识库下所有对话
- `get_conversation(id)` → 获取对话详情及其消息
- `add_message(conversation_id, role, content, referenced_chunks, token_count)` → 添加消息
- `list_messages(conversation_id)` → 获取对话的全部消息
- `delete_conversation(id)` → 删除对话

- [ ] **Step 3: 实现设置 Commands**

`src-tauri/src/commands/settings.rs` 包含：
- `get_setting(key)` → 获取单项设置
- `get_all_settings()` → 获取所有设置
- `set_setting(key, value)` → 更新设置

- [ ] **Step 4: 更新 commands/mod.rs 和 lib.rs 注册所有命令**

```rust
// commands/mod.rs
pub mod knowledge_base;
pub mod document;
pub mod chat;
pub mod ollama;
pub mod settings;

// lib.rs invoke_handler 中添加所有新命令
```

- [ ] **Step 5: 验证编译**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: add Tauri commands for documents, conversations, and settings"
```

---

### Task 4: 前端数据 Store 与 Hooks

**Files:**
- Create: `src/store/document.ts`
- Create: `src/store/chat.ts`
- Create: `src/hooks/useDocument.ts`
- Create: `src/hooks/useOllama.ts`

- [ ] **Step 1: 创建文档 Store**

`src/store/document.ts`:

```typescript
import { create } from 'zustand';
import type { Document, ImportProgress } from '../types/document';

interface DocumentState {
  documents: Document[];
  currentDocumentId: string | null;
  importProgress: Map<string, ImportProgress>;
  loading: boolean;
  error: string | null;
  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  setImportProgress: (id: string, progress: ImportProgress) => void;
  removeImportProgress: (id: string) => void;
  setCurrentDocumentId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  currentDocumentId: null,
  importProgress: new Map(),
  loading: false,
  error: null,
  setDocuments: (docs) => set({ documents: docs }),
  addDocument: (doc) => set((state) => ({ documents: [...state.documents, doc] })),
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      currentDocumentId: state.currentDocumentId === id ? null : state.currentDocumentId,
    })),
  setImportProgress: (id, progress) =>
    set((state) => {
      const newMap = new Map(state.importProgress);
      newMap.set(id, progress);
      return { importProgress: newMap };
    }),
  removeImportProgress: (id) =>
    set((state) => {
      const newMap = new Map(state.importProgress);
      newMap.delete(id);
      return { importProgress: newMap };
    }),
  setCurrentDocumentId: (id) => set({ currentDocumentId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 2: 创建对话 Store**

`src/store/chat.ts`:

```typescript
import { create } from 'zustand';
import type { Conversation, Message } from '../types/conversation';

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  streamingMessage: string | null;
  loading: boolean;
  error: string | null;
  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  removeConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setStreamingMessage: (content: string | null) => void;
  appendStreamingMessage: (chunk: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  currentConversationId: null,
  messages: [],
  streamingMessage: null,
  loading: false,
  error: null,
  setConversations: (convs) => set({ conversations: convs }),
  addConversation: (conv) => set((state) => ({ conversations: [conv, ...state.conversations] })),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
    })),
  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    })),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStreamingMessage: (content) => set({ streamingMessage: content }),
  appendStreamingMessage: (chunk) =>
    set((state) => ({
      streamingMessage: (state.streamingMessage || '') + chunk,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 3: 创建文档和 Ollama Hooks**

`src/hooks/useDocument.ts`:

```typescript
import { useCallback } from 'react';
import { tauriCommand } from './useDatabase';
import { useDocumentStore } from '../store/document';
import type { Document, ImportProgress } from '../types/document';

export function useDocument(kbId: string) {
  const store = useDocumentStore();

  const loadDocuments = useCallback(async () => {
    store.setLoading(true);
    try {
      const docs = await tauriCommand<Document[]>('list_documents', { kbId });
      store.setDocuments(docs);
    } catch (err) {
      store.setError(String(err));
    } finally {
      store.setLoading(false);
    }
  }, [kbId]);

  const importDocument = useCallback(async (filePath: string, fileName: string, fileType: string, fileSize: number, contentHash: string) => {
    const doc = await tauriCommand<Document>('import_document', {
      kbId,
      filePath,
      fileName,
      fileType,
      fileSize,
      contentHash,
    });
    store.addDocument(doc);
    return doc;
  }, [kbId]);

  const deleteDocument = useCallback(async (id: string) => {
    await tauriCommand<void>('delete_document', { id });
    store.removeDocument(id);
  }, []);

  return { ...store, loadDocuments, importDocument, deleteDocument };
}
```

`src/hooks/useOllama.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { tauriCommand } from './useDatabase';
import type { OllamaModel } from '../types/ollama';

interface OllamaStatusResult {
  connected: boolean;
  url: string;
  modelCount: number;
  models: OllamaModel[];
}

export function useOllama() {
  const [status, setStatus] = useState<OllamaStatusResult | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tauriCommand<OllamaStatusResult>('check_ollama_status');
      setStatus(result);
    } catch {
      setStatus({ connected: false, url: '', modelCount: 0, models: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return { status, loading, checkStatus };
}
```

- [ ] **Step 4: 更新 Store 索引**

```typescript
// src/store/index.ts
export { useKnowledgeBaseStore } from './knowledge-base';
export { useSettingsStore } from './settings';
export { useDocumentStore } from './document';
export { useChatStore } from './chat';
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add frontend stores for documents and chat, plus Ollama hook"
```

---

### Task 5: 文档管理界面

**Files:**
- Create: `src/components/document/DocumentList.tsx`
- Create: `src/components/document/DocumentCard.tsx`
- Update: `src/App.tsx`

- [ ] **Step 1: 创建文档卡片组件**

`src/components/document/DocumentCard.tsx`:

- 展示文档名称、文件类型图标、分块数、状态标签(StatusBadge)
- 处理中显示进度条
- 错误状态显示错误信息
- 操作按钮：查看详情、重新处理、删除

- [ ] **Step 2: 创建文档列表页面**

`src/components/document/DocumentList.tsx`:

- 从路由参数获取 `kbId`
- 调用 `useDocument(kbId).loadDocuments()` 加载文档列表
- 拖拽区域：支持拖拽文件导入（使用 Tauri 的文件选择器作为降级）
- 支持选择多个文件（PDF/MD/TXT/DOCX）
- 调用 `useDocument.importDocument()` 创建文档记录
- 显示导入进度
- 空状态引导

- [ ] **Step 3: 更新 App.tsx 注册文档路由**

```tsx
import { DocumentList } from './components/document/DocumentList';
// 更新路由：
<Route path="kb/:id/documents" element={<DocumentList />} />
```

- [ ] **Step 4: 验证文档列表界面**

```bash
npm run tauri dev
```

Expected: 进入知识库 → 管理文档 → 空状态 → 选择文件（文件选择器打开，暂不处理文件内容）

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add document list UI with card component and file import trigger"
```

---

### Task 6: ChromaDB 嵌入式集成服务

**Files:**
- Create: `src-tauri/src/services/chromadb.rs`
- Update: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/commands/chromadb.rs`
- Update: `src-tauri/src/commands/mod.rs`
- Update: `src-tauri/src/lib.rs`

- [ ] **Step 1: 实现 ChromaDB 进程管理**

`src-tauri/src/services/chromadb.rs`:

核心逻辑：
1. `find_available_port()`: 在 8100-8200 范围内寻找可用端口
2. `is_chromadb_running()`: 尝试连接端口，检查 `GET /api/v1/heartbeat`
3. `start_chromadb()`: 启动 `python -m chromadb.server --host 127.0.0.1 --port {port}` 作为子进程
4. `stop_chromadb()`: 优雅关闭子进程
5. `health_check()`: 定期检查 ChromaDB 心跳
6. 进程崩溃自动重启（最多 3 次，间隔 5s）

使用 `std::process::Command` 启动子进程，`tokio::process::Child` 进行异步管理。

数据目录配置：`{app_data}/chroma_db`

- [ ] **Step 2: 实现 ChromaDB 操作封装**

```rust
impl ChromaDBService {
    pub async fn create_collection(&self, kb_id: &str) -> Result<String, String>
    pub async fn delete_collection(&self, kb_id: &str) -> Result<(), String>
    pub async fn add_documents(&self, collection_id: &str, ids: Vec<String>, documents: Vec<String>, embeddings: Vec<Vec<f32>>, metadatas: Vec<serde_json::Value>) -> Result<(), String>
    pub async fn query(&self, collection_id: &str, embedding: Vec<f32>, n_results: i32) -> Result<QueryResult, String>
    pub async fn delete_documents(&self, collection_id: &str, ids: Vec<String>) -> Result<(), String>
    pub async fn keyword_search(&self, collection_id: &str, query: &str, n_results: i32) -> Result<Vec<SearchResult>, String>
}
```

所有操作通过 HTTP 调用 ChromaDB REST API。

- [ ] **Step 3: 创建 ChromaDB Tauri Commands**

```rust
#[tauri::command]
pub async fn start_chromadb(state: State<'_, ChromaDBState>) -> Result<ChromaDBStatus, AppError>

#[tauri::command]
pub async fn stop_chromadb(state: State<'_, ChromaDBState>) -> Result<(), AppError>

#[tauri::command]
pub async fn get_chromadb_status(state: State<'_, ChromaDBState>) -> Result<ChromaDBStatus, AppError>
```

- [ ] **Step 4: 注册到 Tauri 应用**

在 `lib.rs` 的 setup 中自动启动 ChromaDB，注册 `ChromaDBState` 和所有 Commands。

- [ ] **Step 5: 前端 Ollama 状态组件**

`src/components/settings/OllamaStatus.tsx`:

- 显示 Ollama 连接状态（状态指示灯）
- 显示可用模型列表，分为 embedding 和 chat 两组
- "检测连接" 按钮
- 简单的状态展示界面，完整管理功能在阶段7

- [ ] **Step 6: 验证 ChromaDB 启动**

```bash
npm run tauri dev
```

Expected: 应用启动时自动检测/启动 ChromaDB，设置页面显示状态。

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: add ChromaDB embedded integration with auto-start and health check"
```

---

## 阶段2完成标准

- [ ] 所有数据模型 CRUD 操作通过 Tauri Commands 可用
- [ ] Ollama 连接检测工作正常，可列出模型
- [ ] ChromaDB 可自动启动/检测/健康检查
- [ ] 文档管理界面可显示空状态和文件选择器
- [ ] 设置页面显示 Ollama 连接状态
- [ ] 所有 Rust 端代码编译通过，前端无 TS 错误