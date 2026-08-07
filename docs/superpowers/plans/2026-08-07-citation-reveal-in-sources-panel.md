# Citation Reveal in Sources Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击对话内联引用或底部来源卡片时，不再弹出中间浮层，而是自动展开右侧文档面板并定位、高亮对应分块。

**Architecture:** 扩展 `SourcesPanelContext` / `useSourcesPanel`，新增 `revealChunk({ documentId, chunkId })` 与带 `nonce` 的 `focusChunk`。`SourcesPanel` 订阅后选中文档；`DocumentPreviewPane` 按分块渲染并滚动高亮。`MessageBubble` / `MessageSourcesBar` 改为调用 `revealChunk`；删除 `CitationPopup`。

**Tech Stack:** React 19、现有 `SourcesPanelContext`、`tauriCommand`、`useToastStore`、Vitest、现有 `--color-citation-*` 与 `.chunk-highlight-mark` 动画。

**Spec:** `docs/superpowers/specs/2026-08-07-citation-reveal-in-sources-panel-design.md`

## Global Constraints

- 点击引用：**不**显示 `CitationPopover`；**不** `navigate('/documents/...')`
- 右侧面板关闭时：`revealChunk` 必须先 `setOpen(true)` 再定位
- 内联引用与底部来源卡片行为统一
- 同一 chunk 重复点击靠 `nonce` 再次触发滚动/高亮
- 不改文档详情页 `ChunkPreview` / `ChunkSourcePanel`；不改 `SearchResultsPanel`
- 预览可保留 `MAX_CHUNKS=40` / `MAX_CHARS=24000`；截断外目标仅 toast，不加跳转入口
- Toast 文案固定：`找不到该文档` / `未找到对应片段` / `片段在截断范围外，可打开全文`
- 每个 Task 可独立验收并单独 commit
- 无 `@testing-library/react`：hook 行为用纯函数单测覆盖

## File map

| 文件 | 职责 |
|------|------|
| `src/hooks/useSourcesPanel.ts` | `open` + `focusChunk` + `revealChunk` |
| `src/hooks/useSourcesPanel.test.ts` | storage + focus/reveal 纯逻辑测试 |
| `src/context/SourcesPanelContext.tsx` | 透传 hook 返回值（类型自动跟随） |
| `src/components/sources/DocumentPreviewPane.tsx` | 分块渲染、focus 滚动高亮、截断 toast |
| `src/components/sources/SourcesPanel.tsx` | 订阅 `focusChunk`、选中文档、传 focus props |
| `src/components/chat/MessageBubble.tsx` | 内联引用 → `revealChunk`；移除浮层 |
| `src/components/chat/MessageSourcesBar.tsx` | 来源卡片 → `revealChunk`；移除 navigate |
| `src/components/chat/CitationPopup.tsx` | 删除 |

---

### Task 1: `useSourcesPanel` 增加 `focusChunk` / `revealChunk`

**Files:**
- Modify: `src/hooks/useSourcesPanel.ts`
- Modify: `src/hooks/useSourcesPanel.test.ts`
- Note: `src/context/SourcesPanelContext.tsx` 用 `ReturnType<typeof useSourcesPanel>`，无需改文件

**Interfaces:**
- Produces:

```ts
export type SourcesFocusChunk = {
  documentId: string;
  chunkId: string;
  nonce: number;
};

export function nextFocusChunk(
  prev: SourcesFocusChunk | null,
  target: { documentId: string; chunkId: string },
): SourcesFocusChunk;

export function useSourcesPanel(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  focusChunk: SourcesFocusChunk | null;
  revealChunk: (target: { documentId: string; chunkId: string }) => void;
};
```

- Consumes: 现有 `readStoredOpen` / `writeStoredOpen` / `SOURCES_PANEL_STORAGE_KEY`

- [ ] **Step 1: 写失败测试（focus 纯函数）**

在 `src/hooks/useSourcesPanel.test.ts` 现有 `describe('sources panel storage')` **之后**追加：

