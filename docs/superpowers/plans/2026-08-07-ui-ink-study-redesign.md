# 墨书工作台界面重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「本地知识库」做成有品牌感的墨书工作台：深侧栏 + 纸感主区、厚概览默认进库、居中对话、排查检索收成默认关闭的抽屉，并补齐截图证明。

**Architecture:** 只改前端壳层与信息架构；路由 path 基本保留。令牌与 BrandMark 先落地，再改列表/概览，最后把 `RetrievalWorkbench` 从常驻分栏改成可控抽屉，对话阅读栏居中。概览「最近对话 / 文档动态」复用已有 `list_conversations` / `list_documents`，不新增后端子系统。

**Tech Stack:** Tauri 2 + React 19 + TypeScript + Tailwind 4 + CSS 变量（`variables.css`）+ Vitest + 现有 `tauriCommand`。

**Spec:** `docs/superpowers/specs/2026-08-07-ui-ink-study-redesign.md`

## Global Constraints

- 产品名保持「本地知识库」；气质为墨书工作台（青绿 + 纸感 + 深石板侧栏）
- 禁止紫靛蓝主调、暖奶油+赤陶套路、多层 glow、药丸标签堆砌
- 圆角：控件 `8px`、卡片/弹层 `12px`；徽章/ pill 字号用 `--text-meta`（12px），禁止随意 `text-[9px]` / `text-[10px]`
- 进库默认 `/kb/:id` 厚概览；对话主 CTA「开始提问」；排查抽屉默认关闭
- 本阶段不做行级溯源、不改 RAG 默认路径、不大改 Rust API
- 动效仅 2～3 处，遵守 `prefers-reduced-motion`
- 每个 Task 结束必须可目视或用 Vitest 验收，并单独 commit

## File map

| 文件 | 职责 |
|------|------|
| `src/styles/variables.css` | 纸感浅色、深侧栏、圆角、字体栈 |
| `src/components/brand/BrandMark.tsx` | 书页折角 mark（Titlebar / 侧栏复用） |
| `public/brand-mark.svg` + `index.html` | favicon |
| `src/components/layout/Titlebar.tsx` | 左侧 mark + 字标 |
| `src/components/layout/Sidebar.tsx` | 深侧栏品牌区与列表对比 |
| `src/components/layout/AppLayout.tsx` | 主区纸感底（可轻 gradient） |
| `src/components/common/DependencyHealthBanner.tsx` | 会话内关闭 |
| `src/utils/kb-theme.ts` | 已有色条；卡片消费 strip |
| `src/components/knowledge-base/KnowledgeBaseCard.tsx` | 顶色条 + 主题头像 |
| `src/components/knowledge-base/KbSectionNav.tsx` | 概览\|文档\|对话 三段导航 |
| `src/utils/document-health.ts` | 文档状态汇总纯函数 |
| `src/components/knowledge-base/KnowledgeBaseOverview.tsx` | 厚概览 |
| `src/components/chat/KnowledgeBaseChatLayout.tsx` | 居中栏 + 排查开关 |
| `src/components/chat/RetrievalWorkbench.tsx` | 抽屉化；Provider 保留 |
| `src/components/chat/ChatHeader.tsx` | 文案对齐主路径；接入排查按钮可选 |
| `src/components/chat/ConversationList.tsx` | 细栏视觉 |
| `src/components/document/DocumentList.tsx` / `DocumentCard.tsx` | 令牌与状态对齐 |
| `docs/screenshots/*.png` + `README.md` | 演示证明 |

---

### Task 1: 纸感令牌与圆角对齐

**Files:**
- Modify: `src/styles/variables.css`
- Modify: `src/styles/global.css`（若需 `prefers-reduced-motion` 补强，仅加 utility）
- Test: 目视 + `npm run build`（类型/构建）

**Interfaces:**
- Consumes: 无
- Produces: 浅色纸感 token、深侧栏 token、`--radius-control: 8px`、`--radius-card: 12px`、`--font-sans` 去掉 Inter 主脸依赖

- [ ] **Step 1: 更新浅色与圆角令牌**

将 `variables.css` 中 `:root` 圆角改为：

```css
--radius-card: 12px;
--radius-control: 8px;
```

将 `:root:not([data-theme]), :root[data-theme='light']` 改为（保留既有 badge / citation 变量名）：

