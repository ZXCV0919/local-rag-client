# 阶段5：检索引擎 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现语义检索和关键词全文搜索双模式，以及向量优先+关键词重排的融合策略，让用户可以通过不同方式查询知识库。

**Architecture:** 检索引擎全部在 TypeScript 侧实现。向量检索通过 ChromaDB REST API 完成，关键词搜索通过 SQLite FTS5（通过 Tauri Command）完成，融合重排在 TS 侧计算。

**Tech Stack:** ChromaDB Vector Search, SQLite FTS5, TypeScript fusion algorithm

---

## File Structure

```
src/
├── services/
│   ├── retrieval/
│   │   ├── index.ts           (检索引擎入口)
│   │   ├── vector-search.ts   (向量检索)
│   │   ├── keyword-search.ts  (关键词搜索)
│   │   └── reranker.ts        (融合重排)
src-tauri/src/
├── commands/
│   └── search.rs              (新增：FTS5搜索命令)
```

---

### Task 1: 向量检索服务

**Files:**
- Create: `src/services/retrieval/vector-search.ts`

- [ ] **Step 1: 实现向量检索**

`src/services/retrieval/vector-search.ts`:

```typescript
import { tauriCommand } from '../../hooks/useDatabase';

export interface VectorSearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  heading_path: string;
  file_name: string;
  score: number;      // 余弦相似度
  metadata: Record<string, string>;
}

export interface VectorSearchParams {
  knowledge_base_id: string;
  query_embedding: number[];
  n_results: number;
}

export async function vectorSearch(
  collection_name: string,
  query_embedding: number[],
  n_results: number = 20
): Promise<VectorSearchResult[]> {
  const result = await tauriCommand<{
    ids: string[][],
    documents: string[][],
    metadatas: Record<string, string>[][],
    distances: number[][],
  }>('chromadb_query', {
    collectionName: `kb_${collection_name}`,
    queryEmbedding: query_embedding,
    nResults: n_results,
  });

  // ChromaDB 返回 distances 是余弦距离，需要转换为相似度
  // cosine_similarity = 1 - cosine_distance
  const results: VectorSearchResult[] = [];
  for (let i = 0; i < result.ids[0].length; i++) {
    results.push({
      chunk_id: result.ids[0][i],
      document_id: result.metadatas[0][i]?.document_id || '',
      content: result.documents[0][i],
      heading_path: result.metadatas[0][i]?.heading_path || '',
      file_name: result.metadatas[0][i]?.file_name || '',
      score: 1 - result.distances[0][i],
      metadata: result.metadatas[0][i] || {},
    });
  }

  return results;
}
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat: add vector search service with ChromaDB query integration"
```

---

### Task 2: 关键词搜索服务

**Files:**
- Create: `src/services/retrieval/keyword-search.ts`
- Create: `src-tauri/src/commands/search.rs`
- Update: `src-tauri/src/commands/mod.rs`
- Update: `src-tauri/src/lib.rs`

- [ ] **Step 1: 实现 Rust 端 FTS5 搜索命令**

`src-tauri/src/commands/search.rs`:

```rust
use crate::db::{get_pool, chunk};
use crate::errors::AppError;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct KeywordSearchResult {
    pub chunk_id: String,
    pub document_id: String,
    pub knowledge_base_id: String,
    pub content: String,
    pub heading_path: String,
    pub chunk_type: String,
    pub score: f64,
    pub file_name: String,
}

#[tauri::command]
pub fn search_keyword(kb_id: String, query: String, limit: i32) -> Result<Vec<KeywordSearchResult>, AppError> {
    // 使用 SQLite FTS5 进行全文搜索
    // SELECT c.*, rank FROM chunks c
    // JOIN chunks_fts fts ON c.rowid = fts.rowid
    // JOIN documents d ON c.document_id = d.id
    // WHERE chunks_fts MATCH ? AND c.knowledge_base_id = ?
    // ORDER BY rank
    // LIMIT ?
    let pool = get_pool()?;
    let mut conn = pool.get().map_err(|e| AppError::db(e.to_string()))?;

    // 使用 Diesel 原生查询
    let results = diesel::sql_query(
        "SELECT c.id as chunk_id, c.document_id, c.knowledge_base_id, c.content, 
                c.heading_path, c.chunk_type, d.file_name,
                -rank as score
         FROM chunks_fts fts
         JOIN chunks c ON c.rowid = fts.rowid
         JOIN documents d ON c.document_id = d.id
         WHERE chunks_fts MATCH ? AND c.knowledge_base_id = ?
         ORDER BY rank
         LIMIT ?"
    )
    .bind::<diesel::sql_types::Text, _>(&query)
    .bind::<diesel::sql_types::Text, _>(&kb_id)
    .bind::<diesel::sql_types::Integer, _>(&limit)
    .load::<KeywordSearchResult>(&mut conn)
    .map_err(|e| AppError::db(e.to_string()))?;

    Ok(results)
}
```

