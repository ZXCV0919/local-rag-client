import { useState, type ReactNode } from 'react';
import type { Chunk } from '../../../types/chunk';
import { chunkHeadingLabel, chunkTypeBadge } from '../../../utils/chunk-display';

function highlight(text: string, q: string): ReactNode {
  if (!q.trim()) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const j = lower.indexOf(needle, i);
    if (j < 0) {
      parts.push(text.slice(i));
      break;
    }
    parts.push(text.slice(i, j));
    parts.push(
      <mark key={key++} className="rounded bg-amber-200/90 px-0.5 dark:bg-amber-400/30">
        {text.slice(j, j + needle.length)}
      </mark>,
    );
    i = j + needle.length;
  }
  return <>{parts}</>;
}

interface ChunkDetailPanelProps {
  chunk: Chunk | null;
  searchQuery: string;
  asking: boolean;
  onAskInChat: () => void;
}

export function ChunkDetailPanel({ chunk, searchQuery, asking, onAskInChat }: ChunkDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!chunk) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--color-text-secondary)]">
        选择分块后在此查看完整内容与操作。
      </div>
    );
  }

  const badge = chunkTypeBadge(chunk.chunk_type);
  const heading = chunkHeadingLabel(chunk);
  const isCode = chunk.chunk_type === 'code';

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(chunk.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              分块详情
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-primary)]">{heading}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: badge.bg, color: badge.fg }}
              >
                {badge.label}
              </span>
              <span className="text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                #{chunk.chunk_index + 1} · ~{chunk.token_count} tokens · chars {chunk.char_start}–{chunk.char_end}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={copyContent}
              className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-2.5 py-1 text-xs hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {copied ? '已复制' : '复制内容'}
            </button>
            <button
              type="button"
              onClick={onAskInChat}
              disabled={asking}
              className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
            >
              {asking ? '跳转中…' : '用此分块提问'}
            </button>
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div
          className={`rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_22%,var(--color-surface))] p-4 text-sm leading-relaxed text-[var(--color-text-primary)] ${
            isCode ? 'font-mono text-[13px]' : ''
          }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {highlight(chunk.content, searchQuery.trim())}
          </div>
        </div>
      </div>
    </div>
  );
}
