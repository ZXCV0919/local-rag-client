import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import type { Chunk, DocContent, DocSection } from '../../../types/chunk';
import {
  buildFullDocumentText,
  chunkHeadingLabel,
  findHighlightInFullText,
  sliceContextWindow,
  SOURCE_PREVIEW_CONTEXT_CHARS,
  type TextRange,
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

function sectionBlockText(section: DocSection): string {
  const heading = (section.heading_path || section.heading || '').trim();
  const content = section.content ?? '';
  if (!heading) return content;
  if (content.trimStart().startsWith(heading)) return content;
  return `${heading}\n\n${content}`;
}

function renderHighlighted(
  text: string,
  range: TextRange,
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

function renderExpandedSections(
  sections: DocSection[],
  highlightRange: TextRange | null,
  markRef: Ref<HTMLElement>,
  pulseKey: string,
): ReactNode {
  const blocks = sections.map(sectionBlockText).filter((block) => block.length > 0);

  let offset = 0;
  return blocks.map((block, idx) => {
    if (idx > 0) offset += 2; // `\n\n` join separators in fullText
    const blockStart = offset;
    const blockEnd = offset + block.length;
    offset = blockEnd;

    let body: ReactNode = block;
    if (
      highlightRange &&
      highlightRange.start >= blockStart &&
      highlightRange.start < blockEnd
    ) {
      const localStart = highlightRange.start - blockStart;
      const localEnd = Math.min(highlightRange.end, blockEnd) - blockStart;
      body = renderHighlighted(block, { start: localStart, end: localEnd }, markRef, pulseKey);
    }

    return (
      <div key={idx} className="whitespace-pre-wrap break-words">
        {idx > 0 ? '\n\n' : null}
        {body}
      </div>
    );
  });
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
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [source]);

  const fullText = useMemo(
    () => (source ? buildFullDocumentText(source.sections) : ''),
    [source],
  );

  const highlightRange = useMemo(
    () => (fullText && activeChunk ? findHighlightInFullText(fullText, activeChunk) : null),
    [fullText, activeChunk],
  );

  const windowed = useMemo(
    () => sliceContextWindow(fullText, highlightRange, SOURCE_PREVIEW_CONTEXT_CHARS),
    [fullText, highlightRange],
  );

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
  }, [activeChunk?.id, highlightRange?.start, highlightRange?.end, expanded]);

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

  const showWindowed = !expanded && highlightRange && windowed.highlight;
  const showExpanded = expanded;
  const showArticle = showWindowed || showExpanded;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              全文对照
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-[var(--color-text-primary)]">
              {chunkSubtitle}
            </p>
            {highlightRange ? (
              <p className="mt-1 text-[10px] text-[var(--color-accent)]">
                已定位当前分块在原文中的位置
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                未能精确匹配原文位置，请查看下方分块内容
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            {expanded ? '收起' : '展开全文'}
          </button>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4"
      >
        {showArticle ? (
          <article className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)]">
            {showWindowed ? (
              <div className="whitespace-pre-wrap break-words">
                {windowed.hasPrefix ? (
                  <p className="mb-2 text-[10px] text-[var(--color-text-secondary)]">
                    … 前文已省略
                  </p>
                ) : null}
                {renderHighlighted(
                  windowed.text,
                  windowed.highlight!,
                  highlightRef,
                  activeChunk.id,
                )}
                {windowed.hasSuffix ? (
                  <p className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
                    后文已省略 …
                  </p>
                ) : null}
              </div>
            ) : (
              renderExpandedSections(
                source.sections,
                highlightRange,
                highlightRef,
                activeChunk.id,
              )
            )}
          </article>
        ) : null}
        {!highlightRange && activeChunk.content.trim() ? (
          <aside
            className={`${showArticle ? 'mt-4 ' : ''}rounded-[length:var(--radius-control)] border border-[var(--color-citation-border)] bg-[var(--color-citation-bg)] px-3 py-2.5`}
          >
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
