import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDocument } from '../../hooks/useDocument';
import { useToastStore } from '../../store/toast';
import { EmptyState } from '../common/EmptyState';
import { KbSectionNav } from '../knowledge-base/KbSectionNav';
import { DocumentCard } from './DocumentCard';
import { DocumentImporter } from './DocumentImporter';
import { reprocessDocument } from '../../services/importer';
import type { Document, ImportProgress } from '../../types/document';
import type { KnowledgeBase, KnowledgeBaseRow } from '../../types/knowledge-base';
import { knowledgeBaseFromRow } from '../../types/knowledge-base';
import { tauriCommand } from '../../hooks/useDatabase';

export function DocumentList() {
  const { id: kbId } = useParams<{ id: string }>();
  const navigate = useAppNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [kb, setKb] = useState<KnowledgeBase | null>(null);

  const {
    documents,
    loading,
    error,
    loadDocuments,
    deleteDocument,
    setImportProgress,
    importProgress,
  } = useDocument(kbId);

  const [filter, setFilter] = useState('');
  const debouncedFilter = useDebouncedValue(filter, 300);

  const filteredDocs = useMemo(() => {
    const q = debouncedFilter.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        (d.error_message ?? '').toLowerCase().includes(q),
    );
  }, [documents, debouncedFilter]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!kbId) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await tauriCommand<KnowledgeBaseRow>('get_knowledge_base', { id: kbId });
        if (!cancelled) setKb(knowledgeBaseFromRow(row));
      } catch {
        if (!cancelled) setKb(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const onImportProgress = useCallback(
    (documentId: string, p: ImportProgress) => {
      setImportProgress(documentId, p);
    },
    [setImportProgress],
  );

  const onRetry = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!kb || !doc) return;
    try {
      await reprocessDocument(kb, doc, (p) => onImportProgress(docId, p));
    } catch {
      /* status + error_message on document */
    }
    await loadDocuments();
  };

  if (!kbId) {
    return <div className="p-6">无效的知识库</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KbSectionNav kbId={kbId} active="documents" />
      <div className="mx-auto w-full max-w-[min(100%,1680px)] flex-1 overflow-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-[length:var(--text-section)] font-bold text-[var(--color-text-primary)]">文档管理</h1>
          <p className="mt-1 text-[length:var(--text-body)] text-[var(--color-text-secondary)]">
            导入后自动解析、分块、向量化并写入 ChromaDB；完成后状态为「就绪」。
          </p>
        </div>
        <div className="w-full sm:w-64 shrink-0">
          <label className="sr-only" htmlFor="doc-search">
            搜索文档
          </label>
          <input
            id="doc-search"
            type="search"
            data-hotkey-primary-search
            placeholder="搜索标题或文件名…（Ctrl/Cmd+K）"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      <div id="document-import-zone" className="mb-8 scroll-mt-4">
        {kb ? (
          <DocumentImporter
            knowledgeBase={kb}
            onProgress={onImportProgress}
            onComplete={() => void loadDocuments()}
            onImportError={(msg) =>
              addToast({
                type: 'error',
                title: '导入失败',
                message: msg,
              })
            }
          />
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">加载知识库配置…</p>
        )}
      </div>

      {error ? <p className="text-sm text-[var(--color-danger-text)] mb-4">{error}</p> : null}

      {loading ? (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
          {[0, 1, 2, 3].map((k) => (
            <li key={k}>
              <div className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 h-36 animate-pulse" />
            </li>
          ))}
        </ul>
      ) : documents.length === 0 ? (
        <div className="rounded-[length:var(--radius-card)] border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="还没有文档"
            description="导入 PDF / Markdown / Word，解析并向量化完成后即可提问。大文件处理时请保持窗口打开。"
            primaryLabel="去导入"
            onPrimary={() => {
              document.getElementById('document-import-zone')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            steps={['选择或拖入文件', '等待解析与向量化完成（状态变为「就绪」）', '回到对话页提问']}
            icon={
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
        </div>
      ) : filteredDocs.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)] py-8 text-center">
          没有匹配的文档，请调整搜索关键词。
        </p>
      ) : (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
          {filteredDocs.map((doc: Document) => (
            <li key={doc.id} className="min-w-0">
              <DocumentCard
                doc={doc}
                importProgress={importProgress.get(doc.id)}
                onViewChunks={(id) => navigate(`/documents/${id}`)}
                onDelete={(x) => void deleteDocument(x)}
                onRetry={(x) => void onRetry(x)}
              />
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
