# 阶段3：文档解析与智能分块 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的文档导入管线，包括4种格式的文档解析、混合策略智能分块、以及导入进度追踪，让用户可以导入文档并看到分块结果。

**Architecture:** 文档解析和分块全部在 TypeScript 侧（前端）完成。解析使用 pdfjs-dist、unified/remark、mammoth 等库。分块引擎采用混合策略（结构优先+长度兜底）。解析完成后通过 Tauri IPC 将分块数据存入 SQLite。

**Tech Stack:** pdfjs-dist, unified/remark, mammoth, Web Worker (大量计算在 Worker 中执行)

---

## File Structure

```
src/
├── services/
│   ├── parser/
│   │   ├── index.ts           (解析器工厂)
│   │   ├── pdf.ts             (PDF解析)
│   │   ├── markdown.ts        (Markdown解析)
│   │   ├── txt.ts             (纯文本解析)
│   │   ├── docx.ts            (DOCX解析)
│   │   └── types.ts           (解析器类型定义)
│   ├── chunker/
│   │   ├── index.ts            (分块引擎入口)
│   │   ├── heading-chunker.ts  (按标题分块)
│   │   ├── paragraph-chunker.ts(按段落分块)
│   │   ├── code-chunker.ts     (代码块保护)
│   │   ├── overlap.ts          (分块重叠处理)
│   │   └── types.ts            (分块器类型定义)
│   └── importer/
│       ├── index.ts            (导入引擎入口)
│       └── progress.ts         (进度追踪)
├── components/
│   └── document/
│       ├── DocumentImporter.tsx (增强：拖拽+进度)
│       └── ChunkPreview.tsx     (新增：分块预览)
└── utils/
    ├── hash.ts                 (内容哈希)
    └── token-counter.ts        (Token计数)
```

---

### Task 1: 文档解析器基础设施

**Files:**
- Create: `src/services/parser/types.ts`
- Create: `src/services/parser/index.ts`
- Create: `src/utils/hash.ts`
- Create: `src/utils/token-counter.ts`

- [ ] **Step 1: 定义解析器接口和类型**

`src/services/parser/types.ts`:

```typescript
import type { DocContent, DocSection } from '../../types/chunk';

export type FileType = 'pdf' | 'md' | 'txt' | 'docx';

export interface ParserResult {
  content: DocContent;
  metadata: {
    title: string;
    pageCount?: number;
    wordCount: number;
    language?: string;
  };
}

export interface ParserOptions {
  maxFileSize: number;       // 默认 50MB
  extractMetadata: boolean;
}

export const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  maxFileSize: 50 * 1024 * 1024,
  extractMetadata: true,
};

export interface DocumentParser {
  parse(raw: ArrayBuffer | string, fileName: string): Promise<ParserResult>;
  supportedTypes: FileType[];
}
```

- [ ] **Step 2: 创建解析器工厂**

`src/services/parser/index.ts`:

```typescript
import type { FileType, ParserOptions, ParserResult } from './types';
import { DEFAULT_PARSER_OPTIONS } from './types';
import { PdfParser } from './pdf';
import { MarkdownParser } from './markdown';
import { TxtParser } from './txt';
import { DocxParser } from './docx';

const parsers: Record<FileType, DocumentParser> = {
  pdf: new PdfParser(),
  md: new MarkdownParser(),
  txt: new TxtParser(),
  docx: new DocxParser(),
};

export async function parseDocument(
  fileData: ArrayBuffer,
  fileName: string,
  fileType: FileType,
  options?: Partial<ParserOptions>
): Promise<ParserResult> {
  const parser = parsers[fileType];
  if (!parser) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
  return parser.parse(fileData, fileName);
}

export function getSupportedType(fileName: string): FileType | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, FileType> = {
    pdf: 'pdf',
    md: 'md',
    markdown: 'md',
    txt: 'txt',
    docx: 'docx',
  };
  return typeMap[ext || ''] || null;
}
```

- [ ] **Step 3: 实现内容哈希工具**

`src/utils/hash.ts`:

```typescript
export async function computeContentHash(content: ArrayBuffer | string): Promise<string> {
  const data = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : new Uint8Array(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 4: 实现 Token 计数工具**

`src/utils/token-counter.ts`:

采用简易 Token 计数：中文约 1 字 ≈ 1 token，英文约 4 字符 ≈ 1 token。生产环境下可替换为 tiktoken 等精确计数库。

```typescript
export function estimateTokenCount(text: string): number {
  let tokenCount = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/[\u4e00-\u9fff]/.test(char)) {
      tokenCount += 1;
    } else if (/\s/.test(char)) {
      continue;
    } else {
      tokenCount += 0.25;
    }
  }
  return Math.ceil(tokenCount);
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  let tokens = 0;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/[\u4e00-\u9fff]/.test(char)) {
      tokens += 1;
    } else if (!/\s/.test(char)) {
      tokens += 0.25;
    }
    if (tokens > maxTokens) break;
    result += char;
  }
  return result;
}
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add document parser infrastructure with types, factory, hash and token counter"
```

---

### Task 2: PDF 解析器

**Files:**
- Create: `src/services/parser/pdf.ts`

- [ ] **Step 1: 安装 pdfjs-dist**

```bash
npm install pdfjs-dist@4
```

- [ ] **Step 2: 实现 PDF 解析器**

`src/services/parser/pdf.ts`:

核心逻辑：
1. 使用 pdfjs-dist 加载 PDF 文档
2. 逐页提取文本内容
3. 尝试识别标题：全大写短行、加粗文本、字号更大的文本
4. 将每页内容组织为 sections
5. 保留页码信息作为 metadata

关键实现：
- `extractTextPerPage()` → 逐页提取
- `detectHeadings()` → 基于字号和字体样式检测标题
- `organizeSections()` → 将页面内容组织为结构化 sections
- 页码作为前缀添加到 heading_path

- [ ] **Step 3: 简化实现（优先可用性）**

初期版本采用简单策略：每页为一个 section，标题为 "第X页"。后续可优化为基于字号检测真实标题结构。

```typescript
import type { DocumentParser, ParserResult } from './types';
import type { DocContent, DocSection } from '../../types/chunk';

export class PdfParser implements DocumentParser {
  supportedTypes: FileType[] = ['pdf'];

  async parse(data: ArrayBuffer, fileName: string): Promise<ParserResult> {
    const pdfjsLib = await import('pdfjs-dist');
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const sections: DocSection[] = [];
    let totalWordCount = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text) {
        sections.push({
          heading: `第${pageNum}页`,
          heading_path: `第${pageNum}页`,
          heading_level: 1,
          content: text,
          content_type: 'text',
        });
        totalWordCount += text.length;
      }
    }

    return {
      content: {
        title: fileName.replace(/\.pdf$/i, ''),
        file_type: 'pdf',
        sections,
      },
      metadata: {
        title: fileName.replace(/\.pdf$/i, ''),
        pageCount: pdf.numPages,
        wordCount: totalWordCount,
      },
    };
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add PDF parser with page-by-page text extraction"
```

---

### Task 3: Markdown 解析器

**Files:**
- Create: `src/services/parser/markdown.ts`

- [ ] **Step 1: 安装 unified/remark 依赖**

```bash
npm install unified remark-parse remark-frontmatter unist-util-select
```

- [ ] **Step 2: 实现 Markdown 解析器**

`src/services/parser/markdown.ts`:

核心逻辑：
1. 使用 remark 解析 Markdown AST
2. 遍历 AST，提取标题层级结构
3. 识别代码块（code 节点），标记 content_type 为 'code'
4. 识别表格（table 节点），转换为文本描述，标记 content_type 为 'table'
5. 保留链接文本
6. 构建 heading_path（标题嵌套路径）

关键函数：
- `buildHeadingPath()` → 从标题层级构建路径
- `extractSections()` → 遍历 AST 提取 sections
- `determineContentType()` → 判断 section 内容类型

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add Markdown parser with heading structure and code block detection"
```

---

### Task 4: TXT 和 DOCX 解析器

**Files:**
- Create: `src/services/parser/txt.ts`
- Create: `src/services/parser/docx.ts`

