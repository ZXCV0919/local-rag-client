import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSourcesPanelContext } from '../../context/SourcesPanelContext';
import { tauriCommand } from '../../hooks/useDatabase';
import { useToastStore } from '../../store/toast';
import type { Document } from '../../types/document';
import { DocumentPreviewPane } from './DocumentPreviewPane';

export function SourcesPanel() {
  const { id: kbId } = useParams<{ id: string }>();
  const { focusChunk } = useSourcesPanelContext();
  const addToast = useToastStore((s) => s.addToast);
  const lastFocusNonce = useRef<number | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kbId) {
      setDocuments([]);
      setSelectedDocId(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const docs = await tauriCommand<Document[]>('list_documents', { kbId });
        if (cancelled) return;
        setDocuments(docs);
        setSelectedDocId((prev) => {
          if (prev && docs.some((d) => d.id === prev)) return prev;
          return docs[0]?.id ?? null;
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setDocuments([]);
          setSelectedDocId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kbId]);

  useEffect(() => {
    if (!focusChunk) return;
    if (loading) return;
    if (lastFocusNonce.current === focusChunk.nonce) return;
    lastFocusNonce.current = focusChunk.nonce;

    const exists = documents.some((d) => d.id === focusChunk.documentId);
    if (!exists) {
      addToast({ type: 'warning', title: '找不到该文档', duration: 3000 });
      return;
    }
    setSelectedDocId(focusChunk.documentId);
  }, [focusChunk, documents, loading, addToast]);

  if (!kbId) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--color-text-secondary)]">
        选择知识库后查看文档
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex max-h-[45%] min-h-[120px] shrink-0 flex-col border-b border-[var(--color-border)]">
        <div className="shrink-0 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
          文档
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">加载中…</p>
          ) : null}
          {error ? (
            <p className="px-3 py-2 text-xs text-[var(--color-danger-text)]">{error}</p>
          ) : null}
          {!loading && !error && documents.length === 0 ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">暂无文档</p>
          ) : null}
          <ul className="pb-1">
            {documents.map((doc) => {
              const selected = doc.id === selectedDocId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)] ${
                      selected
                        ? 'bg-[var(--color-bg-active)] text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                    }`}
                  >
                    <span className="min-w-0 truncate">{doc.file_name}</span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)]">
                      {doc.status}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <DocumentPreviewPane
        documentId={selectedDocId}
        focusChunkId={
          focusChunk && selectedDocId === focusChunk.documentId
            ? focusChunk.chunkId
            : null
        }
        focusNonce={focusChunk?.nonce ?? 0}
      />
    </div>
  );
}
