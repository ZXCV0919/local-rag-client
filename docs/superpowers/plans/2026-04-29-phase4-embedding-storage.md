# 阶段4：向量化与存储 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Embedding 向量化管线，将分块文本通过 Ollama Embedding API 转为向量并存入 ChromaDB，完成文档从导入到可检索的全流程。

**Architecture:** 前端 TypeScript 调用 Ollama HTTP API 进行 Embedding，批量并发控制（5个一组），每个 chunk 完成后更新 SQLite embedding_id 和 ChromaDB 记录。Rust 侧提供 ChromaDB 操作的 Command 封装。

**Tech Stack:** Ollama Embedding API, ChromaDB REST API

---

## File Structure

```
src/
├── services/
│   ├── embedding/
│   │   ├── index.ts           (Embedding 服务入口)
│   │   └── batch-queue.ts      (批量+并发控制)
├── components/
│   └── document/
│       └── EmbeddingProgress.tsx (新增：向量化进度)
src-tauri/src/
├── services/
│   └── chromadb.rs            (更新：添加文档操作)
├── commands/
│   └── chromadb.rs            (更新：添加 Tauri Commands)
```

---

### Task 1: Embedding 服务

**Files:**
- Create: `src/services/embedding/index.ts`
- Create: `src/services/embedding/batch-queue.ts`

- [ ] **Step 1: 实现 Embedding 调用**

`src/services/embedding/index.ts`:

```typescript
const OLLAMA_EMBED_URL = '/api/embed';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export async function getEmbedding(
  text: string,
  model: string = 'nomic-embed-text',
  ollamaUrl: string = 'http://localhost:11434'
): Promise<EmbeddingResult> {
  const response = await fetch(`${ollamaUrl}${OLLAEMBED_URL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
    embedding: data.embeddings[0],
    model: data.model,
  };
}