- [ ] **Step 1: 实现 TXT 解析器**

`src/services/parser/txt.ts`:

核心逻辑：
1. 直接读取文本内容
2. 按空行分段落
3. 尝试识别标题：全大写短行(≤50字符) 或 短行且不以标点结尾
4. 将识别出的标题和段落组织为 sections

- [ ] **Step 2: 安装 mammoth**

```bash
npm install mammoth
```

- [ ] **Step 3: 实现 DOCX 解析器**

`src/services/parser/docx.ts`:

核心逻辑：
1. 使用 mammoth 将 DOCX 转为 Markdown
2. 复用 Markdown 解析器解析转换后的内容
3. mammoth 提供了标题层级信息，保持 heading_level

```typescript
import mammoth from 'mammoth';
import { MarkdownParser } from './markdown';
import type { ParserResult, FileType } from './types';

export class DocxParser implements DocumentParser {
  supportedTypes: FileType[] = ['docx'];
  private mdParser = new MarkdownParser();

  async parse(data: ArrayBuffer, fileName: string): Promise<ParserResult> {
    const result = await mammoth.convertToMarkdown({ arrayBuffer: data });
    const mdContent = result.value;
    const mdData = new TextEncoder().encode(mdContent).buffer;
    const parsed = await this.mdParser.parse(mdData as ArrayBuffer, fileName.replace(/\.docx$/i, '.md'));
    parsed.content.file_type = 'docx';
    return parsed;
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat: add TXT and DOCX parsers"
```

---

### Task 5: 混合策略分块引擎

**Files:**
- Create: `src/services/chunker/types.ts`
- Create: `src/services/chunker/index.ts`
- Create: `src/services/chunker/heading-chunker.ts`
- Create: `src/services/chunker/paragraph-chunker.ts`
- Create: `src/services/chunker/code-chunker.ts`
- Create: `src/services/chunker/overlap.ts`

- [ ] **Step 1: 定义分块器类型**

`src/services/chunker/types.ts`:

```typescript
import type { ChunkingStrategy } from '../../types/knowledge-base';

export interface ChunkResult {
  content: string;
  chunk_index: number;
  heading_path: string;
  chunk_type: 'heading' | 'paragraph' | 'code' | 'table' | 'mixed';
  char_start: number;
  char_end: number;
  token_count: number;
  metadata: Record<string, unknown>;
}

export interface ChunkerConfig {
  max_chunk_size: number;     // 默认 800 tokens
  min_chunk_size: number;     // 默认 100 tokens
  overlap: number;            // 默认 50 tokens
  heading_as_context: boolean; // 默认 true
}
```

- [ ] **Step 2: 实现标题分块器**

`src/services/chunker/heading-chunker.ts`:

核心逻辑：遍历 DocContent 的 sections，按 heading_level 分组：
1. 每个 heading 创建一个 chunk
2. 如果 heading 下有 content，将 content 追加到该 chunk
3. 保持 heading_path 作为上下文

- [ ] **Step 3: 实现段落分块器**

`src/services/chunker/paragraph-chunker.ts`:

核心逻辑：处理超长 section 的拆分：
1. 按段落（连续换行分割）拆分
2. 尽量不拆断句子（以句号/问号/感叹号为分割点）
3. 逐段合并直到接近 max_chunk_size
4. 添加 overlap 重叠内容

- [ ] **Step 4: 实现代码块保护分块器**

`src/services/chunker/code-chunker.ts`:

核心逻辑：
1. 识别代码块（content_type === 'code'）
2. 如果代码块 ≤ max_chunk_size，保持完整
3. 如果代码块 > max_chunk_size，按行拆分，但尽量在空行处断开
4. 代码块的 overlap 使用注释行连接

- [ ] **Step 5: 实现重叠处理**

`src/services/chunker/overlap.ts`:

```typescript
export function addOverlap(chunkContent: string, overlapTokens: number): string {
  // 从前一个 chunk 的末尾提取 overlapTokens 数量的文本
  // 作为当前 chunk 的前缀
  const tokens = Math.ceil(overlapTokens);
  if (chunkContent.length <= tokens * 2) return chunkContent;
  return chunkContent.slice(-tokens);
}

export function prependOverlap(chunkContent: string, overlapContent: string): string {
  return overlapContent + '\n...\n' + chunkContent;
}
```