```ts
import { nextFocusChunk } from './useSourcesPanel';

describe('nextFocusChunk', () => {
  it('creates focus with nonce 1 from null', () => {
    expect(nextFocusChunk(null, { documentId: 'd1', chunkId: 'c1' })).toEqual({
      documentId: 'd1',
      chunkId: 'c1',
      nonce: 1,
    });
  });

  it('increments nonce when revealing same or different chunk', () => {
    const a = nextFocusChunk(null, { documentId: 'd1', chunkId: 'c1' });
    const b = nextFocusChunk(a, { documentId: 'd1', chunkId: 'c1' });
    const c = nextFocusChunk(b, { documentId: 'd2', chunkId: 'c9' });
    expect(b.nonce).toBe(2);
    expect(c).toEqual({ documentId: 'd2', chunkId: 'c9', nonce: 3 });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/hooks/useSourcesPanel.test.ts`

Expected: FAIL（`nextFocusChunk` is not exported / not a function）

- [ ] **Step 3: 实现纯函数 + hook**

将 `src/hooks/useSourcesPanel.ts` 替换为：

```ts
import { useCallback, useState } from 'react';

export const SOURCES_PANEL_STORAGE_KEY = 'ui.sourcesPanelOpen';

export type SourcesFocusChunk = {
  documentId: string;
  chunkId: string;
  nonce: number;
};

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

export function nextFocusChunk(
  prev: SourcesFocusChunk | null,
  target: { documentId: string; chunkId: string },
): SourcesFocusChunk {
  return {
    documentId: target.documentId,
    chunkId: target.chunkId,
    nonce: (prev?.nonce ?? 0) + 1,
  };
}

export function useSourcesPanel(): {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  focusChunk: SourcesFocusChunk | null;
  revealChunk: (target: { documentId: string; chunkId: string }) => void;
} {
  const [open, setOpenState] = useState(readStoredOpen);
  const [focusChunk, setFocusChunk] = useState<SourcesFocusChunk | null>(null);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    writeStoredOpen(next);
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const revealChunk = useCallback(
    (target: { documentId: string; chunkId: string }) => {
      setOpen(true);
      setFocusChunk((prev) => nextFocusChunk(prev, target));
    },
    [setOpen],
  );

  return { open, setOpen, toggle, focusChunk, revealChunk };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/hooks/useSourcesPanel.test.ts`

Expected: PASS（storage + `nextFocusChunk` 全部通过）

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSourcesPanel.ts src/hooks/useSourcesPanel.test.ts
git commit -m "feat(sources): add revealChunk focus state to sources panel hook"
```

---

### Task 2: `DocumentPreviewPane` 分块渲染 + focus 滚动高亮

**Files:**
- Modify: `src/components/sources/DocumentPreviewPane.tsx`
- Create: `src/components/sources/document-preview-focus.ts`（纯辅助，便于测截断判断）
- Create: `src/components/sources/document-preview-focus.test.ts`

**Interfaces:**
- Consumes: 无（本任务不接 context）
- Produces:

```ts
// document-preview-focus.ts
export const PREVIEW_MAX_CHUNKS = 40;
export const PREVIEW_MAX_CHARS = 24_000;

export function buildPreviewChunks(
  chunks: { id: string; content: string }[],
  maxChunks?: number,
  maxChars?: number,
): { visible: { id: string; content: string }[]; truncated: boolean };

export function isFocusInPreview(
  visibleIds: string[],
  focusChunkId: string | null | undefined,
): boolean;

// DocumentPreviewPane props
export function DocumentPreviewPane(props: {
  documentId: string | null;
  focusChunkId?: string | null;
  focusNonce?: number;
}): JSX.Element;
```

- [ ] **Step 1: 写失败测试**

创建 `src/components/sources/document-preview-focus.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  PREVIEW_MAX_CHUNKS,
  buildPreviewChunks,
  isFocusInPreview,
} from './document-preview-focus';

