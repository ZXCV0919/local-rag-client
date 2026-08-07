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
        const visibleIds = new Set(visible.map((c) => c.id));
        setChunks(all.filter((c) => visibleIds.has(c.id)));
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
    if (!doc || doc.id !== documentId) return;
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
    void target.offsetWidth;
    target.classList.add('chunk-highlight-mark');
  }, [focusChunkId, focusNonce, chunks, truncated, loading, addToast, doc, documentId]);

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
