# Cursor 极简三栏工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把应用重构成 Cursor 式极简三栏：左「库+会话」、中「对话+本地/云端输入」、右「文档树+预览（默认关）」。

**Architecture:** 在现有 Tauri/React 路由上新增 `WorkbenchShell` 骨架与右栏状态；用 `KbConversationSidebar` 替换深色侧栏库列表；`ComposerBar` 扩展输入区提供商/模型；`SourcesPanel` 挂文档列表与简化预览。不改 RAG 内核；设置页保持现有左导航。

**Tech Stack:** React 19、React Router 7、现有 `tauriCommand`、`useSettingsStore`、`SILICONFLOW_CHAT_PRESETS`、CSS 变量 + Tailwind。

**Spec:** `docs/superpowers/specs/2026-08-07-cursor-minimal-workbench-design.md`

## Global Constraints

- 美学：极简少彩；浅灰/白；浅侧栏（非深石板）；无渐变光晕、无 hero 彩条
- 右栏资料面板：**默认关闭**；`localStorage` 键 `ui.sourcesPanelOpen`
- 选库默认进 `/kb/:id/chat`，不再默认厚概览
- 输入区：本地|云端绑定 `chat_provider`；云端模型下拉复用 SiliconFlow 预设
- 不重写 RAG；不做行级溯源；不抄 Cursor Automations/Slack
- 与墨书规格冲突处，以 Cursor 极简规格为准
- 每个 Task 可独立验收并单独 commit

## File map

| 文件 | 职责 |
|------|------|
| `src/styles/variables.css` | 极简灰白令牌；去掉暖纸/深侧栏/装饰渐变 |
| `src/hooks/useSourcesPanel.ts` | 右栏开关 + localStorage |
| `src/components/layout/WorkbenchShell.tsx` | 中+右栏骨架（左栏仍在 AppLayout） |
| `src/components/layout/AppLayout.tsx` | 挂新侧栏 + Workbench 上下文 |
| `src/components/layout/Titlebar.tsx` | 资料面板开关按钮 |
| `src/components/layout/KbConversationSidebar.tsx` | 库→会话树 |
| `src/components/chat/ComposerBar.tsx` | 本地/云端 + 模型 + 发送（可自 InputBar 演进） |
| `src/components/chat/InputBar.tsx` | 改为委托 ComposerBar 或就地改造 |
| `src/components/sources/SourcesPanel.tsx` | 文档列表 + 预览 |
| `src/components/sources/DocumentPreviewPane.tsx` | 简化正文/分块预览 |
| `src/App.tsx` | `/kb/:id` → redirect chat |
| `src/components/chat/KnowledgeBaseChatLayout.tsx` | 去掉内嵌会话列表；嵌入 Workbench |

---

### Task 1: 极简灰白令牌

**Files:**
- Modify: `src/styles/variables.css`
- Modify: `src/components/layout/Sidebar.tsx`（若仍引用深侧栏文案色，随后 Task 3 替换；本任务只保证 token）

**Interfaces:**
- Produces: 浅色 `--color-bg-primary: #f7f7f8`；`--color-surface: #ffffff`；`--color-bg-sidebar: #f3f3f4`；边框 `#e5e5e5`；文字 `#1a1a1a` / `#6b6b6b`；`--gradient-page` 改为纯色或极淡；去掉琥珀光晕

- [ ] **Step 1: 改写 light 段令牌**

按规格表格设置 light（及 `:root:not([data-theme])`）：

```css
--color-bg-primary: #f7f7f8;
--color-bg-secondary: #efefef;
--color-surface: #ffffff;
--color-bg-sidebar: #f3f3f4;
--color-bg-hover: #ebebeb;
--color-bg-active: #e4e4e4;
--color-text-primary: #1a1a1a;
--color-text-secondary: #6b6b6b;
--color-text-sidebar: #1a1a1a;
--color-text-sidebar-dim: #6b6b6b;
--color-border: #e5e5e5;
--color-border-sidebar: #e5e5e5;
--color-btn-ghost-hover: #ebebeb;
--gradient-page: var(--color-bg-primary);
```

侧栏相关 hover/active 改为浅灰（与主区同系）。Accent 可保留 `#0f766e` 但仅用于按钮/选中细线。  
Dark 段改为中性深灰层级，去掉青绿氛围径向渐变。

- [ ] **Step 2: `npm run build` PASS**

