import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import type { Document } from '../../types/document';
import type { ChunkRow } from '../../types/chunk';
import { chunkFromRow, type Chunk } from '../../types/chunk';
import { fileTypeStyle } from '../../utils/source-card';
import { ChunkPreview } from './ChunkPreview';

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const focusChunkId = searchParams.get('chunk') ?? undefined;
  const navigate = useAppNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const d = await tauriCommand<Document>('get_document', { id });
        if (cancelled) return;
        setDoc(d);
        const rows = await tauriCommand<ChunkRow[]>('list_document_chunks', {
          documentId: id,
        });
        if (cancelled) return;
        setChunks(rows.map(chunkFromRow));
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return <div className="p-6">无效的文档</div>;
  }

  const fileIcon = doc ? fileTypeStyle(doc.file_type) : null;
  const totalTokens = chunks.reduce((sum, c) => sum + c.token_count, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <button
        type="button"
        onClick={() =>
          doc ? navigate(`/kb/${doc.knowledge_base_id}/documents`) : navigate(-1)
        }
        className="mb-4 inline-flex shrink-0 items-center gap-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded px-1"
      >
        ← 返回文档列表
      </button>

      {loading ? (
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-[var(--color-bg-secondary)]" />
          <div className="h-4 w-96 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
          <div className="mt-6 h-[480px] animate-pulse rounded-[length:var(--radius-card)] bg-[var(--color-bg-secondary)]" />
        </div>
      ) : null}

      {error ? <p className="mb-4 text-sm text-[var(--color-danger-text)]">{error}</p> : null}

      {doc && !loading ? (
        <>
          <header className="mb-4 shrink-0 rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-start gap-3">
              {fileIcon ? (
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[length:var(--radius-control)] text-xs font-bold"
                  style={{ background: fileIcon.bg, color: fileIcon.fg }}
                >
                  {fileIcon.label}
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
                  {doc.title}
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {doc.file_name} · {doc.chunk_count} 分块
                  {totalTokens > 0 ? (
                    <>
                      {' '}
                      · ~{totalTokens.toLocaleString()} tokens
                    </>
                  ) : null}{' '}
                  · {doc.status}
                </p>
              </div>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <ChunkPreview doc={doc} chunks={chunks} focusChunkId={focusChunkId} />
          </div>
        </>
      ) : null}
    </div>
  );
}