- [ ] **Step 6: 实现分块引擎入口**

`src/services/chunker/index.ts`:

核心逻辑：
1. 接收 DocContent 和 ChunkerConfig
2. 先用 heading-chunker 按 heading 分组
3. 对每个 section 判断：
   - content_type === 'code' → code-chunker
   - 超长 section → paragraph-chunker
   - 超短 section → 合并到相邻 section
   - 正常 section → 保持原样
4. 对所有 chunk 添加 overlap
5. 计算 token_count、char_start、char_end
6. 返回 ChunkResult[]

```typescript
import type { DocContent, DocSection } from '../../types/chunk';
import type { ChunkResult, ChunkerConfig } from './types';
import { chunkByHeading } from './heading-chunker';
import { chunkByParagraph } from './paragraph-chunker';
import { chunkCode } from './code-chunker';
import { estimateTokenCount } from '../../utils/token-counter';

export function chunkDocument(content: DocContent, config: ChunkerConfig): ChunkResult[] {
  const preliminaryChunks = chunkByHeading(content.sections, config);
  const finalChunks: ChunkResult[] = [];
  let charOffset = 0;

  for (const chunk of preliminaryChunks) {
    const tokenCount = estimateTokenCount(chunk.content);

    if (tokenCount > config.max_chunk_size) {
      // 超长 chunk 需要进一步拆分
      let subChunks: ChunkResult[];
      if (chunk.chunk_type === 'code') {
        subChunks = chunkCode(chunk, config);
      } else {
        subChunks = chunkByParagraph(chunk, config);
      }
      for (const sub of subChunks) {
        finalChunks.push({
          ...sub,
          chunk_index: finalChunks.length,
          char_start: charOffset,
          char_end: charOffset + sub.content.length,
          token_count: estimateTokenCount(sub.content),
        });
        charOffset += sub.content.length;
      }
    } else if (tokenCount < config.min_chunk_size && finalChunks.length > 0) {
      // 超短 chunk 合并到上一个
      finalChunks[finalChunks.length - 1].content += '\n\n' + chunk.content;
      finalChunks[finalChunks.length - 1].char_end = charOffset + chunk.content.length;
      finalChunks[finalChunks.length - 1].token_count = estimateTokenCount(finalChunks[finalChunks.length - 1].content);
      finalChunks[finalChunks.length - 1].chunk_type = 'mixed';
      charOffset += chunk.content.length;
    } else {
      finalChunks.push({
        ...chunk,
        chunk_index: finalChunks.length,
        char_start: charOffset,
        char_end: charOffset + chunk.content.length,
        token_count: tokenCount,
      });
      charOffset += chunk.content.length;
    }
  }

  return finalChunks;
}
```

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: add hybrid chunking engine with heading, paragraph, and code chunkers"
```

---

### Task 6: 导入管线与进度追踪

**Files:**
- Create: `src/services/importer/index.ts`
- Create: `src/services/importer/progress.ts`
- Update: `src/components/document/DocumentList.tsx`
- Create: `src/components/document/DocumentImporter.tsx`

- [ ] **Step 1: 实现导入管线**

`src/services/importer/index.ts`:

核心流程：
1. 用户选择文件 → Rust 侧读取文件（tauri-plugin-fs）
2. 计算 content_hash
3. 调用 `import_document` Command 创建文档记录 (status=pending)
4. 前端解析文档（调用 parser）
5. 前端分块（调用 chunker）
6. 发送进度事件 `document:processing`
7. 调用 `create_chunks` Command 批量写入 SQLite (status=processing)
8. 发送进度事件 `document:chunking-complete`
9. 文档状态更新为 processing（等待 embedding 阶段4处理）

进度事件通过 Tauri events 从 Rust 推送到前端。

- [ ] **Step 2: 实现进度追踪**

`src/services/importer/progress.ts`:

使用 Tauri 事件系统追踪每个文档的导入进度：

```typescript
import { listen } from '@tauri-apps/api/event';
import type { ImportProgress } from '../../types/document';

