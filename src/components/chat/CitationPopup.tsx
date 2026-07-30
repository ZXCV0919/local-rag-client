import * as Popover from '@radix-ui/react-popover';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import type { ChunkRow } from '../../types/chunk';
import { chunkFromRow } from '../../types/chunk';

export interface CitationPopoverProps {
  chunkId: string;
  /** 1-based index shown in the assistant message */
  refIndex: number;
  fileLabel: string;
  highlightQuery?: string;
  children: ReactNode;
}

function contextualSnippet(full: string, query: string | undefined, radius = 50): string {
  const q = query?.trim();
  if (!q) {
    return full.length > radius * 2 + 80 ? `${full.slice(0, radius + 80)}…` : full;
  }
  const lower = full.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) {
    return full.length > 180 ? `${full.slice(0, 180)}…` : full;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(full.length, idx + q.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < full.length ? '…' : '';
  return `${prefix}${full.slice(start, end)}${suffix}`;
}

function highlightTerms(snippet: string, query: string | undefined) {
  const q = query?.trim();
  if (!q || q.length < 2) return snippet;
  const parts = snippet.split(new RegExp(`(${escapeReg(q)})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="bg-amber-200/90 text-inherit rounded px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function CitationPopover({
  chunkId,
  refIndex,
  fileLabel,
  highlightQuery,
  children,
}: CitationPopoverProps) {
  const navigate = useAppNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunk, setChunk] = useState<ReturnType<typeof chunkFromRow> | null>(null);

  useEffect(() => {
    if (!open || !chunkId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await tauriCommand<ChunkRow>('get_chunk', { id: chunkId });
        if (!cancelled) setChunk(chunkFromRow(row));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, chunkId]);

  const snippet = chunk ? contextualSnippet(chunk.content, highlightQuery) : '';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-[min(100vw-2rem,420px)] max-h-[min(70vh,360px)] overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] p-4 text-sm shadow-lg outline-none data-[state=open]:animate-in fade-in zoom-in-95"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Popover.Close className="absolute top-2 right-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded border border-transparent hover:border-[var(--color-border)]">
            关闭
          </Popover.Close>
          <div className="pr-10 space-y-2">
            <div className="font-semibold text-[var(--color-text-primary)]">
              [{fileLabel}#{refIndex}]
            </div>
            {chunk ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {chunk.heading_path || '（无标题路径）'}
              </p>
            ) : null}
            {loading ? <p className="text-[var(--color-text-secondary)]">加载分块…</p> : null}
            {error ? <p className="text-[var(--color-danger-text)] text-xs">{error}</p> : null}
            {chunk && !loading ? (
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-[var(--color-bg-secondary)]/60 rounded-lg p-3 border border-[var(--color-border)]">
                {highlightTerms(snippet, highlightQuery)}
              </pre>
            ) : null}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={!chunk}
                onClick={() => chunk && navigate(`/documents/${chunk.document_id}?chunk=${chunk.id}`)}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
              >
                查看原文
              </button>
            </div>
          </div>
          <Popover.Arrow className="fill-white drop-shadow-sm" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
