# 阶段6：RAG 对话引擎 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于检索结果的 LLM 对话式问答，包括 Prompt 构建、流式输出、引用溯源和会话管理，形成完整的 RAG 对话体验。

**Architecture:** TypeScript 侧构建 Prompt 和管理上下文窗口，Ollama Chat API 提供流式响应，前端 React 组件实时渲染 Markdown 并展示引用卡片。

**Tech Stack:** Ollama Chat API (stream), react-markdown, rehype-highlight, Shiki

---

## File Structure

```
src/
├── services/
│   ├── llm/
│   │   ├── index.ts            (LLM对话服务入口)
│   │   ├── prompt-builder.ts   (Prompt构建)
│   │   ├── context-window.ts   (上下文窗口管理)
│   │   └── stream-handler.ts   (流式响应处理)
├── components/
│   └── chat/
│       ├── ChatInterface.tsx   (对话主界面)
│       ├── MessageList.tsx
│       ├── MessageBubble.tsx
│       ├── CitationPopup.tsx   (引用溯源弹窗)
│       ├── InputBar.tsx
│       └── ConversationList.tsx
└── store/
    └── chat.ts                (更新：流式消息)
```

---

### Task 1: Prompt 构建与上下文窗口管理

**Files:**
- Create: `src/services/llm/prompt-builder.ts`
- Create: `src/services/llm/context-window.ts`

- [ ] **Step 1: 实现 Prompt 构建器**

`src/services/llm/prompt-builder.ts`:

```typescript
import type { RerankedResult } from '../retrieval/reranker';

export interface PromptContext {
  systemPrompt: string;
  references: RerankedResult[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userQuery: string;
  maxTokens: number;
}

export function buildPrompt(context: PromptContext): Array<{ role: string; content: string }> {
  const { systemPrompt, references, conversationHistory, userQuery, maxTokens } = context;

  const referenceBlock = buildReferenceBlock(references);
  const systemBlock = buildSystemBlock(systemPrompt, referenceBlock);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemBlock },
  ];

  // 添加历史对话（受 token 预算限制）
  const historyBudget = Math.floor(maxTokens * 0.3);
  const truncatedHistory = truncateHistory(conversationHistory, historyBudget);

  for (const msg of truncatedHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // 用户提问
  messages.push({ role: 'user', content: userQuery });

  return messages;
}

function buildSystemBlock(systemPrompt: string, referenceBlock: string): string {
  return `${systemPrompt}\n\n${referenceBlock}`;
}

function buildReferenceBlock(references: RerankedResult[]): string {
  if (references.length === 0) {
    return '## 参考资料\n暂无相关参考资料。';
  }

  const refTexts = references.map((ref, i) => {
    return `[${ref.file_name}#${i + 1}]\n${ref.content}`;
  });

  return `## 参考资料\n${refTexts.join('\n\n')}`;
}

function truncateHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // 从最近的对话开始保留，直到超出 token 预算
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let tokenCount = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = Math.ceil(msg.content.length * 0.5); // 粗略估计
    if (tokenCount + msgTokens > maxTokens) break;
    result.unshift(msg);
    tokenCount += msgTokens;
  }

  return result;
}
```

- [ ] **Step 2: 实现上下文窗口管理**

`src/services/llm/context-window.ts`:

```typescript
import { estimateTokenCount } from '../../utils/token-counter';

export interface ContextWindowConfig {
  maxContextTokens: number;      // 模型上下文窗口大小
  systemPromptRatio: number;     // 系统提示词占比（固定）
  referenceRatio: number;         // 检索上下文占比（优先）
  historyRatio: number;           // 会话历史占比（可压缩）
  queryRatio: number;             // 用户提问占比（必须保留）
  maxHistoryRounds: number;       // 最大对话轮数（默认6）
}

export const DEFAULT_CONTEXT_CONFIG: ContextWindowConfig = {
  maxContextTokens: 8192,    // qwen2.5:7b 默认
  systemPromptRatio: 0.1,
  referenceRatio: 0.6,
  historyRatio: 0.2,
  queryRatio: 0.1,
  maxHistoryRounds: 6,
};