export function listenToImportProgress(
  documentId: string,
  callback: (progress: ImportProgress) => void
) {
  return listen<ImportProgress>(`document:${documentId}:progress`, (event) => {
    callback(event.payload);
  });
}

export function emitImportProgress(
  documentId: string,
  progress: ImportProgress
) {
  // 从 Rust 侧发射事件：app.emit()
  // 前端通过 listen 监听
}
```

- [ ] **Step 3: 增强文档导入 UI**

`src/components/document/DocumentImporter.tsx`:

- 拖拽区域支持（drag & drop）
- 文件类型过滤（.pdf, .md, .txt, .docx）
- 多文件批量导入
- 导入进度展示（解析中 / 分块中 / 向量化中 / 完成）
- 错误状态展示和重试按钮

- [ ] **Step 4: 更新 DocumentList 集成导入管线**

在 DocumentList 中使用 DocumentImporter，并在文档导入后刷新列表。展示导入进度。

- [ ] **Step 5: 端到端测试**

测试流程：创建知识库 → 导入一个 Markdown 文件 → 验证分块数量和内容 → 确认文档状态为 processing

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: add document import pipeline with progress tracking and drag-drop UI"
```

---

### Task 7: 分块预览组件

**Files:**
- Create: `src/components/document/ChunkPreview.tsx`
- Update: `src/App.tsx`（添加文档详情路由）

- [ ] **Step 1: 实现分块预览组件**

`src/components/document/ChunkPreview.tsx`:

- 显示文档的所有分块列表
- 每个分块卡片显示：heading_path、chunk_type 标签、content 预览（截断显示）、token_count、char 范围
- 点击展开查看完整内容
- 分块高亮关键词功能（搜索框）
- 分块数量统计

- [ ] **Step 2: 添加文档详情路由与页面**

在 App.tsx 添加：`/documents/:id` 路由 → 文档详情页（文档信息 + 分块预览）

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add chunk preview component with search and expand"
```

---

### Task 8: Rust 端文件操作 Commands

**Files:**
- Create: `src-tauri/src/commands/file.rs`
- Update: `src-tauri/src/commands/mod.rs`
- Update: `src-tauri/src/lib.rs`

- [ ] **Step 1: 实现文件读取和哈希计算**

`src-tauri/src/commands/file.rs`:

```rust
use sha2::{Sha256, Digest};
use std::path::Path;

#[tauri::command]
pub async fn read_file_bytes(file_path: String) -> Result<Vec<u8>, AppError> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(AppError::not_found(format!("File not found: {}", file_path)));
    }
    tokio::fs::read(&file_path)
        .await
        .map_err(|e| AppError::internal(format!("Failed to read file: {}", e)))
}

#[tauri::command]
pub async fn compute_file_hash(file_path: String) -> Result<String, AppError> {
    let bytes = read_file_bytes(file_path.clone()).await?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

#[tauri::command]
pub async fn get_file_info(file_path: String) -> Result<FileInfo, AppError> {
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| AppError::internal(format!("Failed to get file info: {}", e)))?;
    let file_name = Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    Ok(FileInfo {
        file_name,
        file_size: metadata.len() as i64,
        file_path: file_path.clone(),
    })
}
```

- [ ] **Step 2: 添加分块批量写入 Command**

```rust
#[tauri::command]
pub async fn create_chunks(chunks: Vec<NewChunkInput>) -> Result<Vec<ChunkResponse>, AppError> {
    // 批量创建分块记录
    // 更新文档的 chunk_count
    // 同时插入 FTS5 索引（通过触发器自动）
}
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add file operations and batch chunk creation commands"
```

---

## 阶段3完成标准

- [ ] 4种格式（PDF/MD/TXT/DOCX）文档均可正确解析
- [ ] 混合策略分块引擎工作正常（结构优先+长度兜底）
- [ ] 文档导入管线完整可用（拖拽导入→解析→分块→存储）
- [ ] 导入进度实时追踪可见
- [ ] 分块预览组件可展示所有分块
- [ ] content_hash 用于重复导入检测