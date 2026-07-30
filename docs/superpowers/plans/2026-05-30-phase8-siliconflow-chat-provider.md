# 阶段 8：硅基流动云端对话（方案 A）— 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在**不改变本地 RAG 检索与向量化链路**的前提下，将「对话生成 / 回答自检」切换为可配置的模型提供商：默认保留本地 Ollama，可选接入硅基流动（OpenAI 兼容 API），让用户使用 32B/72B 等级云端模型改善回答质量。

**Architecture:** 引入 `ChatProvider` 抽象（`ollama` | `siliconflow`）。检索、分块、Chroma、Ollama `/api/embed` **全部保持原样**。仅 `stream-handler`、`answer-self-check`、`chat/index` 与设置页按 provider 分支；硅基流动走 `POST https://api.siliconflow.cn/v1/chat/completions`（SSE）。API Key 存入 SQLite `settings` 表；UI 展示脱敏，请求时由前端或（可选 Phase 2）Rust 代理附带 `Authorization: Bearer`。

**Tech Stack:** 现有 TypeScript LLM 服务层、Tauri `settings` commands、硅基流动 OpenAI 兼容 REST（SSE）、可选 Rust `reqwest` 代理（Phase 2）。

**边界（明确不做）：**
- 不向量化迁移到云端（方案 B，另立计划）
- 不改动 Chroma 集合 / 不强制重新 embed
- 不在本阶段实现完整「模型市场」或自动拉取硅基模型列表（先用内置预设 + 手动输入 model id）

**与既有阶段关系：**
- 依赖阶段 6 RAG 对话链路（`src/services/llm/*`）已存在
- 设置页框架见阶段 7；本阶段扩展 `OllamaSettings` 或新增 `ChatProviderSettings`
- 视觉 token 遵循阶段 6.5（`var(--*)`）

