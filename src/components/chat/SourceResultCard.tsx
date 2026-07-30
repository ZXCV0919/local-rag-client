import type { ReactNode } from 'react';
import {
  fileTypeStyle,
  formatSourceLocationMeta,
  escapeReg,
  inferFileType,
  previewSnippet,
} from '../../utils/source-card';

function highlightTerms(snippet: string, query: string | undefined): ReactNode {
  const q = query?.trim();
  if (!q || q.length < 2) return snippet;
  const parts = snippet.split(new RegExp(`(${escapeReg(q)})`, 'gi'));
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="rounded bg-amber-200/90 px-0.5 text-inherit dark:bg-amber-400/30">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export interface SourceResultCardProps {
  index: number;
  fileName: string;
  content: string;
  headingPath?: string;
  fragmentLabel?: string;
  highlightQuery?: string;
  onClick?: () => void;
  className?: string;
  footer?: ReactNode;
}

export function SourceResultCard({
  index,
  fileName,
  content,
  headingPath,
  fragmentLabel,
  highlightQuery,
  onClick,
  className = '',
  footer,
}: SourceResultCardProps) {
  const fileType = inferFileType(fileName);
  const icon = fileTypeStyle(fileType);
  const locationMeta = formatSourceLocationMeta(headingPath);
  const snippet = previewSnippet(content);

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-[var(--color-on-accent)]"
          aria-hidden
        >
          {index}
        </span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
          style={{ background: icon.bg, color: icon.fg }}
          aria-hidden
        >
          {icon.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {fileName || '文档'}
        </span>
        {fragmentLabel ? (
          <span className="shrink-0 text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">
            {fragmentLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-3 text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
        {highlightTerms(snippet, highlightQuery)}
      </p>
      {locationMeta || footer ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--color-text-secondary)]">
          {locationMeta ? <span>{locationMeta}</span> : <span />}
          {footer}
        </div>
      ) : null}
    </>
  );

  const cardClass = `rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_28%,var(--color-surface))] p-3 text-left transition-colors duration-150 ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cardClass} w-full hover:border-[color-mix(in_srgb,var(--color-accent)_38%,var(--color-border))] hover:bg-[color-mix(in_srgb,var(--color-accent)_4%,var(--color-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]`}
      >
        {inner}
      </button>
    );
  }

  return <article className={cardClass}>{inner}</article>;
}