```css
--color-bg-primary: #f7f6f3;
--color-bg-secondary: #efece6;
--color-surface: #fffcf8;
--color-bg-sidebar: #1c2422;
--color-bg-hover: #2a3532;
--color-bg-active: #33403c;
--color-text-primary: #18181b;
--color-text-secondary: #71717a;
--color-text-sidebar: #e8e6e1;
--color-text-sidebar-dim: #a8b0ad;
--color-border: #e7e2d9;
--color-border-dark: #d6d0c6;
--color-border-sidebar: #2a3532;
--color-muted-bg: #efece6;
--color-user-bubble-bg: #0f766e;
--color-user-bubble-fg: #ffffff;
--color-sidebar-icon-bg: #0f766e;
--color-sidebar-icon-fg: #ffffff;
--color-btn-ghost-hover: color-mix(in srgb, #ffffff 8%, transparent);
--gradient-page: linear-gradient(180deg, #f7f6f3 0%, #f3f1ec 100%);
```

字体栈去掉 `'Inter'`：

```css
--font-sans:
  'Plus Jakarta Sans', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

深色主题：侧栏保持深石板系，accent 仍为青绿；不要把浅色侧栏逻辑带回去。

- [ ] **Step 2: 构建检查**

Run: `npm run build`  
Expected: 成功（允许既有无关 warning，无 TS error）

- [ ] **Step 3: 目视（dev）**

Run: `npm run tauri` 或项目惯用 `npm run tauri dev` / `npx tauri dev`  
Expected: 浅色主区偏纸感；侧栏已变深（即便内容区尚未全部适配，token 已生效）

- [ ] **Step 4: Commit**

```bash
git add src/styles/variables.css src/styles/global.css
git commit -m "$(cat <<'EOF'
style: align ink-study paper tokens and radii

EOF
)"
```

---

### Task 2: BrandMark + Titlebar + Favicon

**Files:**
- Create: `src/components/brand/BrandMark.tsx`
- Create: `public/brand-mark.svg`
- Modify: `src/components/layout/Titlebar.tsx`
- Modify: `index.html`
- Test: `src/components/brand/BrandMark.test.tsx`（render 冒烟，若项目暂无 RTL 则改为纯 SVG 字符串导出测）

**Interfaces:**
- Consumes: accent CSS 变量
- Produces: `BrandMark({ size?: number; className?: string })`；favicon `/brand-mark.svg`

- [ ] **Step 1: 添加 BrandMark 组件**

```tsx
// src/components/brand/BrandMark.tsx
export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="var(--color-accent, #0f766e)" />
      <path
        d="M8 7h12a3 3 0 0 1 3 3v15H11a3 3 0 0 0-3 3V7z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M20 7l3 3h-3V7z" fill="#fff" opacity="0.9" />
    </svg>
  );
}
```

同步写 `public/brand-mark.svg`（硬编码 `#0f766e` 与白描边，供 favicon）。

- [ ] **Step 2: Titlebar 显示品牌**

在拖拽区内（仍整条 `data-tauri-drag-region`）放入不可点的品牌行：

```tsx
import { BrandMark } from '../brand/BrandMark';

// 在 drag region 内：
<div className="pointer-events-none flex items-center gap-2">
  <BrandMark size={18} />
  <span className="text-xs font-semibold tracking-tight text-[var(--color-text-sidebar)]">
    本地知识库
  </span>
</div>
```

Titlebar 背景继续用 `var(--color-bg-sidebar)`，与深侧栏连成一条顶壳。

- [ ] **Step 3: 替换 favicon**

`index.html`：

```html
<link rel="icon" type="image/svg+xml" href="/brand-mark.svg" />
```

- [ ] **Step 4: 验收**

Run: `npm run build`  
Expected: PASS  
目视：Titlebar 左侧有 mark + 字标；浏览器/窗口图标非 Vite。

- [ ] **Step 5: Commit**

```bash
git add src/components/brand/BrandMark.tsx public/brand-mark.svg src/components/layout/Titlebar.tsx index.html
git commit -m "$(cat <<'EOF'
feat(ui): add BrandMark to titlebar and favicon

EOF
)"
```

---

### Task 3: 深侧栏品牌区

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/AppLayout.tsx`（主区可用 `background: var(--gradient-page)`）

**Interfaces:**
- Consumes: `BrandMark`；`--color-bg-sidebar` 等
- Produces: 侧栏顶品牌与列表在深底上可读；主区纸感

- [ ] **Step 1: Sidebar 品牌改用 BrandMark**

替换现有灰图标块为：

```tsx
import { BrandMark } from '../brand/BrandMark';
// ...
<BrandMark size={36} />
<span className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-sidebar)]">
  本地知识库