- [ ] **Step 2: 实现前端关键词搜索服务**

`src/services/retrieval/keyword-search.ts`:

```typescript
import { tauriCommand } from '../../hooks/useDatabase';

export interface KeywordSearchResult {
  chunk_id: string;
  document_id: string;
  knowledge_base_id: string;
  content: string;
  heading_path: string;
  chunk_type: string;
  score: number;
  file_name: string;
}

export async function keywordSearch(
  kbId: string,
  query: string,
  limit: number = 20
): Promise<KeywordSearchResult[]> {
  return tauriCommand<KeywordSearchResult[]>('search_keyword', {
    kbId,
    query,
    limit,
  });
}
```

- [ ] **Step 3: 注册搜索命令**

更新 `commands/mod.rs` 和 `lib.rs`。

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add keyword search service with FTS5 full-text search"
```

---

### Task 3: 融合重排引擎

**Files:**
- Create: `src/services/retrieval/reranker.ts`
- Create: `src/services/retrieval/index.ts`（检索引擎入口）

- [ ] **Step 1: 实现融合重排算法**

`src/services/retrieval/reranker.ts`:

```typescript
import type { VectorSearchResult } from './vector-search';
import type { KeywordSearchResult } from './keyword-search';

export interface RerankedResult {
  chunk_id: string;
  document_id: string;
  content: string;
  heading_path: string;
  file_name: string;
  chunk_type: string;
  vector_score: number;
  keyword_score: number;
  final_score: number;
}

function normalizeScores(scores: number[]): Map<string, number> {
  if (scores.length === 0) return new Map();
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return new Map(); // 实际在下面的函数中使用归一化
}

export function rerank(
  vectorResults: VectorSearchResult[],
  keywordResults: KeywordSearchResult[],
  options: {
    vectorWeight?: number;   // 默认 0.7
    keywordWeight?: number;  // 默认 0.3
    titleMatchBonus?: number; // 默认 0.1
    maxResults?: number;      // 默认 6
  } = {}
): RerankedResult[] {
  const alpha = options.vectorWeight ?? 0.7;
  const beta = options.keywordWeight ?? 0.3;
  const gamma = options.titleMatchBonus ?? 0.1;
  const maxResults = options.maxResults ?? 6;

  // 归一化分数
  const vectorScores = vectorResults.map(r => r.score);
  const keywordScores = keywordResults.map(r => r.score);

  const vMin = Math.min(...vectorScores, 0);
  const vMax = Math.max(...vectorScores, 1);
  const kMin = Math.min(...keywordScores, 0);
  const kMax = Math.max(...keywordScores, 1);

  const normalizeV = (s: number) => vMax === vMin ? 1 : (s - vMin) / (vMax - vMin);
  const normalizeK = (s: number) => kMax === kMin ? 1 : (s - kMin) / (kMax - kMin);

  // 合并结果
  const merged = new Map<string, RerankedResult>();

  for (const r of vectorResults) {
    const normV = normalizeV(r.score);
    merged.set(r.chunk_id, {
      chunk_id: r.chunk_id,
      document_id: r.document_id,
      content: r.content,
      heading_path: r.heading_path,
      file_name: r.file_name,
      chunk_type: r.metadata?.chunk_type || 'paragraph',
      vector_score: normV,
      keyword_score: 0,
      final_score: alpha * normV,
    });
  }

  for (const r of keywordResults) {
    const normK = normalizeK(r.score);
    const existing = merged.get(r.chunk_id);
    if (existing) {
      existing.keyword_score = normK;
      existing.final_score = alpha * existing.vector_score + beta * normK;
    } else {
      merged.set(r.chunk_id, {
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        content: r.content,
        heading_path: r.heading_path,
        file_name: r.file_name,
        chunk_type: r.chunk_type,
        vector_score: 0,
        keyword_score: normK,
        final_score: beta * normK,
      });
    }
  }

  // 标题匹配加成
  const queryTerms = new Set(
    (merged as any)._query?.toLowerCase().split(/\s+/) || []
  );
  for (const result of merged.values()) {
    if (result.heading_path && queryTerms.size > 0) {
      const headingTerms = result.heading_path.toLowerCase().split(/[\/\\>]/);
      const matchCount = headingTerms.filter(t => queryTerms.has(t.trim())).length;
      result.final_score += gamma * (matchCount / Math.max(queryTerms.size, 1));
    }
  }

  // 多样性：确保不同文档被代表
  const sorted = Array.from(merged.values()).sort((a, b) => b.final_score - a.final_score);
  const selected: RerankedResult[] = [];
  const documentCounts = new Map<string, number>();
  const maxPerDocument = Math.ceil(maxResults * 0.4);

  for (const result of sorted) {
    if (selected.length >= maxResults) break;
    const docCount = documentCounts.get(result.document_id) || 0;
    if (docCount < maxPerDocument) {
      selected.push(result);
      documentCounts.set(result.document_id, docCount + 1);
    }
  }

  return selected;
}
```

- [ ] **Step 2: 实现检索引擎入口**

`src/services/retrieval/index.ts`:

```typescript
import { getEmbedding } from '../embedding';
import { vectorSearch, type VectorSearchResult } from './vector-search';
import { keywordSearch, type KeywordSearchResult } from './keyword-search';
import { rerank, type RerankedResult } from './reranker';

