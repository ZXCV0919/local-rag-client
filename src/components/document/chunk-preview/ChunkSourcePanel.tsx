import { useLayoutEffect, useMemo, useRef, type ReactNode, type Ref } from 'react';
import type { Chunk, DocContent } from '../../../types/chunk';
import {
  buildFullDocumentText,
  chunkHeadingLabel,
  findHighlightInFullText,
} from '../../../utils/chunk-display';

const HIGHLIGHT_SCROLL_PADDING = 24;

function getOffsetTopWithin(container: HTMLElement, target: HTMLElement): number {
  let top = 0;
  let el: HTMLElement | null = target;
  while (el && el !== container) {
    top += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  if (el === container) return top;

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return targetRect.top - containerRect.top + container.scrollTop;
}

function scrollContainerToHighlight(container: HTMLElement, target: HTMLElement): boolean {
  if (container.scrollHeight <= container.clientHeight + 1) return false;

  const top = getOffsetTopWithin(container, target);
  container.scrollTo({ top: Math.max(0, top - HIGHLIGHT_SCROLL_PADDING), behavior: 'auto' });
  return true;
}

function isHighlightVisible(container: HTMLElement, target: HTMLElement): boolean {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const visibleTop = containerRect.top + HIGHLIGHT_SCROLL_PADDING;
  const visibleBottom = containerRect.bottom - HIGHLIGHT_SCROLL_PADDING;
  return targetRect.top >= visibleTop && targetRect.bottom <= visibleBottom;
}

function renderHighlighted(
  text: string,
  range: { start: number; end: number },
  markRef: Ref<HTMLElement>,
  pulseKey: string,
): ReactNode {
  return (
    <>
      {text.slice(0, range.start)}
      <mark
        key={pulseKey}
        ref={markRef}
        className="chunk-highlight-mark rounded bg-[var(--color-citation-bg)] px-0.5 text-[var(--color-text-primary)] ring-1 ring-[var(--color-citation-border)]"
      >
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}

interface ChunkSourcePanelProps {
  source: DocContent | null;
  sourceLoading: boolean;
  activeChunk: Chunk | null;
}

export function ChunkSourcePanel({
  source,
  sourceLoading,
  activeChunk,
}: ChunkSourcePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLElement | null>(null);

  const fullText = useMemo(() => {
    if (!source) return '';
    return buildFullDocumentText(source.sections);
  }, [source]);

  const highlightRange = useMemo(() => {
    if (!fullText || !activeChunk) return null;
    return findHighlightInFullText(fullText, activeChunk);
  }, [fullText, activeChunk]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeChunk) return;

    if (!highlightRange) {
      container.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    let cancelled = false;

    const runScroll = () => {
      if (cancelled) return;
      const target = highlightRef.current;
      if (!target) return;
      if (isHighlightVisible(container, target)) return;
      scrollContainerToHighlight(container, target);
    };

    runScroll();
    const raf = requestAnimationFrame(runScroll);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [activeChunk?.id, highlightRange?.start, highlightRange?.end]);

  if (sourceLoading) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
        <div className="h-24 animate-pulse rounded-lg bg-[var(--color-bg-secondary)]" />
        <div className="h-24 animate-pulse rounded-lg bg-[var(--color-bg-secondary)]" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--color-text-secondary)]">
        无法加载原文，请确认文件仍存在且格式受支持。
      </div>
    );
  }

  if (!activeChunk) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--color-text-secondary)]">
        从左侧目录选择一个分块，查看原文对照。
      </div>
    );
  }

  const headingLabel = chunkHeadingLabel(activeChunk);
  const chunkSubtitle =
    headingLabel !== '未命名片段'
      ? `分块 ${activeChunk.chunk_index + 1} · ${headingLabel}`
      : `分块 ${activeChunk.chunk_index + 1}`;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          全文对照
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {chunkSubtitle}
        </p>
        {highlightRange ? (
          <p className="mt-1 text-[10px] text-[var(--color-accent)]">已定位当前分块在原文中的位置</p>
        ) : (
          <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
            未能精确匹配原文位置，已显示全文
          </p>
        )}
      </div>
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4"
      >
        <article className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)]">
          <div className="whitespace-pre-wrap break-words">
            {highlightRange ? (
              renderHighlighted(fullText, highlightRange, highlightRef, activeChunk.id)
            ) : (
              fullText
            )}
          </div>
        </article>
        {!highlightRange && activeChunk.content.trim() ? (
          <aside className="mt-4 rounded-[length:var(--radius-control)] border border-[var(--color-citation-border)] bg-[var(--color-citation-bg)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              当前分块内容
            </p>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--color-text-primary)]">
              {activeChunk.content}
            </p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