</span>
```

检查 `sidebarItemClass`：active 条在深底上仍用 accent；hover 用 `--color-bg-hover`。侧栏底部「设置」同色系。

- [ ] **Step 2: AppLayout 主区纸感**

```tsx
<main
  className="flex min-w-0 flex-1 flex-col overflow-y-auto"
  style={{ background: 'var(--gradient-page)' }}
>
```

外层 `h-screen` 背景可用 `--color-bg-primary`。

- [ ] **Step 3: 目视验收**

Expected: 深侧栏 + 浅主区对比明显；品牌区与 Titlebar 同系。

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/AppLayout.tsx
git commit -m "$(cat <<'EOF'
style(ui): dark sidebar chrome for ink-study shell

EOF
)"
```

---

### Task 4: 健康条会话内关闭

**Files:**
- Modify: `src/components/common/DependencyHealthBanner.tsx`

**Interfaces:**
- Consumes: `useDependencyHealth`
- Produces: 关闭按钮；`useState(dismissed)` 会话级；`issues` 变化时可选择保持关闭（spec：会话内关闭即可）

- [ ] **Step 1: 增加关闭**

```tsx
const [dismissed, setDismissed] = useState(false);
if (dismissed || ready || issues.length === 0) return null;
// 增加按钮：
<button type="button" onClick={() => setDismissed(true)} aria-label="关闭提示">关闭</button>
```

圆角类改为 `rounded-[length:var(--radius-control)]`，去掉裸 `rounded-md`。

- [ ] **Step 2: 目视** — 有告警时可关；刷新页面再出现。

- [ ] **Step 3: Commit**

```bash
git add src/components/common/DependencyHealthBanner.tsx
git commit -m "$(cat <<'EOF'
feat(ui): allow dismissing dependency health banner for session

EOF
)"
```

---

### Task 5: 知识库卡片色条

**Files:**
- Modify: `src/components/knowledge-base/KnowledgeBaseCard.tsx`
- Modify: `src/components/knowledge-base/KnowledgeBaseList.tsx`（若有硬编码灰图标）

**Interfaces:**
- Consumes: `kbThemeForId(kb.id)` → `strip` / `avatarBg` / `avatarFg` / `kind`
- Produces: 顶色条卡片；StatCell 标签用 `text-[length:var(--text-meta)]`

- [ ] **Step 1: 改造卡片结构**

```tsx
import { kbThemeForId } from '../../utils/kb-theme';
import { KbKindIcon } from './KbKindIcon';

const theme = kbThemeForId(kb.id);

return (
  <button type="button" /* 原 onClick / className，外层 overflow-hidden */ className="... overflow-hidden p-0 ...">
    <div className="h-1 w-full" style={{ background: theme.strip }} />
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-[length:var(--radius-control)]"
          style={{ background: theme.avatarBg, color: theme.avatarFg }}
        >
          <KbKindIcon kind={theme.kind} />
        </span>
        {/* 标题描述不变 */}
      </div>
      {/* 统计区：StatCell label 改为 text-[length:var(--text-meta)] */}
    </div>
  </button>
);
```

hover 可加 `hover:-translate-y-0.5 transition-transform`（并在 `@media (prefers-reduced-motion: reduce)` 下禁用——可在 `global.css` 加 `.motion-safe\:...` 或条件 class）。

- [ ] **Step 2: 目视** — 不同 KB 色条不同；无统一灰文件夹。

- [ ] **Step 3: Commit**

```bash
git add src/components/knowledge-base/KnowledgeBaseCard.tsx
git commit -m "$(cat <<'EOF'
feat(ui): apply kb-theme strip and avatar on knowledge base cards

EOF
)"
```

---

### Task 6: 文档健康汇总纯函数 + 测试

**Files:**
- Create: `src/utils/document-health.ts`
- Create: `src/utils/document-health.test.ts`

**Interfaces:**
- Consumes: `Document` / `DocumentStatus` from `src/types/document.ts`
- Produces:

```ts
export type DocumentHealthSummary = {
  ready: number;
  processing: number; // pending + processing
  error: number;
  total: number;
};

export function summarizeDocumentHealth(
  docs: Array<{ status: DocumentStatus }>,
): DocumentHealthSummary;
```

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest';
import { summarizeDocumentHealth } from './document-health';

describe('summarizeDocumentHealth', () => {
  it('buckets pending with processing and counts ready/error', () => {
    expect(
      summarizeDocumentHealth([
        { status: 'ready' },
        { status: 'ready' },
        { status: 'pending' },
        { status: 'processing' },
        { status: 'error' },
      ]),
    ).toEqual({ ready: 2, processing: 2, error: 1, total: 5 });
  });

  it('returns zeros for empty list', () => {
    expect(summarizeDocumentHealth([])).toEqual({
      ready: 0,
      processing: 0,
      error: 0,
      total: 0,
    });
  });
});
```

- [ ] **Step 2: Run 确认失败**

Run: `npx vitest run src/utils/document-health.test.ts`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
import type { DocumentStatus } from '../types/document';

export type DocumentHealthSummary = {
  ready: number;
  processing: number;
  error: number;
  total: number;
};

export function summarizeDocumentHealth(
  docs: Array<{ status: DocumentStatus }>,
): DocumentHealthSummary {
  const summary: DocumentHealthSummary = {
    ready: 0,
    processing: 0,
    error: 0,
    total: docs.length,
  };
  for (const d of docs) {
    if (d.status === 'ready') summary.ready += 1;
    else if (d.status === 'error') summary.error += 1;
    else summary.processing += 1;
  }
  return summary;
}
```

- [ ] **Step 4: Run 确认通过**

Run: `npx vitest run src/utils/document-health.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/document-health.ts src/utils/document-health.test.ts
git commit -m "$(cat <<'EOF'
feat: add document health summary helper for overview

EOF
)"
```

---

### Task 7: KbSectionNav + 厚概览

**Files:**
- Create: `src/components/knowledge-base/KbSectionNav.tsx`
- Modify: `src/components/knowledge-base/KnowledgeBaseOverview.tsx`
- Modify: `src/components/document/DocumentList.tsx`（挂导航）
- Modify: `src/components/chat/KnowledgeBaseChatLayout.tsx`（面包屑换/兼用导航）

**Interfaces:**
- Consumes: `useParams` `id`；`list_conversations`；`list_documents`；`summarizeDocumentHealth`
- Produces: `KbSectionNav({ kbId: string; active: 'overview' | 'documents' | 'chat' })`

- [ ] **Step 1: 实现 KbSectionNav**