export function allocateContextBudget(config: ContextWindowConfig): {
  systemBudget: number;
  referenceBudget: number;
  historyBudget: number;
  queryBudget: number;
} {
  const total = config.maxContextTokens;
  return {
    systemBudget: Math.floor(total * config.systemPromptRatio),
    referenceBudget: Math.floor(total * config.referenceRatio),
    historyBudget: Math.floor(total * config.historyRatio),
    queryBudget: Math.floor(total * config.queryRatio),
  };
}

export function truncateReferences(
  references: Array<{ content: string; file_name: string; heading_path: string }>,
  maxTokens: number
): Array<{ content: string; file_name: string; heading_path: string }> {
  const result: typeof references = [];
  let usedTokens = 0;

  for (const ref of references) {
    const tokenCount = estimateTokenCount(ref.content);
    if (usedTokens + tokenCount > maxTokens) {
      // 超出预算，截断此引用
      if (result.length === 0 || usedTokens < maxTokens * 0.8) {
        // 如果还没有任何引用或者还有空间，截断部分内容
        const remaining = maxTokens - usedTokens;
        result.push({
          ...ref,
          content: ref.content.slice(0, Math.floor(remaining * 2)) + '\n...(内容已截断)',
        });
      }
      break;
    }
    result.push(ref);
    usedTokens += tokenCount;
  }

  return result;
}
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add prompt builder and context window management for RAG chat"
```

---

### Task 2: 流式响应处理与 LLM 服务

**Files:**
- Create: `src/services/llm/stream-handler.ts`
- Create: `src/services/llm/index.ts`

- [ ] **Step 1: 实现流式响应处理器**

`src/services/llm/stream-handler.ts`:

```typescript
export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  model: string = 'qwen2.5:7b',
  ollamaUrl: string = 'http://localhost:11434',
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    yield { type: 'error', error: `Chat request failed: ${response.status} ${response.statusText}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            yield { type: 'content', content: data.message.content };
          }
          if (data.done) {
            yield { type: 'done' };
          }
        } catch {
          // 忽略解析错误，继续处理
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      yield { type: 'done' };
    } else {
      yield { type: 'error', error: String(err) };
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 2: 实现 LLM 对话服务入口**

`src/services/llm/index.ts`:

```typescript
import { retrieve, type RetrievalMode } from '../retrieval';
import { buildPrompt, type PromptContext } from './prompt-builder';
import { allocateContextBudget, truncateReferences, DEFAULT_CONTEXT_CONFIG } from './context-window';
import { streamChat, type StreamChunk } from './stream-handler';
import type { RerankedResult } from '../retrieval/reranker';

export interface ChatOptions {
  kbId: string;
  collectionName: string;
  query: string;
  model?: string;
  embeddingModel?: string;
  ollamaUrl?: string;
  retrievalMode?: RetrievalMode;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  signal?: AbortSignal;
}

export interface ChatResponse {
  answer: string;
  references: RerankedResult[];
  retrievalMode: RetrievalMode;
  totalCandidates: number;
}

export const DEFAULT_SYSTEM_PROMPT = `你是一个知识库问答助手。请基于以下参考资料回答用户问题。

## 规则
- 仅基于参考资料回答，不编造信息
- 引用来源时标注 [文档名#序号]
- 如果参考资料不足以回答，明确告知用户
- 使用中文回答`;

export async function* chat(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const {
    kbId,
    collectionName,
    query,
    model = 'qwen2.5:7b',
    embeddingModel = 'nomic-embed-text',
    ollamaUrl = 'http://localhost:11434',
    retrievalMode = 'hybrid',
    conversationHistory = [],
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    signal,
  } = options;

  // 1. 检索相关分块
  let references: RerankedResult[] = [];
  let totalCandidates = 0;
  try {
    const retrievalResult = await retrieve(query, kbId, collectionName, embeddingModel, ollamaUrl, {
      mode: retrievalMode,
      maxResults: 6,
    });
    references = retrievalResult.chunks;
    totalCandidates = retrievalResult.totalCandidates;
  } catch (err) {
    // 检索失败仍然可以继续，只是没有参考资料
  }

  // 2. 构建上下文
  const budget = allocateContextBudget(DEFAULT_CONTEXT_CONFIG);
  const truncatedRefs = truncateReferences(references, budget.referenceBudget);

  // 3. 构建 Prompt
  const messages = buildPrompt({
    systemPrompt,
    references: truncatedRefs,
    conversationHistory,
    userQuery: query,
    maxTokens: DEFAULT_CONTEXT_CONFIG.maxContextTokens,
  });

  // 4. 流式调用 LLM
  yield* streamChat(messages, model, ollamaUrl, signal);
}
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add LLM chat service with streaming response and RAG integration"
```

---

### Task 3: 对话界面核心组件

**Files:**
- Create: `src/components/chat/ChatInterface.tsx`
- Create: `src/components/chat/MessageList.tsx`
- Create: `src/components/chat/MessageBubble.tsx`
- Create: `src/components/chat/InputBar.tsx`
- Update: `src/App.tsx`

- [ ] **Step 1: 实现输入栏组件**

`src/components/chat/InputBar.tsx`:

- 多行文本输入（textarea，自动高度调整，最大5行）
- 发送按钮（Enter 发送，Shift+Enter 换行）
- 停止生成按钮（流式输出期间可见）
- 检索模式切换器（ModeSelector 集成）
- 发送前自动清除首尾空白

- [ ] **Step 2: 实现消息气泡组件**

`src/components/chat/MessageBubble.tsx`:

- 用户消息：右对齐，简单文本显示
- 助手消息：左对齐，Markdown 渲染（react-markdown）
- 助手消息中的 `[文件名#N]` 引用标记渲染为可点击标签
- 引用标签使用不同颜色高亮
- 流式输出时显示打字效果
- 思考中状态显示加载动画

Markdown 渲染使用：
```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Shiki } from 'shiki';
```

- [ ] **Step 3: 实现消息列表组件**

`src/components/chat/MessageList.tsx`:

- 渲染所有消息（用户 + 助手）
- 自动滚动到底部（新消息时）
- 流式消息实时更新
- 引用标记列表（助手消息底部）

- [ ] **Step 4: 实现对话主界面**

`src/components/chat/ChatInterface.tsx`:

核心交互流程：
1. 用户输入问题 → 调用 `retrieve()` 获取检索结果
2. 显示检索中的状态指示
3. 构建上下文 → 调用 `chat()` 流式生成回答
4. 处理流式响应：每收到一个 chunk，追加到 `streamingMessage`
5. 流式完成：将完整消息存入 SQLite（通过 Tauri Command `add_message`）
6. 引用标记渲染为可点击链接

状态管理：
- 对话 ID 由路由参数提供
- 消息列表从 `useChatStore` 读取
- 流式消息追加通过 `appendStreamingMessage`
- AbortController 支持取消生成

```typescript
export function ChatInterface() {
  const { id } = useParams<{ id: string }>();
  const kbId = ...; // 从当前知识库获取
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const handleSend = async (query: string, mode: RetrievalMode) => {
    // 1. 创建用户消息
    // 2. 开始流式对话
    const controller = new AbortController();
    setAbortController(controller);

    const stream = chat({
      kbId,
      collectionName: `kb_${kbId}`,
      query,
      retrievalMode: mode,
      signal: controller.signal,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        appendStreamingMessage(chunk.content);
      } else if (chunk.type === 'done') {
        // 将完整消息存入 SQLite
        saveMessage(streamingMessage);
      } else if (chunk.type === 'error') {
        // 显示错误
      }
    }
  };

  // ...渲染逻辑
}
```

- [ ] **Step 5: 更新路由**

```tsx
import { ChatInterface } from './components/chat/ChatInterface';
// Route: /kb/:id/chat 和 /kb/:id/chat/:conversationId
```

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat: add RAG chat interface with streaming, markdown rendering, and input bar"
```

---

### Task 4: 引用溯源组件

**Files:**
- Create: `src/components/chat/CitationPopup.tsx`

- [ ] **Step 1: 实现引用弹窗组件**

`src/components/chat/CitationPopup.tsx`:

核心功能：
- 点击消息中的 `[文件名#N]` 标记时弹出
- 显示引用卡片内容：
  - 文档名 + 标题路径（heading_path）
  - 分块原文（完整的 chunk content）
  - 高亮匹配部分
  - 前后各扩展 50 字上下文
- 「查看原文」按钮：跳转到文档详情页对应分块
- 「关闭」按钮

交互：
- 使用 Radix UI Popover 锚定到引用标记
- 点击其他区域关闭
- 支持键盘 ESC 关闭

数据获取：
- 从检索结果中找到对应 chunk_id 的 RerankedResult
- 通过 Tauri Command `get_chunk` 获取完整分块内容

- [ ] **Step 2: 在 MessageBubble 中集成引用解析**

解析助手消息中的引用标记模式：`\[([^\]]+)#(\d+)\]`

将匹配的文本替换为可点击的引用标签：

```typescript
function parseCitations(content: string): Array<{ type: 'text' | 'citation'; text: string; index?: number }> {
  const parts: Array<{ type: 'text' | 'citation'; text: string; index?: number }> = [];
  const regex = /\[([^\]]+)#(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'citation', text: match[1], index: parseInt(match[2]) });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return parts;
}
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add citation popup with reference tracing and source navigation"
```

---

### Task 5: 会话管理

**Files:**
- Update: `src/components/chat/ChatInterface.tsx`
- Create: `src/components/chat/ConversationList.tsx`
- Update: `src/components/layout/Sidebar.tsx`（显示对话历史）

- [ ] **Step 1: 实现对话历史侧边栏**

`src/components/chat/ConversationList.tsx`:

- 显示当前知识库下的对话列表
- 每条显示：标题（自动生成或用户编辑）、最后消息时间
- 点击加载对话消息
- 新建对话按钮
- 删除对话（带确认）
- 对话标题自动从第一条消息提取（取前 20 字符）

- [ ] **Step 2: 在 Sidebar 中集成对话历史**

按知识库分组显示最近对话，点击跳转到对应对话页面。

- [ ] **Step 3: 实现对话标题自动生成**

当第一轮对话完成后，使用用户的第一条消息（截取前 20 字符）作为对话标题。通过 `update_conversation` Command 更新。

- [ ] **Step 4: 实现会话恢复**

打开历史对话时：
1. 调用 `list_messages` 加载所有消息
2. 渲染到 MessageList
3. 滚动到底部
4. 用户可以继续对话（滑动窗口历史会自动处理）

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add conversation management with history, titles, and session restore"
```

---

### Task 6: Markdown 渲染优化

**Files:**
- Update: `src/components/chat/MessageBubble.tsx`
- 新增依赖: `react-markdown`, `remark-gfm`, `rehype-highlight`

- [ ] **Step 1: 安装 Markdown 渲染依赖**

```bash
npm install react-markdown remark-gfm rehype-highlight
```

- [ ] **Step 2: 配置 Markdown 渲染器**

在 MessageBubble 中：
- 使用 `react-markdown` 渲染助手消息
- `remark-gfm` 支持 GFM 扩展（表格、删除线、任务列表）
- `rehype-highlight` 支持代码高亮
- 代码块添加复制按钮
- 图片懒加载
- 链接外部打开
- 引用标记特殊样式（上文已实现）

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: add markdown rendering with GFM, syntax highlighting, and copy button"
```

---

## 阶段6完成标准

- [ ] 用户可以在对话界面输入问题，获得流式生成的回答
- [ ] 回答中的引用标记可点击，展开引用卡片
- [ ] 引用卡片显示正确的文档名、标题路径、原文内容
- [ ] 三种检索模式可切换，结果不同
- [ ] 对话历史持久保存，刷新/重启后可恢复
- [ ] 对话标题自动生成
- [ ] Markdown 渲染正常，代码块有语法高亮
- [ ] 用户可以停止生成
- [ ] Ollama 断连时有错误提示