export async function getEmbeddings(
  texts: string[],
  model: string = 'nomic-embed-text',
  ollamaUrl: string = 'http://localhost:11434'
): Promise<number[][]> {
  const response = await fetch(`${ollamaUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!response.ok) {
    throw new Error(`Batch embedding failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.embeddings;
}
```

- [ ] **Step 2: 实现批量并发控制**

`src/services/embedding/batch-queue.ts`:

核心逻辑：
- 维护一个待处理队列
- 并发数限制为 5（每次向 Ollama 发送5个文本的批量请求）
- 指数退避重试（最多3次，间隔 1s/2s/4s）
- 进度回调：每完成一个 batch，通知前端更新进度
- 取消支持：通过 AbortController

```typescript
import { getEmbeddings } from './index';

export interface BatchEmbeddingProgress {
  completed: number;
  total: number;
  currentFile?: string;
  failedChunks: string[];
}

export class EmbeddingBatchQueue {
  private concurrency: number;
  private maxRetries: number;
  private abortController: AbortController | null = null;

  constructor(concurrency: number = 5, maxRetries: number = 3) {
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async processBatch(
    chunks: Array<{ id: string; content: string }>,
    model: string,
    ollamaUrl: string,
    onProgress?: (progress: BatchEmbeddingProgress) => void
  ): Promise<Map<string, number[]>> {
    this.abortController = new AbortController();
    const result = new Map<string, number[]>();
    const failedChunks: string[] = [];
    let completed = 0;
    const total = chunks.length;

    for (let i = 0; i < chunks.length; i += this.concurrency) {
      if (this.abortController.signal.aborted) break;

      const batch = chunks.slice(i, i + this.concurrency);
      const texts = batch.map(c => c.content);
      const ids = batch.map(c => c.id);

      let embeddings: number[][] | null = null;
      for (let retry = 0; retry < this.maxRetries; retry++) {
        try {
          embeddings = await getEmbeddings(texts, model, ollamaUrl);
          break;
        } catch (err) {
          if (retry === this.maxRetries - 1) {
            failedChunks.push(...ids);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retry) * 1000));
        }
      }

      if (embeddings) {
        for (let j = 0; j < ids.length; j++) {
          result.set(ids[j], embeddings[j]);
        }
      }

      completed += batch.length;
      onProgress?.({ completed, total, failedChunks: [...failedChunks] });
    }

    return result;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add embedding service with batch queue and concurrency control"
```

---

### Task 2: ChromaDB 向量存储操作

**Files:**
- Update: `src-tauri/src/services/chromadb.rs`
- Update: `src-tauri/src/commands/chromadb.rs`

- [ ] **Step 1: 扩展 ChromaDB 服务添加文档操作方法**

在 `chromadb.rs` 中添加：

```rust
impl ChromaDBService {
    pub async fn add_to_collection(
        &self,
        collection_name: &str,
        ids: Vec<String>,
        documents: Vec<String>,
        embeddings: Vec<Vec<f32>>,
        metadatas: Vec<HashMap<String, String>>,
    ) -> Result<(), String> {
        // POST /api/v1/collections/{collection_name}/add
        // body: { ids, documents, embeddings, metadatas }
    }

    pub async fn query_collection(
        &self,
        collection_name: &str,
        query_embeddings: Vec<f32>,
        n_results: u32,
    ) -> Result<QueryResult, String> {
        // POST /api/v1/collections/{collection_name}/query
        // body: { query_embeddings, n_results, include: ["documents", "metadatas", "distances"] }
    }

    pub async fn delete_from_collection(
        &self,
        collection_name: &str,
        ids: Vec<String>,
    ) -> Result<(), String> {
        // POST /api/v1/collections/{collection_name}/delete
        // body: { ids }
    }

    pub async fn get_collection_count(&self, collection_name: &str) -> Result<u32, String> {
        // GET /api/v1/collections/{collection_name}/count
    }
}
```

- [ ] **Step 2: 添加 ChromaDB Tauri Commands**

```rust
#[tauri::command]
pub async fn chromadb_add_documents(
    state: State<'_, ChromaDBState>,
    collection_name: String,
    ids: Vec<String>,
    documents: Vec<String>,
    embeddings: Vec<Vec<f32>>,
    metadatas: Vec<HashMap<String, String>>,
) -> Result<(), AppError>

#[tauri::command]
pub async fn chromadb_query(
    state: State<'_, ChromaDBState>,
    collection_name: String,
    query_embedding: Vec<f32>,
    n_results: u32,
) -> Result<QueryResult, AppError>

#[tauri::command]
pub async fn chromadb_delete_documents(
    state: State<'_, ChromaDBState>,
    collection_name: String,
    ids: Vec<String>,
) -> Result<(), AppError>
```

- [ ] **Step 3: 验证编译**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add ChromaDB document storage, query, and delete operations"
```

---

### Task 3: 向量化管线集成

**Files:**
- Update: `src/services/importer/index.ts`（集成 embedding 步骤）
- Create: `src/components/document/EmbeddingProgress.tsx`
- Update: `src/components/document/DocumentList.tsx`（显示向量化进度）

- [ ] **Step 1: 扩展导入管线添加 Embedding 步骤**

在 `importer/index.ts` 中增加步骤：

```
原流程:
  选择文件 → 创建文档记录 → 解析 → 分块 → 写入SQLite

新流程:
  选择文件 → 创建文档记录 → 解析 → 分块 → 写入SQLite → Embedding → 写入ChromaDB → 更新状态为ready
```

关键逻辑：
1. 分块完成后，收集所有 chunk 的 content
2. 调用 EmbeddingBatchQueue.processBatch() 批量向量化
3. 每批完成后，调用 chromadb_add_documents 写入 ChromaDB
4. 所有 embedding 完成后，更新文档 status 为 'ready'
5. 进度回调更新前端状态

- [ ] **Step 2: 创建向量化进度组件**

`src/components/document/EmbeddingProgress.tsx`:

- 显示向量化进度条（已完成/总数）
- 显示已失败的分块数量
- 支持「取消向量化」按钮
- 状态：等待中 → 向量化中 → 完成/部分失败

- [ ] **Step 3: 更新 DocumentList 集成向量化进度**

在 DocumentCard 中展示不同的状态进度：
- pending → 解析中
- processing → 分块+向量化中（带进度）
- ready → 就绪
- error → 错误信息 + 重试按钮

- [ ] **Step 4: 端到端测试**

测试流程：创建知识库 → 导入文档 → 确认解析成功 → 确认分块生成 → 确认向量化完成 → 确认文档状态为 ready

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: integrate embedding pipeline with progress tracking and ChromaDB storage"
```

---

### Task 4: Ollama 模型管理增强

**Files:**
- Update: `src-tauri/src/services/ollama.rs`（添加模型下载）
- Update: `src-tauri/src/commands/ollama.rs`（添加下载命令）
- Create: `src/components/settings/OllamaModelList.tsx`

- [ ] **Step 1: 添加模型下载和删除方法**

在 `ollama.rs` 中：

```rust
pub async fn pull_model(&self, name: &str) -> Result<impl Stream<Item = Result<serde_json::Value, String>>, String> {
    // POST /api/pull { name, stream: true }
    // 返回流式响应，包含下载进度
}

pub async fn delete_model(&self, name: &str) -> Result<(), String> {
    // DELETE /api/delete { name }
}
```

下载进度通过 Tauri events 推送：`ollama:model-downloading`

- [ ] **Step 2: 添加 Tauri Commands**

```rust
#[tauri::command]
pub async fn pull_ollama_model(state: State<'_, OllamaState>, name: String, app: AppHandle) -> Result<(), AppError>

#[tauri::command]
pub async fn delete_ollama_model(state: State<'_, OllamaState>, name: String) -> Result<(), AppError>
```

- [ ] **Step 3: 创建模型列表组件**

`src/components/settings/OllamaModelList.tsx`:

- 分类显示 embedding 模型和 chat 模型
- 每个模型显示：名称、参数量、大小
- 「下载模型」按钮（输入模型名称）
- 下载进度条
- 「删除模型」按钮（带确认）
- Embedding 模型设置为默认，Chat 模型设置为默认

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add Ollama model management with download, delete, and categorization"
```

---

## 阶段4完成标准

- [ ] 分块文本可以通过 Ollama Embedding API 成功向量化
- [ ] 向量化结果正确存入 ChromaDB
- [ ] 批量向量化有进度追踪，支持取消
- [ ] 失败重试机制工作正常
- [ ] 文档导入完整流程：选择文件 → 解析 → 分块 → 向量化 → 存入向量库 → 状态为 ready
- [ ] Ollama 模型列表可正常展示和分类