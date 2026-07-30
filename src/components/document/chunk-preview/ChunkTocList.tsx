import { useEffect, useRef } from 'react';
import type { Chunk } from '../../../types/chunk';
import { chunkTypeBadge, groupChunksByHeading } from '../../../utils/chunk-display';

interface ChunkTocListProps {
  chunks: Chunk[];
  activeChunkId: string | null;
  onSelect: (chunkId: string) => void;
}

export function ChunkTocList({ chunks, activeChunkId, onSelect }: ChunkTocListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const groups = groupChunksByHeading(chunks);

  useEffect(() => {
    if (!activeChunkId || !listRef.current) return;
    const activeButton = listRef.current.querySelector<HTMLButtonElement>(
      `[data-chunk-id="${activeChunkId}"]`,
    );
    activeButton?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeChunkId]);

  if (chunks.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-[var(--color-text-secondary)]">没有匹配的分块</p>
    );
  }

  return (
    <div ref={listRef} className="h-full min-w-0 space-y-3 overflow-x-hidden overflow-y-auto px-1 py-1">
      {groups.map((group) => (
        <div key={group.heading} className="min-w-0">
          <div className="mb-1 truncate px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {group.heading}
          </div>
          <ul className="min-w-0 space-y-0.5">
            {group.items.map((chunk) => {
              const badge = chunkTypeBadge(chunk.chunk_type);
              const active = chunk.id === activeChunkId;
              const preview = chunk.content.replace(/\s+/g, ' ').trim().slice(0, 56);
              return (
                <li key={chunk.id} className="min-w-0">
                  <button
                    type="button"
                    data-chunk-id={chunk.id}
                    onClick={() => onSelect(chunk.id)}
                    className={`flex w-full min-w-0 items-start gap-2 overflow-hidden rounded-[length:var(--radius-control)] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                      active
                        ? 'border border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))]'
                        : 'border border-transparent hover:bg-[var(--color-btn-ghost-hover)]'
                    }`}
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-[var(--color-on-accent)]"
                      aria-hidden
                    >
                      {chunk.chunk_index + 1}
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                        <span
                          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                          style={{ background: badge.bg, color: badge.fg }}
                        >
                          {badge.label}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-secondary)]">
                          ~{chunk.token_count}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 break-words text-[11px] leading-snug text-[var(--color-text-secondary)]">
                        {preview || '—'}
                        {chunk.content.length > 56 ? '…' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