```tsx
import { useAppNavigate } from '../../hooks/useAppNavigate';

const ITEMS = [
  { key: 'overview', label: '概览', path: (id: string) => `/kb/${id}` },
  { key: 'documents', label: '文档', path: (id: string) => `/kb/${id}/documents` },
  { key: 'chat', label: '对话', path: (id: string) => `/kb/${id}/chat` },
] as const;

export function KbSectionNav({
  kbId,
  active,
}: {
  kbId: string;
  active: (typeof ITEMS)[number]['key'];
}) {
  const navigate = useAppNavigate();
  return (
    <nav className="flex gap-1 border-b border-[var(--color-border)] px-4 pt-3" aria-label="知识库分区">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path(kbId))}
            className={
              isActive
                ? 'border-b-2 border-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]'
                : 'border-b-2 border-transparent px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 重写概览内容区**

在 `KnowledgeBaseOverview` 加载 KB 后并行：

```ts
const [conversations, setConversations] = useState<Conversation[]>([]);
const [docs, setDocs] = useState<Document[]>([]);
// ...
const [convRows, docRows] = await Promise.all([
  tauriCommand<Conversation[]>('list_conversations', { kbId: id }),
  tauriCommand<Document[]>('list_documents', { kbId: id }),
]);
```

排序：conversations 按 `updated_at` 降序取前 5。  
`const health = summarizeDocumentHealth(docs)`。  
`chunk` 统计：沿用现有 KB 字段或从 docs 聚合（若 overview 已有 chunk 展示则保留）。

布局：

1. `KbSectionNav active="overview"`
2. 标题 + 描述
3. 三 StatCard：文档 / 分块 / 就绪状态文案（`health.error ? '有失败' : health.processing ? '处理中' : '就绪'`）
4. 两列：最近对话（点进 `/kb/:id/chat/:conversationId`）| 文档动态（ready/processing/error 数字）
5. 主按钮「开始提问」→ `navigate(\`/kb/${id}/chat\`)`
6. 次按钮「管理文档」→ documents；保留删除等危险操作在次要位置

分区加载失败：该列显示「加载失败」+ 重试按钮，不整页白屏。

- [ ] **Step 3: DocumentList / ChatLayout 挂上同一导航**

ChatLayout：用 `KbSectionNav active="chat"` 替换或简化现有面包屑；保留会话列表。

- [ ] **Step 4: 目视**

Expected: 侧栏点 KB → 厚概览；「开始提问」进对话；顶栏三段可切换。

- [ ] **Step 5: Commit**

```bash
git add src/components/knowledge-base/KbSectionNav.tsx src/components/knowledge-base/KnowledgeBaseOverview.tsx src/components/document/DocumentList.tsx src/components/chat/KnowledgeBaseChatLayout.tsx
git commit -m "$(cat <<'EOF'
feat(ui): thick KB overview with section nav and recent activity

EOF
)"
```

---

### Task 8: 对话居中阅读栏 + 排查抽屉

**Files:**
- Modify: `src/components/chat/RetrievalWorkbench.tsx`
- Modify: `src/components/chat/KnowledgeBaseChatLayout.tsx`
- Modify: `src/components/chat/ChatHeader.tsx`
- Modify: `src/components/chat/ConversationList.tsx`（细栏宽度/视觉，约 200–220px）
- Modify: 消息列表容器（`ChatInterface` / `MessageList` 外层）使内容 `max-w-[720px] mx-auto`

**Interfaces:**
- Consumes: 现有 `KbChatWorkbenchProvider` value 形状不变
- Produces: `RetrievalWorkbench` 增加内部或外部 `open` 状态；默认 `false`；打开时右侧抽屉显示 ModeSelector + 搜索 + `SearchResultsPanel`；关闭时仅渲染 `children` 全宽

- [ ] **Step 1: 重构 RetrievalWorkbench 壳**

目标 JSX 结构：

```tsx
<KbChatWorkbenchProvider value={workbench}>
  <div className="relative flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-2">
      <button
        type="button"
        onClick={() => setDrawerOpen((v) => !v)}
        className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
      >
        {drawerOpen ? '关闭排查' : '排查检索'}
      </button>
    </div>
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {drawerOpen ? (
        <aside className="flex w-[min(360px,38%)] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
          {/* ModeSelector + input + 排查按钮 + SearchResultsPanel */}
        </aside>
      ) : null}
    </div>
  </div>
</KbChatWorkbenchProvider>
```

删除默认常驻的 `Group`/`Panel` 分栏（或仅在 `drawerOpen` 时使用）。  
`useState(false)` 作为默认。  
保留 `retrieve` / settings 加载逻辑不动。

- [ ] **Step 2: ChatHeader 文案**

去掉「上方检索栏…」；改为：

```tsx
<p className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">
  在下方提问；需要核对命中时点「排查检索」。
</p>
```

- [ ] **Step 3: 居中阅读栏**

在承载消息 + 输入框的列上：

```tsx
className="mx-auto flex h-full w-full max-w-[720px] flex-col px-4"
```

会话列表保持左侧细栏（可设 `w-[200px] min-w-[200px]`）。

- [ ] **Step 4: 目视验收**

Expected:
- 进入对话无右侧命中栏、无顶栏常驻检索
- 点「排查检索」出现右侧抽屉并可搜
- 消息居中，阅读宽度约 720px

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/RetrievalWorkbench.tsx src/components/chat/KnowledgeBaseChatLayout.tsx src/components/chat/ChatHeader.tsx src/components/chat/ConversationList.tsx src/components/chat/ChatInterface.tsx src/components/chat/MessageList.tsx
git commit -m "$(cat <<'EOF'
feat(ui): center chat column and move retrieval to drawer

EOF
)"
```

---

### Task 9: 文档页与设置控件令牌对齐

**Files:**
- Modify: `src/components/document/DocumentList.tsx`
- Modify: `src/components/document/DocumentCard.tsx`
- Modify: `src/components/settings/AppearanceSection.tsx`（若仍有 `rounded-md` / 紫预设靠前，调顺序）

**Interfaces:**
- Consumes: `KbSectionNav`；状态色 token
- Produces: 文档页与全局圆角/字号一致

- [ ] **Step 1:** DocumentList 顶部挂 `KbSectionNav active="documents"`；导入区保持显眼。
- [ ] **Step 2:** DocumentCard 状态徽章用 `--text-meta` 与现有 badge token；去掉 `text-[10px]`。
- [ ] **Step 3:** 外观预设前三个：青绿 / 石板 / 琥珀（若已是则跳过）。
- [ ] **Step 4:** `npm run build` PASS
- [ ] **Step 5: Commit**

```bash
git add src/components/document/DocumentList.tsx src/components/document/DocumentCard.tsx src/components/settings/AppearanceSection.tsx
git commit -m "$(cat <<'EOF'
style(ui): align documents and settings with ink-study tokens