**参考文档：**
- [硅基流动快速上手](https://docs.siliconflow.cn/cn/userguide/quickstart)
- [Chat Completions](https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions)
- 控制台 API Key：[cloud.siliconflow.cn/account/ak](https://cloud.siliconflow.cn/account/ak)

---

## 分阶段总览

| 阶段 | 目标 | 可独立验收 |
|------|------|------------|
| **8.1** | 类型、设置键、默认值、启动加载 | 设置可读写、重启后保留 |
| **8.2** | Provider 抽象 + OpenAI SSE 流式 | 单元路径可 mock fetch |
| **8.3** | 接入 `chat()` 与 `answer-self-check` | 云端对话端到端流式 |
| **8.4** | 设置页 UI + 模型预设 + 连接测试 | 用户可配置并测试 |
| **8.5** | 错误文案、会话默认模型、验收清单 | `npm run build` + 手动场景通过 |
| **8.6（可选）** | Rust 代理转发（API Key 不进 WebView） | 安全加固 |

---

## File Structure

```
src/
├── types/
│   └── settings.ts                    (+ chat_provider, siliconflow_*)
├── utils/
│   └── siliconflow-presets.ts         (推荐模型列表、默认 base URL)
├── services/llm/
│   ├── index.ts                         (按 provider 路由)
│   ├── stream-handler.ts              (Ollama 保留)
│   ├── openai-stream-handler.ts       (新建：SSE)
│   ├── chat-provider.ts               (新建：统一 streamChat / chatComplete)
│   └── answer-self-check.ts           (改用 chatComplete)
├── components/settings/
│   ├── ChatProviderSettings.tsx       (新建：提供商切换 + Key + 测试)
│   ├── OllamaSettings.tsx             (嵌入/本地 Ollama 区块保留)
│   ├── OllamaModelList.tsx            (对话模型区按 provider 分支)
│   └── ThemeBootstrap.tsx             (加载新 settings 键)
src-tauri/src/
├── db/migrations/
│   └── 003_siliconflow_settings.sql   (INSERT OR IGNORE 默认值)
└── (Phase 2 可选)
    ├── services/siliconflow.rs
    └── commands/siliconflow.rs
```

---

## 新增 Settings 键

| Key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `chat_provider` | `"ollama"` \| `"siliconflow"` | `"ollama"` | 对话提供商 |
| `siliconflow_api_key` | string | `""` | API Key（UI 脱敏） |
| `siliconflow_base_url` | string | `"https://api.siliconflow.cn/v1"` | 可覆盖（极少需要） |
| `siliconflow_chat_model` | string | `"Qwen/Qwen2.5-72B-Instruct"` | 云端对话模型 id |

**保留不变：** `ollama_url`、`default_embedding_model`（嵌入仍走 Ollama）、`default_chat_model`（本地模式下的默认对话模型）。

**规则：** 当 `chat_provider === 'siliconflow'` 时，对话与自检使用 `siliconflow_chat_model`；新建会话 `llm_model` 字段写入该 id。嵌入、导入、检索**始终**使用 `default_embedding_model` + `ollama_url`。

---

### Task 1: 类型、默认值与数据库迁移（阶段 8.1）

**Files:**
- Modify: `src/types/settings.ts`
- Create: `src/utils/siliconflow-presets.ts`
- Create: `src-tauri/src/db/migrations/003_siliconflow_settings.sql`
- Modify: `src-tauri/src/db/migrations/mod.rs`

- [x] **Step 1: 扩展 `AppSettings`**

`src/types/settings.ts` 增加：

```typescript
export type ChatProvider = 'ollama' | 'siliconflow';

export interface AppSettings {
  // ...existing
  chat_provider: ChatProvider;
  siliconflow_api_key: string;
  siliconflow_base_url: string;
  siliconflow_chat_model: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // ...existing
  chat_provider: 'ollama',
  siliconflow_api_key: '',
  siliconflow_base_url: 'https://api.siliconflow.cn/v1',
  siliconflow_chat_model: 'Qwen/Qwen2.5-72B-Instruct',
};
```

- [x] **Step 2: 硅基流动预设**

`src/utils/siliconflow-presets.ts`：

```typescript
export const SILICONFLOW_DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1';

export const SILICONFLOW_CHAT_PRESETS: { label: string; model: string; hint?: string }[] = [
  { label: 'Qwen2.5 72B（质量）', model: 'Qwen/Qwen2.5-72B-Instruct', hint: '中文 RAG 推荐' },
  { label: 'Qwen2.5 32B（均衡）', model: 'Qwen/Qwen2.5-32B-Instruct' },
  { label: 'DeepSeek V3', model: 'deepseek-ai/DeepSeek-V3' },
  { label: 'DeepSeek V2.5', model: 'deepseek-ai/DeepSeek-V2.5' },
];

export function maskApiKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return t ? '••••••••' : '';
  return `${t.slice(0, 4)}${'•'.repeat(Math.min(12, t.length - 8))}${t.slice(-4)}`;
}
```

- [x] **Step 3: SQLite 默认键**

`src-tauri/src/db/migrations/003_siliconflow_settings.sql`：

```sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('chat_provider', '"ollama"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('siliconflow_api_key', '""');
INSERT OR IGNORE INTO settings (key, value) VALUES ('siliconflow_base_url', '"https://api.siliconflow.cn/v1"');
INSERT OR IGNORE INTO settings (key, value) VALUES ('siliconflow_chat_model', '"Qwen/Qwen2.5-72B-Instruct"');
```

在 `migrations/mod.rs` 注册并执行该迁移。

- [x] **Step 4: ThemeBootstrap 加载新键**

`src/components/settings/ThemeBootstrap.tsx` 的 `get_all_settings` 解析中增加：

```typescript
chat_provider: parseChatProvider(all.chat_provider),
siliconflow_api_key: parseJsonOrPlainString(all.siliconflow_api_key, ''),
siliconflow_base_url: parseJsonOrPlainString(
  all.siliconflow_base_url,
  DEFAULT_SETTINGS.siliconflow_base_url,
),
siliconflow_chat_model: parseJsonOrPlainString(
  all.siliconflow_chat_model,
  DEFAULT_SETTINGS.siliconflow_chat_model,
),
```

`parseChatProvider`：`ollama` | `siliconflow` 非法则回退 `ollama`。

- [x] **Step 5: 验证**

Run: `cd src-tauri && cargo build`
Expected: 迁移成功、编译通过

Run: `npm run build`
Expected: TypeScript 无报错

- [ ] **Step 6: 提交**

```bash
git add src/types/settings.ts src/utils/siliconflow-presets.ts src-tauri/src/db/migrations/ src/components/settings/ThemeBootstrap.tsx
git commit -m "feat(settings): add siliconflow chat provider settings keys"
```

---

### Task 2: Chat Provider 抽象层（阶段 8.2）

**Files:**
- Create: `src/services/llm/chat-provider.ts`
- Create: `src/services/llm/openai-stream-handler.ts`

- [x] **Step 1: 定义统一配置类型**

`src/services/llm/chat-provider.ts`：

```typescript
import type { ChatProvider } from '../../types/settings';
import type { StreamChunk } from './stream-handler';
import { streamChat as streamOllamaChat } from './stream-handler';
import { streamOpenAiChat, openAiChatComplete } from './openai-stream-handler';

export interface ChatRequestConfig {
  provider: ChatProvider;
  model: string;
  ollamaUrl: string;
  siliconflowApiKey: string;
  siliconflowBaseUrl: string;
  signal?: AbortSignal;
}

export async function* streamChatUnified(
  messages: Array<{ role: string; content: string }>,
  config: ChatRequestConfig,
): AsyncGenerator<StreamChunk> {
  if (config.provider === 'siliconflow') {
    if (!config.siliconflowApiKey.trim()) {
      yield { type: 'error', error: '未配置硅基流动 API Key，请在设置中填写后重试。' };
      return;
    }
    yield* streamOpenAiChat(messages, {
      model: config.model,
      baseUrl: config.siliconflowBaseUrl,
      apiKey: config.siliconflowApiKey,
      signal: config.signal,
    });
    return;
  }
  yield* streamOllamaChat(messages, config.model, config.ollamaUrl, config.signal);
}

export async function chatCompleteUnified(
  messages: Array<{ role: string; content: string }>,
  config: ChatRequestConfig,
): Promise<string> {
  if (config.provider === 'siliconflow') {
    if (!config.siliconflowApiKey.trim()) {
      throw new Error('未配置硅基流动 API Key');
    }
    return openAiChatComplete(messages, {
      model: config.model,
      baseUrl: config.siliconflowBaseUrl,
      apiKey: config.siliconflowApiKey,
      signal: config.signal,
      temperature: 0,
      maxTokens: 160,
    });
  }
  // Ollama 非流式：复用现有 fetch /api/chat 逻辑（从 answer-self-check 抽出或内联）
  ...
}
```

- [x] **Step 2: OpenAI SSE 流式**

`src/services/llm/openai-stream-handler.ts` 核心逻辑：

```typescript
export async function* streamOpenAiChat(
  messages: Array<{ role: string; content: string }>,
  opts: { model: string; baseUrl: string; apiKey: string; signal?: AbortSignal },
): AsyncGenerator<StreamChunk> {
  const base = opts.baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey.trim()}`,
    },
    body: JSON.stringify({ model: opts.model, messages, stream: true, temperature: 0.6 }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    yield { type: 'error', error: mapSiliconFlowHttpError(res.status, text) };
    return;
  }
  const reader = res.body?.getReader();
  // 解析 `data: {"choices":[{"delta":{"content":"..."}}]}` 行
  // 忽略 `data: [DONE]`
  // reasoning_content（DeepSeek-R1）本阶段丢弃，不写入 UI
  ...
  yield { type: 'done' };
}
```

`mapSiliconFlowHttpError` 映射：`401` → Key 无效；`402/429` → 余额或限流；其余附带 body 前 200 字。

- [x] **Step 3: OpenAI 非流式（自检用）**

```typescript
export async function openAiChatComplete(
  messages: Array<{ role: string; content: string }>,
  opts: { model: string; baseUrl: string; apiKey: string; signal?: AbortSignal; temperature?: number; maxTokens?: number },
): Promise<string> {
  const base = opts.baseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      stream: false,
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 256,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(mapSiliconFlowHttpError(res.status, await res.text()));
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
```

- [x] **Step 4: 验证**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/llm/chat-provider.ts src/services/llm/openai-stream-handler.ts
git commit -m "feat(llm): add chat provider abstraction and OpenAI SSE handler"
```

---

### Task 3: 接入 RAG 对话主流程（阶段 8.3）

**Files:**
- Modify: `src/services/llm/index.ts`
- Modify: `src/services/llm/answer-self-check.ts`
- Modify: `src/components/chat/ChatInterface.tsx`
- Modify: `src/components/chat/RetrievalWorkbench.tsx`（传入 provider 配置）

- [x] **Step 1: 扩展 `ChatOptions`**

`src/services/llm/index.ts`：

```typescript
export interface ChatOptions {
  // ...existing
  chatProvider?: ChatProvider;
  siliconflowApiKey?: string;
  siliconflowBaseUrl?: string;
}
```

检索失败提示改为 provider 感知：

```typescript
content: `检索知识库时出现错误…请检查 ${chatProvider === 'siliconflow' ? 'Ollama 嵌入服务 / ChromaDB' : 'Ollama / 嵌入模型 / ChromaDB'} 是否正常后重试。`,
```

- [x] **Step 2: 主流程改用 `streamChatUnified`**

将：

```typescript
for await (const chunk of streamChat(messages, model, ollamaUrl, signal))
```

替换为：

```typescript
const activeModel =
  chatProvider === 'siliconflow' ? siliconflowChatModel : model;

for await (const chunk of streamChatUnified(messages, {
  provider: chatProvider,
  model: activeModel,
  ollamaUrl,
  siliconflowApiKey,
  siliconflowBaseUrl,
  signal,
}))
```

`chat()` 参数从 `ChatOptions` 解构 `chatProvider`、`siliconflowApiKey`、`siliconflowBaseUrl`、`siliconflowChatModel`（或合并为 settings 快照对象）。

- [x] **Step 3: 自检改用 `chatCompleteUnified`**

`answer-self-check.ts`：删除直接 `fetch(ollamaUrl/api/chat)`，改为：

```typescript
export async function evaluateAnswerGroundedness(params: {
  config: ChatRequestConfig;
  userQuery: string;
  references: RerankedResult[];
  assistantAnswer: string;
  signal?: AbortSignal;
}): Promise<GroundednessVerdict>
```

解析 JSON 逻辑保持不变；请求失败仍 **fail-open**（`grounded: true`）。

- [x] **Step 4: ChatInterface 传入 settings**

`ChatInterface.tsx` 的 `handleSend` → `chat({...})` 增加：

```typescript
chatProvider: useSettingsStore.getState().settings.chat_provider,
siliconflowApiKey: useSettingsStore.getState().settings.siliconflow_api_key,
siliconflowBaseUrl: useSettingsStore.getState().settings.siliconflow_base_url,
siliconflowChatModel: useSettingsStore.getState().settings.siliconflow_chat_model,
```

`ChatHeader` 展示的 model 名：云端模式下显示 `siliconflow_chat_model`（可截短显示）。

- [x] **Step 5: 新建会话默认模型**

`ConversationList.tsx` 的 `create_conversation`：

```typescript
const st = useSettingsStore.getState().settings;
const llmModel =
  st.chat_provider === 'siliconflow'
    ? st.siliconflow_chat_model
    : st.default_chat_model;

await tauriCommand('create_conversation', { kbId, title: '新对话', llmModel });
```

- [ ] **Step 6: 验证（手动）**

1. `chat_provider=ollama`：对话与现网一致  
2. 切换 `siliconflow` + 有效 Key：流式回答正常  
3. 无 Key：输入框发送后显示明确错误，不白屏  

- [ ] **Step 7: 提交**

```bash
git add src/services/llm/ src/components/chat/
git commit -m "feat(chat): route RAG chat through configurable llm provider"
```

---

### Task 4: 设置页 UI（阶段 8.4）

**Files:**
- Create: `src/components/settings/ChatProviderSettings.tsx`
- Modify: `src/components/settings/OllamaSettings.tsx`
- Modify: `src/components/settings/OllamaModelList.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`（若需改 Tab 文案）

- [x] **Step 1: 新建 `ChatProviderSettings`**

区块结构：

1. **对话提供商** — Radix `ToggleGroup` 或两个 radio：`本地 Ollama` / `硅基流动`
2. **硅基流动**（仅 provider=siliconflow 时展开）
   - API Key：`type="password"` + 显示 `maskApiKey`
   - Base URL（高级，默认折叠）
   - 模型：`<select>` 来自 `SILICONFLOW_CHAT_PRESETS` + 「自定义」文本框
   - 按钮：**测试连接** — 发送最小请求 `messages:[{role:user,content:ping}]`, `max_tokens:5`
3. **隐私提示**（静态文案）：「检索到的文档片段将发送至硅基流动用于生成回答」

保存：逐项 `set_setting` + `useSettingsStore.setSettings`。

- [x] **Step 2: 重构 `OllamaSettings` 布局**

```
[ChatProviderSettings]        ← 新增，放在最上

--- 本地向量化（始终本地）---
  Ollama 服务 URL
  OllamaStatus
  嵌入模型选择（OllamaModelList 仅 embedding 区）

--- 本地对话模型（provider=ollama 时显示）---
  OllamaModelList 的 chat 区
```

Tab 标题可改为 **「模型与连接」**（可选，非必须）。

- [x] **Step 3: `OllamaModelList` 分支**

当 `chat_provider === 'siliconflow'`：
- 隐藏「拉取/删除 chat 模型」
- 显示当前 `siliconflow_chat_model` 与预设说明

嵌入模型区**始终显示**且行为不变。

- [x] **Step 4: 测试连接实现**

```typescript
async function testSiliconFlowConnection(apiKey: string, baseUrl: string, model: string) {
  const text = await openAiChatComplete(
    [{ role: 'user', content: '回复 OK 两个字母' }],
    { model, baseUrl, apiKey, maxTokens: 8, temperature: 0 },
  );
  return text;
}
```

成功 Toast：「硅基流动连接正常」；失败 Toast 展示 `mapSiliconFlowHttpError` 文案。

- [ ] **Step 5: 验证**

Run: `npm run tauri dev`
- 设置页切换 provider 无布局错位
- Key 保存重启后仍在（ThemeBootstrap 加载）
- 测试连接按钮可用

- [ ] **Step 6: 提交**

```bash
git add src/components/settings/
git commit -m "feat(settings): add siliconflow provider configuration UI"
```

---

### Task 5: 错误处理、边界与验收（阶段 8.5）

**Files:**
- Modify: `src/services/llm/openai-stream-handler.ts`（错误映射表）
- Modify: `src/components/chat/ChatHeader.tsx`（provider badge）
- Modify: `docs/superpowers/plans/2026-05-30-phase8-siliconflow-chat-provider.md`（勾选验收项）

- [x] **Step 1: 统一错误映射**

| HTTP | 用户可见文案 |
|------|----------------|
| 401 | API Key 无效或已过期，请在设置中更新 |
| 402 | 账户余额不足，请充值后重试 |
| 429 | 请求过于频繁或触发限流，请稍后再试 |
| 5xx | 硅基流动服务暂时不可用（{status}） |
| 网络失败 | 无法连接硅基流动，请检查网络 |

- [x] **Step 2: ChatHeader 展示提供商**

在模型名旁增加小 badge：`本地` / `云端`，避免用户不知当前走哪条链路。

- [x] **Step 3: 自检开关行为**

当 `chat_provider === 'siliconflow'` 且 `answer_self_check === true`：
- 设置页增加提示：「云端模式下自检会额外消耗一次 API 调用」
- 逻辑不变，仍走 `chatCompleteUnified`

- [x] **Step 4: 验收清单**（构建已通过；下列手动项待你在本机确认）

- [ ] `chat_provider=ollama`：行为与阶段 8 之前一致
- [ ] `chat_provider=siliconflow` + 有效 Key：对话流式正常、引用仍正确
- [ ] 无 Key / 错误 Key：错误信息清晰，不崩溃
- [ ] 嵌入 / 导入 / 检索仍只依赖 Ollama，不因 provider 切换而 broken
- [ ] 切换 provider 后新建对话，`llm_model` 字段正确
- [ ] 深色 / 浅色设置页无样式回归
- [x] `npm run build` 通过
- [x] `cd src-tauri && cargo build` 通过

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat(chat): polish siliconflow errors and acceptance for phase 8"
```

---

### Task 6（可选）: Rust 代理强化 API Key 安全（阶段 8.6）

**适用：** 不希望 API Key 出现在 WebView 内存 / DevTools 中。

**Files:**
- Create: `src-tauri/src/services/siliconflow.rs`
- Create: `src-tauri/src/commands/siliconflow.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/services/llm/openai-stream-handler.ts` → 改为 `invoke` + 监听 Tauri Event

- [ ] **Step 1: Rust 读取 settings 中的 key，前端只传 messages/model**

```rust
#[tauri::command]
async fn siliconflow_chat_stream(
  app: AppHandle,
  model: String,
  messages: Vec<ChatMessage>,
) -> Result<(), AppError> {
  let key = settings::get("siliconflow_api_key")?.unwrap_or_default();
  // reqwest POST stream, emit "siliconflow:chat-chunk" / "siliconflow:chat-done" / "siliconflow:chat-error"
}
```

- [ ] **Step 2: 前端 `streamOpenAiChat` 在 Tauri 环境走 invoke，浏览器 dev 仍可直接 fetch（`import.meta.env` 分支）**

- [ ] **Step 3: 设置页保存 Key 后，前端 store 仅存 `hasSiliconflowKey: boolean`，不存明文**

- [ ] **Step 4: 验收** — DevTools Network / Sources 中搜不到完整 Key

---

## 推荐模型与成本提示（写入设置页帮助文案）

| 场景 | 模型 id |
|------|---------|
| 质量优先 | `Qwen/Qwen2.5-72B-Instruct` |
| 性价比 | `Qwen/Qwen2.5-32B-Instruct` |
| 通用强 | `deepseek-ai/DeepSeek-V3` |

单次 RAG 问答约 3k–10k input tokens + 0.5k–2k output；关闭自检可省约 1 次调用。

---

## PR 拆分建议

| PR | 内容 |
|----|------|
| PR1 | Task 1 — settings + migration |
| PR2 | Task 2–3 — provider + RAG 接入 |
| PR3 | Task 4–5 — UI + 验收 |
| PR4（可选） | Task 6 — Rust 代理 |

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 检索片段上传云端 | 设置页隐私说明；敏感库建议继续用本地 provider |
| API Key 明文存 SQLite | Phase 1 可接受；Phase 2 Rust 代理 + 可选 OS keychain |
| 云端延迟高于本地 | Header 显示「云端」；流式首 token 前保留现有 retrieving UI |
| 模型 id 变更 | 预设列表 + 自定义输入；测试连接按钮 |

---

## 备注

- 本计划为 **方案 A**；若后续要将 **嵌入** 也迁至硅基流动，另写 `phase8b-siliconflow-embedding.md`（涉及全库 re-embed，不与此合并）。
- 实现完成后更新 README「模型配置」一节（可选，非本 Task 阻塞项）。