export type RetrievalMode = 'hybrid' | 'semantic' | 'keyword';

export interface RetrievalResult {
  chunks: RerankedResult[];
  mode: RetrievalMode;
  totalCandidates: number;
}

export async function retrieve(
  query: string,
  kbId: string,
  collectionName: string,
  embeddingModel: string,
  ollamaUrl: string,
  options: {
    mode?: RetrievalMode;
    maxResults?: number;
    vectorWeight?: number;
    keywordWeight?: number;
  } = {}
): Promise<RetrievalResult> {
  const mode = options.mode || 'hybrid';
  const maxResults = options.maxResults || 6;

  let vectorResults: VectorSearchResult[] = [];
  let keywordResults: KeywordSearchResult[] = [];

  if (mode === 'hybrid' || mode === 'semantic') {
    const queryEmbedding = await getEmbedding(query, embeddingModel, ollamaUrl);
    vectorResults = await vectorSearch(collectionName, queryEmbedding.embedding, maxResults * 3);
  }

  if (mode === 'hybrid' || mode === 'keyword') {
    keywordResults = await keywordSearch(kbId, query, maxResults * 3);
  }

  if (mode === 'semantic') {
    // 纯向量检索，简单取 top-K
    return {
      chunks: vectorResults.slice(0, maxResults).map(r => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        content: r.content,
        heading_path: r.heading_path,
        file_name: r.file_name,
        chunk_type: r.metadata?.chunk_type || 'paragraph',
        vector_score: r.score,
        keyword_score: 0,
        final_score: r.score,
      })),
      mode,
      totalCandidates: vectorResults.length,
    };
  }

  if (mode === 'keyword') {
    // 纯关键词搜索
    return {
      chunks: keywordResults.slice(0, maxResults).map(r => ({
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        content: r.content,
        heading_path: r.heading_path,
        file_name: r.file_name,
        chunk_type: r.chunk_type,
        vector_score: 0,
        keyword_score: r.score,
        final_score: r.score,
      })),
      mode,
      totalCandidates: keywordResults.length,
    };
  }

  // 混合模式：融合重排
  const reranked = rerank(vectorResults, keywordResults, {
    vectorWeight: options.vectorWeight,
    keywordWeight: options.keywordWeight,
    maxResults,
  });

  return {
    chunks: reranked,
    mode,
    totalCandidates: vectorResults.length + keywordResults.length,
  };
}
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add hybrid retrieval engine with vector search, keyword search, and fusion reranking"
```

---

### Task 4: 检索模式切换 UI

**Files:**
- Create: `src/components/chat/ModeSelector.tsx`
- Create: `src/components/chat/SearchResultsPanel.tsx`

- [ ] **Step 1: 实现检索模式切换组件**

`src/components/chat/ModeSelector.tsx`:

三种模式按钮组：智能模式（默认）/ 语义检索 / 关键词搜索
- 使用 Radix UI ToggleGroup
- 图标标识每种模式
- 选中状态高亮

- [ ] **Step 2: 实现搜索结果预览面板**

`src/components/chat/SearchResultsPanel.tsx`:

- 侧边栏显示检索到的分块结果
- 每个结果显示：文件名、标题路径、内容预览（截断80字）、得分
- 点击结果跳转到文档详情页对应分块
- 展开查看完整内容

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add retrieval mode selector and search results preview panel"
```

---

### Task 5: 检索功能端到端测试

- [ ] **Step 1: 准备测试数据**

在已有知识库中导入至少2个不同文件（一个 PDF，一个 Markdown），确保向量化完成。

- [ ] **Step 2: 语义检索测试**

输入概念性查询（如「RAG 架构的优势」），验证向量检索返回相关分块。

- [ ] **Step 3: 关键词搜索测试**

输入精确术语查询，验证 FTS5 返回包含该词的分块。

- [ ] **Step 4: 混合模式测试**

输入模糊查询，验证融合重排返回的组合结果，检查多样性（不同文档的分块出现）。

- [ ] **Step 5: 提交测试修复（如有）**

```bash
git add .
git commit -m "test: verify retrieval engine end-to-end with semantic, keyword, and hybrid modes"
```

---

## 阶段5完成标准

- [ ] 向量检索通过 ChromaDB 正常工作
- [ ] 关键词搜索通过 SQLite FTS5 正常工作
- [ ] 混合模式融合重排效果合理，不同文档的分块有代表性
- [ ] 检索模式可切换（智能/语义/关键词）
- [ ] 搜索结果预览面板可用
- [ ] 端到端检索测试通过