import { useState } from 'react';

import { useAppNavigate } from '../../hooks/useAppNavigate';

import type { RerankedResult } from '../../services/retrieval';

import { SourceResultCard } from './SourceResultCard';



export interface SearchResultsPanelProps {

  chunks: RerankedResult[];

  loading: boolean;

  error: string | null;

  modeLabel: string;

  className?: string;

  hasSearched?: boolean;

  totalCandidates?: number;

}



export function SearchResultsPanel({

  chunks,

  loading,

  error,

  modeLabel,

  className = '',

  hasSearched = false,

  totalCandidates = -1,

}: SearchResultsPanelProps) {

  const navigate = useAppNavigate();

  const [expanded, setExpanded] = useState(true);

  const [showAll, setShowAll] = useState(false);



  const visible = showAll ? chunks : chunks.slice(0, 3);

  const hasMore = chunks.length > 3;



  return (

    <aside

      className={`flex min-h-0 flex-col rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ${className}`}

      aria-label="检索工作台结果"

    >

      <button

        type="button"

        onClick={() => setExpanded((v) => !v)}

        className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"

        aria-expanded={expanded}

      >

        <span className="text-sm font-semibold text-[var(--color-text-primary)]">

          命中片段

          {chunks.length > 0 ? ` (${chunks.length})` : ''}

          <span className="ml-1.5 text-[length:var(--text-meta)] font-normal text-[var(--color-text-secondary)]">

            · {modeLabel}

          </span>

        </span>

        <svg

          className={`h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}

          viewBox="0 0 24 24"

          fill="none"

          stroke="currentColor"

          strokeWidth="2"

          aria-hidden

        >

          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />

        </svg>

      </button>



      {expanded ? (

        <div className="flex min-h-[120px] flex-1 flex-col overflow-y-auto p-3">

          {loading ? (

            <p className="py-6 text-center text-xs text-[var(--color-text-secondary)]">检索中…</p>

          ) : null}

          {error ? <p className="text-xs text-[var(--color-danger-text)]">{error}</p> : null}

          {!loading && !error && chunks.length === 0 ? (

            <p className="px-1 py-6 text-center text-xs leading-relaxed text-[var(--color-text-secondary)]">

              {hasSearched

                ? '没有命中结果。可缩短查询、换核心词，或确认文档已「就绪」且已向量化。'

                : '输入问题并点击「检索」查看分块。'}

            </p>

          ) : null}

          {hasSearched && totalCandidates >= 0 && chunks.length > 0 ? (

            <p className="mb-2 text-[10px] text-[var(--color-text-secondary)]">

              候选约 {totalCandidates} 条，展示 {chunks.length} 条

            </p>

          ) : null}



          <ul className="space-y-2.5">

            {visible.map((c, i) => (

              <li key={c.chunk_id}>

                <SourceResultCard

                  index={i + 1}

                  fileName={c.file_name || '文档'}

                  content={c.content}

                  headingPath={c.heading_path}

                  onClick={() =>

                    navigate(`/documents/${c.document_id}?chunk=${encodeURIComponent(c.chunk_id)}`)

                  }

                />

              </li>

            ))}

          </ul>



          {!loading && hasMore && !showAll ? (

            <button

              type="button"

              onClick={() => setShowAll(true)}

              className="mt-3 w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_35%,var(--color-surface))] py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

            >

              查看全部来源 →

            </button>

          ) : null}

        </div>

      ) : null}

    </aside>

  );

}