- [ ] **Step 3: Commit**

```bash
git add src/styles/variables.css
git commit -m "style: switch to cursor-minimal gray tokens"
```

---

### Task 2: 右栏开关 hook + 测试

**Files:**
- Create: `src/hooks/useSourcesPanel.ts`
- Create: `src/hooks/useSourcesPanel.test.ts`

**Interfaces:**
- Produces:

```ts
export const SOURCES_PANEL_STORAGE_KEY = 'ui.sourcesPanelOpen';

export function useSourcesPanel(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};
```

默认 `open === false`。首次无 localStorage 时为 false；有值则解析 `'true'|'false'`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { SOURCES_PANEL_STORAGE_KEY } from './useSourcesPanel';

// 测纯逻辑：抽出 readStoredOpen / writeStoredOpen 便于单测
import { readStoredOpen, writeStoredOpen } from './useSourcesPanel';

describe('sources panel storage', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to false when missing', () => {
    expect(readStoredOpen()).toBe(false);
  });

  it('round-trips true', () => {
    writeStoredOpen(true);
    expect(localStorage.getItem(SOURCES_PANEL_STORAGE_KEY)).toBe('true');
    expect(readStoredOpen()).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`npx vitest run src/hooks/useSourcesPanel.test.ts`

- [ ] **Step 3: 实现 hook + 导出 read/write**

```ts
export const SOURCES_PANEL_STORAGE_KEY = 'ui.sourcesPanelOpen';

export function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(SOURCES_PANEL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeStoredOpen(open: boolean): void {
  try {
    localStorage.setItem(SOURCES_PANEL_STORAGE_KEY, open ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function useSourcesPanel() {
  const [open, setOpenState] = useState(readStoredOpen);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeStoredOpen(next);
  }, []);
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);
  return { open, setOpen, toggle };
}
```

可选：用 React Context（`SourcesPanelProvider`）包在 `AppLayout`，供 Titlebar 与 Shell 共享。**推荐 Context**，避免双实例状态分裂。

- [ ] **Step 4: 测试 PASS；Commit**

```bash
git add src/hooks/useSourcesPanel.ts src/hooks/useSourcesPanel.test.ts
git commit -m "feat: add sources panel open state with localStorage"
```

---

### Task 3: SourcesPanelProvider + Titlebar 开关 + WorkbenchShell

**Files:**
- Create: `src/context/SourcesPanelContext.tsx`（若 Task 2 未建）
- Create: `src/components/layout/WorkbenchShell.tsx`
- Modify: `src/components/layout/AppLayout.tsx`
- Modify: `src/components/layout/Titlebar.tsx`

**Interfaces:**
- Consumes: `useSourcesPanel` / Context
- Produces: `WorkbenchShell({ children }: { children: ReactNode })` — 中栏 `flex-1` + 条件渲染右栏槽（先放 placeholder）

- [ ] **Step 1: Provider 挂 AppLayout**

```tsx
<SourcesPanelProvider>
  <Titlebar />
  ...
  <Sidebar /> {/* Task 4 替换 */}
  <main className="flex min-w-0 flex-1 overflow-hidden">
    <WorkbenchShell>
      <Outlet />
    </WorkbenchShell>
  </main>
</SourcesPanelProvider>
```

注意：设置页也在 Outlet 内；`WorkbenchShell` 在 `/settings` 时可让右栏强制不显示，或整页全宽（`useLocation` 判断）。

- [ ] **Step 2: Titlebar 加按钮**

```tsx
<button
  type="button"
  data-tauri-no-drag
  aria-pressed={open}
  aria-label={open ? '关闭资料面板' : '打开资料面板'}
  onClick={toggle}
  className="..."
>
  {/* 方框+右侧竖条图标，对齐 Cursor panel toggle */}
</button>
```

- [ ] **Step 3: WorkbenchShell**

```tsx
export function WorkbenchShell({ children }: { children: ReactNode }) {
  const { open } = useSourcesPanel();
  const loc = useLocation();
  const hideSources = loc.pathname.startsWith('/settings') || loc.pathname === '/';
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      {open && !hideSources ? (
        <aside className="flex w-[min(420px,42%)] shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)]">
          {/* Task 6 填入 SourcesPanel */}
          <div className="p-3 text-sm text-[var(--color-text-secondary)]">资料面板</div>
        </aside>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: 目视 — 默认无右栏；点按钮出现占位；刷新保持状态**

- [ ] **Step 5: Commit**

```bash
git add src/context/SourcesPanelContext.tsx src/components/layout/WorkbenchShell.tsx src/components/layout/AppLayout.tsx src/components/layout/Titlebar.tsx
git commit -m "feat(ui): workbench shell with toggleable sources panel"
```

---

### Task 4: KbConversationSidebar（库→会话）

**Files:**
- Create: `src/components/layout/KbConversationSidebar.tsx`
- Modify: `src/components/layout/AppLayout.tsx` — 用新侧栏替换 `Sidebar.tsx`（旧文件可暂留）
- Modify: `src/App.tsx` — 选库导航目标

**Interfaces:**
- Consumes: `list_knowledge_bases`、`list_conversations`、`useAppNavigate`、`useParams`/`useLocation`
- Produces: 点击库 → `navigate(\`/kb/${id}/chat\`)`；点击会话 → `navigate(\`/kb/${id}/chat/${cid}\`)`；新建对话按钮调用现有创建会话 API（与 ConversationList 一致）

- [ ] **Step 1: 实现侧栏结构**

```
[本地知识库]
[+ 新建库]
知识库 A          ▾
  会话1     2h
  会话2     1d
  + 新对话
知识库 B          ▸
────────
设置
```

选中态：浅灰底 + 左侧 2px accent 线。极简，无彩色头像条亦可（或单色文件图标）。

展开逻辑：当前路由库自动展开；其它库可点击展开/收起。

- [ ] **Step 2: 从 ConversationList 复用「新建对话」调用**

查找现有 `create_conversation`（或等价）命令与跳转，原样复用，勿新造 API。

- [ ] **Step 3: App.tsx 路由**

```tsx
<Route path="kb/:id" element={<Navigate to="chat" replace />} />
```

或 loader 式：`element={<Navigate to={`/kb/${id}/chat`} />}` 需用包装组件读 params：

```tsx
function KbIndexRedirect() {
  const { id } = useParams();
  return <Navigate to={`/kb/${id}/chat`} replace />;
}
```

首页 `/`：保留简单库列表落地页，或改为「无选中时中栏空状态」。推荐：保留 `/` 为空状态引导（极简），侧栏仍可操作。

- [ ] **Step 4: KnowledgeBaseChatLayout 去掉左侧 ConversationList**（改由全局侧栏承担），只保留中栏 Outlet + 排查入口弱化

- [ ] **Step 5: `npm run build`；目视库→会话导航**

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/KbConversationSidebar.tsx src/components/layout/AppLayout.tsx src/App.tsx src/components/chat/KnowledgeBaseChatLayout.tsx
git commit -m "feat(ui): nested kb and conversation sidebar"
```

---

### Task 5: ComposerBar — 本地/云端 + 模型选择

**Files:**
- Create: `src/components/chat/ComposerBar.tsx`（或大幅改 `InputBar.tsx`）
- Modify: `src/components/chat/ChatInterface.tsx` — 使用新输入条
- Modify: settings 写入：`set_setting` for `chat_provider` / `siliconflow_chat_model`（对齐 `ChatProviderSettings`）

**Interfaces:**
- Consumes: `useSettingsStore`、`SILICONFLOW_CHAT_PRESETS`、现有 `InputBar` 发送逻辑
- Produces: 底部条含 Toggle「本地|云端」；云端时 `select`/`popover` 选模型；本地显示当前 `default_chat_model` 只读芯片

- [ ] **Step 1: UI 骨架（Cursor 输入条风格）**

```
┌─────────────────────────────────────────────┐
│  [textarea]                                 │
│  [本地|云端]  [模型 ▾]              [发送]   │
└─────────────────────────────────────────────┘
```

白底、细边框、少阴影。

- [ ] **Step 2: 切换 provider**

```ts
async function setProvider(next: 'ollama' | 'siliconflow') {
  await tauriCommand('set_setting', { key: 'chat_provider', value: JSON.stringify(next) });
  setSettings({ chat_provider: next });
}
```

- [ ] **Step 3: 云端模型**

选项 = `SILICONFLOW_CHAT_PRESETS` + 当前自定义值；变更写 `siliconflow_chat_model`。

- [ ] **Step 4: 保留 Enter 发送 / Stop 等 InputBar 行为**

- [ ] **Step 5: 构建 + 目视切换不影响发送（有 key 时）**

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/ComposerBar.tsx src/components/chat/InputBar.tsx src/components/chat/ChatInterface.tsx
git commit -m "feat(chat): composer with local/cloud and model picker"
```

---

### Task 6: SourcesPanel 文档列表 + 预览

**Files:**
- Create: `src/components/sources/SourcesPanel.tsx`
- Create: `src/components/sources/DocumentPreviewPane.tsx`
- Modify: `src/components/layout/WorkbenchShell.tsx` — 换入真实面板
- Optional: 引用跳转时 `setOpen(true)`（MessageBubble / Citation 路径）

**Interfaces:**
- Consumes: 当前 `kbId`（从 `useParams` 或 context；无 kb 时显示空态）
- `list_documents`；预览：读文档正文 API 或已有 `get_document` / 分块列表（查现有 DocumentDetailPage 用的 command，复用最简路径）
- Produces: 左窄列表 + 右预览；或上下分割（列表上、预览下）——推荐 **上列表、下预览**（右栏宽度有限）

- [ ] **Step 1: SourcesPanel**

无 `kbId`：文案「选择知识库后查看文档」。  
有列表：文件名 + 状态；点击设 `selectedDocId`。

- [ ] **Step 2: DocumentPreviewPane**

显示文件名 + 可滚动文本（截断长文可先 `slice` 或虚拟列表）；失败显示错误。不要求完整 PDF 渲染——与现有能力对齐，Markdown/TXT 优先。

- [ ] **Step 3: 挂到 WorkbenchShell**

- [ ] **Step 4: （可选）Citation「查看原文」打开右栏**

若改动面小：在现有 navigate 到 document 的路径外，增加 `setOpen(true)`。若冲突大则本 Task 跳过，记入验收可选。

- [ ] **Step 5: Commit**

```bash
git add src/components/sources/SourcesPanel.tsx src/components/sources/DocumentPreviewPane.tsx src/components/layout/WorkbenchShell.tsx
git commit -m "feat(ui): sources panel with document list and preview"
```

---

### Task 7: 中栏去噪 + 极简收尾

**Files:**
- Modify: `KnowledgeBaseChatLayout.tsx`、`RetrievalWorkbench.tsx`、`ChatInterface.tsx`、`KbSectionNav` 使用处
- Modify: 去掉概览 hero、列表页重彩（`KnowledgeBaseList` / Overview 降级或仅重定向）
- Modify: `Sidebar.tsx` 若已弃用可从 AppLayout 移除引用

**Interfaces:**
- 中栏：无 KbSectionNav 顶栏三段（或极弱化）；排查入口移到标题旁 icon
- 首页 `/`：极简空状态「从左侧选择或新建知识库」

- [ ] **Step 1: Chat layout 只渲染 Outlet + 弱排查**
- [ ] **Step 2: 删除/ bypass 厚概览 hero（已 redirect）**
- [ ] **Step 3: 目视对照规格验收清单**
- [ ] **Step 4: `npx vitest run` + `npm run build`**
- [ ] **Step 5: Commit**

```bash
git add -u src/
git commit -m "refactor(ui): declutter chat stage for minimal workbench"
```

---

### Task 8: 全量验收

- [ ] **Step 1:** `npx vitest run` — PASS  
- [ ] **Step 2:** `npm run build` — PASS  
- [ ] **Step 3:** 对照规格 §7 勾选：
  - 左栏库→会话
  - 中栏干净 + 本地/云端 + 云端模型
  - 右栏默认关、可开关、有文档预览
  - 极简少彩
  - 选库进对话  
- [ ] **Step 4:** 缺口仅允许记「引用自动开右栏」为 follow-up

---

## Spec coverage

| Spec | Task |
|------|------|
| 极简灰白 token | 1 |
| 右栏默认关 + 开关 | 2, 3 |
| 左栏库+会话 | 4 |
| 选库进 chat | 4 |
| Composer 本地/云端/模型 | 5 |
| 右栏文档+预览 | 6 |
| 去噪/去厚概览主导 | 7 |
| 验收 | 8 |

## 风险与顺序

- Task 4 与现有 `ConversationList` 易重复状态：以全局侧栏为准，chat layout 内列表必须删除。
- Provider Context 必须单例，否则 Titlebar 与 Shell 开关不同步。
- 文档预览能力因文件类型而异：先做文本/markdown，PDF 可显示「请在文档页打开」链接兜底。
