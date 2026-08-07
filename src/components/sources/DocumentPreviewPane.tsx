import { useEffect, useState } from 'react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import type { Document } from '../../types/document';
import type { ChunkRow } from '../../types/chunk';
import { chunkFromRow } from '../../types/chunk';

const MAX_CHUNKS = 40;
const MAX_CHARS = 24_000;

function isPdfHeavy(doc: Document, previewText: string): boolean {
  if (doc.file_type !== 'pdf') return false;
  const trimmed = previewText.trim();
  return trimmed.length < 80;
}

export function DocumentPreviewPane({ documentId }: { documentId: string | null }) {
  const navigate = useAppNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) {
      setDoc(null);
      setPreviewText('');
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
      setPreviewText('');
      setTruncated(false);
      try {
        const d = await tauriCommand<Document>('get_document', { id: documentId });
        if (cancelled) return;
        setDoc(d);

        const rows = await tauriCommand<ChunkRow[]>('list_document_chunks', {
          documentId,
        });
        if (cancelled) return;

        const chunks = rows.map(chunkFromRow);
        const slice = chunks.slice(0, MAX_CHUNKS);
        let text = slice.map((c) => c.content).join('\n\n');
        let wasTruncated = chunks.length > MAX_CHUNKS;
        if (text.length > MAX_CHARS) {
          text = text.slice(0, MAX_CHARS);
          wasTruncated = true;
        }
        setPreviewText(text);
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

  const pdfFallback = isPdfHeavy(doc, previewText);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2">
        <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{doc.file_name}</p>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{doc.status}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
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
        ) : previewText.trim() ? (
          <>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[var(--color-text-primary)]">
              {previewText}
            </pre>
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