describe('buildPreviewChunks', () => {
  it('keeps order and marks truncated when over max chunks', () => {
    const chunks = Array.from({ length: PREVIEW_MAX_CHUNKS + 2 }, (_, i) => ({
      id: `c${i}`,
      content: `text-${i}`,
    }));
    const { visible, truncated } = buildPreviewChunks(chunks);
    expect(visible).toHaveLength(PREVIEW_MAX_CHUNKS);
    expect(visible[0]?.id).toBe('c0');
    expect(truncated).toBe(true);
  });

  it('marks truncated when char budget exceeded', () => {
    const { visible, truncated } = buildPreviewChunks(
      [
        { id: 'a', content: 'aaaa' },
        { id: 'b', content: 'bbbb' },
      ],
      40,
      5,
    );
    expect(visible.map((c) => c.id)).toEqual(['a']);
    expect(truncated).toBe(true);
  });
});

describe('isFocusInPreview', () => {
  it('returns true when focus id is visible', () => {
    expect(isFocusInPreview(['a', 'b'], 'b')).toBe(true);
  });

  it('returns false when missing or empty focus', () => {
    expect(isFocusInPreview(['a'], 'z')).toBe(false);
    expect(isFocusInPreview(['a'], null)).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/sources/document-preview-focus.test.ts`

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现纯辅助**

创建 `src/components/sources/document-preview-focus.ts`：

```ts
export const PREVIEW_MAX_CHUNKS = 40;
export const PREVIEW_MAX_CHARS = 24_000;

export function buildPreviewChunks(
  chunks: { id: string; content: string }[],
  maxChunks: number = PREVIEW_MAX_CHUNKS,
  maxChars: number = PREVIEW_MAX_CHARS,
): { visible: { id: string; content: string }[]; truncated: boolean } {
  const slice = chunks.slice(0, maxChunks);
  const visible: { id: string; content: string }[] = [];
  let used = 0;
  let truncated = chunks.length > maxChunks;

  for (const chunk of slice) {
    const nextLen = used === 0 ? chunk.content.length : used + 2 + chunk.content.length;
    if (visible.length > 0 && nextLen > maxChars) {
      truncated = true;
      break;
    }
    visible.push(chunk);
    used = nextLen;
  }

  return { visible, truncated };
}

export function isFocusInPreview(
  visibleIds: string[],
  focusChunkId: string | null | undefined,
): boolean {
  if (!focusChunkId) return false;
  return visibleIds.includes(focusChunkId);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/sources/document-preview-focus.test.ts`

Expected: PASS

- [ ] **Step 5: 改写 `DocumentPreviewPane`**

将 `src/components/sources/DocumentPreviewPane.tsx` 改为按分块渲染并响应 focus（保留 PDF 不足 / 打开文档页链接）：

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import { useToastStore } from '../../store/toast';
import type { Document } from '../../types/document';
import type { Chunk, ChunkRow } from '../../types/chunk';
import { chunkFromRow } from '../../types/chunk';
import {
  buildPreviewChunks,
  isFocusInPreview,
} from './document-preview-focus';

function isPdfHeavy(doc: Document, previewText: string): boolean {
  if (doc.file_type !== 'pdf') return false;
  return previewText.trim().length < 80;
}

export function DocumentPreviewPane({
  documentId,
  focusChunkId = null,
  focusNonce = 0,
}: {
  documentId: string | null;
  focusChunkId?: string | null;
  focusNonce?: number;
}) {
  const navigate = useAppNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [doc, setDoc] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastHandledNonce = useRef<number | null>(null);

  useEffect(() => {
    // 换文档后允许同一 nonce 再次定位（先选文档再加载分块的时序）
    lastHandledNonce.current = null;
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setChunks([]);
      setTruncated(false);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setDoc(null);
      setChunks([]);
      setTruncated(false);
      try {
        const d = await tauriCommand<Document>('get_document', { id: documentId });
        if (cancelled) return;
        setDoc(d);
        const rows = await tauriCommand<ChunkRow[]>('list_document_chunks', {
          documentId,
        });
        if (cancelled) return;
        const all = rows.map(chunkFromRow);
        const { visible, truncated: wasTruncated } = buildPreviewChunks(all);
        setChunks(visible);
        setTruncated(wasTruncated);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useLayoutEffect(() => {
    if (!focusChunkId || loading) return;
    if (lastHandledNonce.current === focusNonce) return;
    lastHandledNonce.current = focusNonce;

    const visibleIds = chunks.map((c) => c.id);
    if (!isFocusInPreview(visibleIds, focusChunkId)) {
      if (chunks.length > 0 || truncated) {
        addToast({
          type: 'warning',
          title: '片段在截断范围外，可打开全文',
          duration: 3500,
        });
      }
      return;
    }

    const container = scrollRef.current;
    const target = container?.querySelector(
      `[data-chunk-id="${CSS.escape(focusChunkId)}"]`,
    ) as HTMLElement | null;
    if (!container || !target) return;

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove('chunk-highlight-mark');
    // force reflow so repeat clicks replay animation
    void target.offsetWidth;
    target.classList.add('chunk-highlight-mark');
  }, [focusChunkId, focusNonce, chunks, truncated, loading, addToast]);

  if (!documentId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-center text-xs text-[var(--color-text-secondary)]">
        选择文档以预览
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 text-xs text-[var(--color-text-secondary)]">
        加载预览…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2 text-xs text-[var(--color-danger-text)]">
        {error}
      </div>
    );
  }

  if (!doc) return null;

  const previewText = chunks.map((c) => c.content).join('\n\n');
  const pdfFallback = isPdfHeavy(doc, previewText);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2">
        <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">
          {doc.file_name}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
          {doc.status === 'ready'
            ? '就绪'
            : doc.status === 'processing'
              ? '处理中'
              : doc.status === 'pending'
                ? '等待中'
                : doc.status === 'error'
                  ? '错误'
                  : doc.status}
        </p>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-3 py-2">
        {pdfFallback ? (
          <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
            <p>PDF 预览文本不足，请打开完整文档页查看。</p>
            <button
              type="button"
              onClick={() => navigate(`/documents/${doc.id}`)}
              className="text-[var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              打开文档页
            </button>
          </div>
        ) : chunks.length > 0 ? (
          <>
            <div className="space-y-3">
              {chunks.map((chunk) => {
                const focused = chunk.id === focusChunkId;
                return (
                  <section
                    key={chunk.id}
                    data-chunk-id={chunk.id}
                    className={`rounded-[length:var(--radius-control)] px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap font-sans text-[var(--color-text-primary)] ${
                      focused
                        ? 'bg-[var(--color-citation-bg)] ring-1 ring-[var(--color-citation-border)]'
                        : ''
                    }`}
                  >
                    {chunk.content}
                  </section>
                );
              })}
            </div>
            {truncated ? (
              <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
                已截断。
                <button
                  type="button"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  className="ml-1 text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  查看全文
                </button>
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
            <p>暂无可用分块文本。</p>
            <button
              type="button"
              onClick={() => navigate(`/documents/${doc.id}`)}
              className="text-[var(--color-accent)] underline-offset-2 hover:underline"
            >
              打开文档页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

注意：`CSS.escape` 在现代 Chromium / WebView2 可用；若类型报错，加一行 `// focusChunkId 来自内部 id，不含特殊选择器字符` 并用模板字符串直接拼接（id 为 UUID 时安全）。

- [ ] **Step 6: `npx tsc --noEmit` 或 `npm run build` 类型检查通过**

- [ ] **Step 7: Commit**

```bash
git add src/components/sources/document-preview-focus.ts src/components/sources/document-preview-focus.test.ts src/components/sources/DocumentPreviewPane.tsx
git commit -m "feat(sources): render preview chunks with focus highlight"
```

---

### Task 3: `SourcesPanel` 订阅 `focusChunk` 并选中文档

**Files:**
- Modify: `src/components/sources/SourcesPanel.tsx`

**Interfaces:**
- Consumes: `useSourcesPanelContext().focusChunk`
- Produces: 将 `focusChunkId` / `focusNonce` 传给 `DocumentPreviewPane`；文档不在列表时 toast「找不到该文档」

- [ ] **Step 1: 在 `SourcesPanel` 接入 focus**

把 `SourcesPanel` 关键改为：

1. `const { focusChunk } = useSourcesPanelContext();`
2. `const addToast = useToastStore((s) => s.addToast);`
3. 增加 effect：当 `focusChunk` 变化时：
   - 若 `documents` 仍在 loading，先等（依赖 `documents` / `loading`）
   - 若列表中存在 `focusChunk.documentId` → `setSelectedDocId(focusChunk.documentId)`
   - 否则 toast `{ type: 'warning', title: '找不到该文档', duration: 3000 }`
4. 渲染时**仅当选中文档已是 focus 目标**再传 chunk focus，避免旧文档误报「截断范围外」：

```tsx
<DocumentPreviewPane
  documentId={selectedDocId}
  focusChunkId={
    focusChunk && selectedDocId === focusChunk.documentId
      ? focusChunk.chunkId
      : null
  }
  focusNonce={focusChunk?.nonce ?? 0}
/>
```

完整关键片段（插入现有 list effect 之后）：

```tsx
import { useSourcesPanelContext } from '../../context/SourcesPanelContext';
import { useToastStore } from '../../store/toast';

// inside SourcesPanel:
const { focusChunk } = useSourcesPanelContext();
const addToast = useToastStore((s) => s.addToast);
const lastFocusNonce = useRef<number | null>(null);

useEffect(() => {
  if (!focusChunk) return;
  if (loading) return;
  if (lastFocusNonce.current === focusChunk.nonce) return;
  lastFocusNonce.current = focusChunk.nonce;

  const exists = documents.some((d) => d.id === focusChunk.documentId);
  if (!exists) {
    addToast({ type: 'warning', title: '找不到该文档', duration: 3000 });
    return;
  }
  setSelectedDocId(focusChunk.documentId);
}, [focusChunk, documents, loading, addToast]);
```

并补上 `useRef` import。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`

Expected: PASS（或仅有与本改动无关的既有问题——本任务不得引入新错误）

- [ ] **Step 3: Commit**

```bash
git add src/components/sources/SourcesPanel.tsx
git commit -m "feat(sources): select document from revealChunk focus"
```

---

### Task 4: 内联引用与来源卡片改为 `revealChunk`，删除浮层

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`
- Modify: `src/components/chat/MessageSourcesBar.tsx`
- Delete: `src/components/chat/CitationPopup.tsx`

**Interfaces:**
- Consumes: `revealChunk` from `useSourcesPanelContext()`；`tauriCommand('get_chunk')`；`useToastStore`
- Produces: 点击路径统一为右侧定位；无 `CitationPopover`；无对话页内 `/documents/...` 跳转

- [ ] **Step 1: 改 `MessageSourcesBar`**

1. 删除 `useAppNavigate` import 与 `navigate` 使用
2. 将 `const { setOpen: setSourcesPanelOpen } = useSourcesPanelContext();` 改为：

```ts
const { revealChunk } = useSourcesPanelContext();
```

3. 将 `SourceResultCard` 的 `onClick` 改为：

```tsx
onClick={
  chunk
    ? () => {
        revealChunk({
          documentId: chunk.document_id,
          chunkId: chunk.id,
        });
      }
    : undefined
}
```

- [ ] **Step 2: 改 `MessageBubble`**

1. 删除 `import { CitationPopover } from './CitationPopup';`
2. 增加：

```ts
import { useSourcesPanelContext } from '../../context/SourcesPanelContext';
import { tauriCommand } from '../../hooks/useDatabase';
import { useToastStore } from '../../store/toast';
import type { ChunkRow } from '../../types/chunk';
import { chunkFromRow } from '../../types/chunk';
```

3. 在组件内：

```ts
const { revealChunk } = useSourcesPanelContext();
const addToast = useToastStore((s) => s.addToast);
```

4. 将引用 pill 从 `CitationPopover` 包裹改为带 `onClick` 的 button：

```tsx
const chunkId = ids[part.refIndex - 1];
const btn = (
  <button
    type="button"
    disabled={!chunkId}
    onClick={async () => {
      if (!chunkId) return;
      try {
        const row = await tauriCommand<ChunkRow>('get_chunk', { id: chunkId });
        const chunk = chunkFromRow(row);
        revealChunk({
          documentId: chunk.document_id,
          chunkId: chunk.id,
        });
      } catch (e) {
        addToast({
          type: 'warning',
          title: '未找到对应片段',
          message: e instanceof Error ? e.message : String(e),
          duration: 3500,
        });
      }
    }}
    className="mx-0.5 inline-flex items-center gap-0.5 rounded-full border border-[var(--color-citation-border)] bg-[var(--color-citation-bg)] px-2 py-0.5 align-baseline text-[length:var(--text-meta)] font-medium text-[var(--color-citation-fg)] hover:bg-[var(--color-citation-hover-bg)] disabled:opacity-40"
  >
    <span aria-hidden>📄</span>
    {part.fileLabel} · {part.refIndex}
  </button>
);

return <span key={i}>{btn}</span>;
```

去掉「缺少引用映射」时外套 `title` 的特殊分支可保留为 `disabled={!chunkId}` 即可。

- [ ] **Step 3: 删除 `CitationPopup.tsx`**

```bash
# PowerShell
Remove-Item src/components/chat/CitationPopup.tsx
```

确认全仓无 `CitationPopover` / `CitationPopup` 引用：

```bash
rg "CitationPopover|CitationPopup" src
```

Expected: 无匹配

- [ ] **Step 4: 跑相关测试 + 类型检查**

Run:

```bash
npx vitest run src/hooks/useSourcesPanel.test.ts src/components/sources/document-preview-focus.test.ts
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/MessageBubble.tsx src/components/chat/MessageSourcesBar.tsx
git add -u src/components/chat/CitationPopup.tsx
git commit -m "feat(chat): reveal citations in sources panel instead of popover"
```

---

### Task 5: 手动验收（对照 spec 成功标准）

**Files:** 无代码改动（验收清单）

**Interfaces:**
- Consumes: Task 1–4 全部合并后的运行时行为

- [ ] **Step 1: 启动应用**

Run: `npm run tauri dev`（或项目惯用启动方式）

- [ ] **Step 2: 按清单验收**

| # | 操作 | 期望 |
|---|------|------|
| 1 | 点内联引用 pill | 无中间浮层；右栏打开；对应分块高亮 |
| 2 | 点底部「参考来源」卡片 | 同上；URL 仍在 `/kb/.../chat`，不进文档详情 |
| 3 | 先关闭右栏再点引用 | 自动展开并定位 |
| 4 | 连续两次点同一引用 | 第二次仍滚动并重放高亮动画 |
| 5 | 打开文档详情带 `?chunk=` | 原 `ChunkPreview` 定位行为不变 |
| 6 |（可选）目标在截断外 | toast「片段在截断范围外，可打开全文」 |
| 7 |（可选）`get_chunk` 失败 | toast「未找到对应片段」 |

- [ ] **Step 3: 若有小修，就地修复并追加 commit**；无问题则本 Task 无需 commit

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 去掉 CitationPopover | Task 4 |
| 自动展开右栏 | Task 1 `revealChunk` → `setOpen(true)` |
| 选中文档 + 滚动高亮 | Task 2 + Task 3 |
| 内联与来源卡片统一 | Task 4 |
| `nonce` 重复点击 | Task 1 + Task 2 |
| 找不到文档 / 找不到片段 / 截断外 toast | Task 2 + Task 3 + Task 4 |
| 不改文档详情 / SearchResultsPanel | 全局约束，无对应改动任务 |
| hook 单测 | Task 1 |
| 手动验收 | Task 5 |