EOF
)"
```

---

### Task 10: 动效与空状态收尾

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/common/EmptyState.tsx`（若需）
- Modify: `src/components/knowledge-base/KnowledgeBaseList.tsx`
- Modify: `src/components/chat/MessageList.tsx`

**Interfaces:**
- Produces: 消息 fade / 主区切换 fade；空状态含 BrandMark 或明确 CTA

- [ ] **Step 1:** `global.css` 确认：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

消息列表已有 fade 则保留一条；卡片 hover 位移在 reduce 下为 0。

- [ ] **Step 2:** 无 KB / 无对话空状态检查 CTA 文案与 spec §5 一致；可嵌入小号 `BrandMark`。
- [ ] **Step 3: 目视** — 切换 KB 与发消息有短动效；系统「减少动态效果」时不明显动画。
- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/components/common/EmptyState.tsx src/components/knowledge-base/KnowledgeBaseList.tsx src/components/chat/MessageList.tsx
git commit -m "$(cat <<'EOF'
style(ui): motion and empty-state polish for ink-study

EOF
)"
```

---

### Task 11: 截图与 README

**Files:**
- Create: `docs/screenshots/01-overview.png`
- Create: `docs/screenshots/02-chat-citation.png`
- Create: `docs/screenshots/03-settings-health.png`
- Modify: `README.md`（界面预览表已存在则嵌入真实图）
- Modify: `docs/screenshots/README.md`（若需更新说明）

**Interfaces:**
- Consumes: 跑起来的 app + 演示语料
- Produces: 三张 PNG；README 可渲染

- [ ] **Step 1:** 按 `docs/ops/demo-checklist.md` 准备演示库（可「导入演示语料」）。
- [ ] **Step 2:** 截取三张图（厚概览、对话+引用 pill、设置或健康条）。
- [ ] **Step 3:** 确认 README 图片路径可打开。
- [ ] **Step 4: Commit**

```bash
git add docs/screenshots/01-overview.png docs/screenshots/02-chat-citation.png docs/screenshots/03-settings-health.png README.md docs/screenshots/README.md
git commit -m "$(cat <<'EOF'
docs: add ink-study UI screenshots for README

EOF
)"
```

---

### Task 12: 全量验收

**Files:** 无新代码（修复则随 bugfix commit）

- [ ] **Step 1:** `npx vitest run` — Expected: 全部 PASS（含 document-health）
- [ ] **Step 2:** `npm run build` — Expected: PASS
- [ ] **Step 3:** 对照 spec §9 验收清单逐项勾选（Titlebar、深侧栏、厚概览、居中对话、抽屉默认关、色条卡、截图）
- [ ] **Step 4:** 若有漏项，开最小修复 commit，勿扩大到溯源

---

## Spec coverage self-check

| Spec 要求 | Task |
|-----------|------|
| 纸感色 / 深侧栏 / 圆角 8/12 | 1, 3 |
| Brand mark + Titlebar + favicon | 2 |
| 健康条可关 | 4 |
| KB 色条卡 | 5 |
| 厚概览 + 最近对话 + 文档动态 + CTA | 6, 7 |
| 概览\|文档\|对话导航 | 7 |
| 居中对话 + 排查抽屉默认关 | 8 |
| 文档/设置令牌 | 9 |
| 动效与空状态 | 10 |
| 截图证明 | 11 |
| 行级溯源 | 明确不在本计划（spec §10） |

## Placeholder scan

无 TBD /「类似 Task N」占位；关键实现均给出具体代码或结构。

## Type consistency

- `summarizeDocumentHealth` → Overview 使用同名
- `KbSectionNav` `active` 联合类型三处一致
- `KbChatWorkbenchProvider` value 字段不改名，避免 ChatInterface 断裂
