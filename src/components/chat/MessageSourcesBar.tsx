import { useEffect, useState } from 'react';

import { useSourcesPanelContext } from '../../context/SourcesPanelContext';

import { tauriCommand } from '../../hooks/useDatabase';

import type { CitationPart } from '../../utils/citations';

import type { Chunk, ChunkRow } from '../../types/chunk';

import { chunkFromRow } from '../../types/chunk';

import { SourceResultCard } from './SourceResultCard';



export interface MessageSourcesBarProps {

  parts: Extract<CitationPart, { type: 'citation' }>[];

  chunkIds: string[];

  highlightQuery?: string;

}



export function MessageSourcesBar({ parts, chunkIds, highlightQuery }: MessageSourcesBarProps) {

  const { revealChunk } = useSourcesPanelContext();

  const [open, setOpen] = useState(true);

  const [showAll, setShowAll] = useState(false);

  const [chunks, setChunks] = useState<Map<string, Chunk>>(new Map());

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    if (!open || parts.length === 0) return;

    const ids = parts.map((p) => chunkIds[p.refIndex - 1]).filter(Boolean) as string[];

    if (ids.length === 0) return;



    let cancelled = false;

    (async () => {

      setLoading(true);

      try {

        const rows = await Promise.all(

          ids.map((id) => tauriCommand<ChunkRow>('get_chunk', { id }).catch(() => null)),

        );

        if (cancelled) return;

        const map = new Map<string, Chunk>();

        for (const row of rows) {

          if (row) {

            const c = chunkFromRow(row);

            map.set(c.id, c);

          }

        }

        setChunks(map);

      } finally {

        if (!cancelled) setLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [open, parts, chunkIds]);



  if (parts.length === 0) return null;



  const visible = showAll ? parts : parts.slice(0, 3);

  const hasMore = parts.length > 3;



  return (

    <div className="mt-3 w-full max-w-[min(100%,720px)] rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_22%,var(--color-surface))] p-3">

      <button

        type="button"

        onClick={() => setOpen((v) => !v)}

        className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-[length:var(--radius-control)] px-0.5 -mx-0.5"

        aria-expanded={open}

      >

        <span className="text-sm font-semibold text-[var(--color-text-primary)]">

          参考来源 ({parts.length})

        </span>

        <svg

          className={`h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}

          viewBox="0 0 24 24"

          fill="none"

          stroke="currentColor"

          strokeWidth="2"

          aria-hidden

        >

          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />

        </svg>

      </button>



      {open ? (

        <div className="mt-2.5 space-y-2.5">

          {loading ? (

            <p className="py-2 text-center text-xs text-[var(--color-text-secondary)]">加载来源…</p>

          ) : null}

          {visible.map((part, i) => {

            const chunkId = chunkIds[part.refIndex - 1];

            const chunk = chunkId ? chunks.get(chunkId) : undefined;

            const fileName = chunk

              ? (chunk.metadata?.file_name as string | undefined) || part.fileLabel

              : part.fileLabel;

            return (

              <SourceResultCard

                key={`${part.refIndex}-${i}`}

                index={i + 1}

                fileName={fileName}

                content={chunk?.content ?? '（点击打开文档查看原文）'}

                headingPath={chunk?.heading_path}

                fragmentLabel={`片段 ${part.refIndex}`}

                highlightQuery={highlightQuery}

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

              />

            );

          })}

          {hasMore && !showAll ? (

            <button

              type="button"

              onClick={() => setShowAll(true)}

              className="w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

            >

              查看全部来源 →

            </button>

          ) : null}

        </div>

      ) : null}

    </div>

  );

}

