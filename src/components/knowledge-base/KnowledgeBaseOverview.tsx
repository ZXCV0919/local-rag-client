import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import type { Conversation } from '../../types/conversation';
import type { Document } from '../../types/document';
import type { KnowledgeBase, KnowledgeBaseRow } from '../../types/knowledge-base';
import { knowledgeBaseFromRow } from '../../types/knowledge-base';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { useToastStore } from '../../store/toast';
import { summarizeDocumentHealth } from '../../utils/document-health';
import { formatRelativeTime } from '../../utils/kb-theme';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { KbSectionNav } from './KbSectionNav';

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition-shadow duration-150 hover:shadow-[var(--shadow-float)]">
      <div className="mb-2 flex items-center gap-2 text-[var(--color-accent)]">{icon}</div>
      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{label}</div>
    </div>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 py-2">
      <p className="text-sm text-[var(--color-danger-text)]">加载失败</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        重试
      </button>
    </div>
  );
}

export function KnowledgeBaseOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useAppNavigate();
  const removeKnowledgeBase = useKnowledgeBaseStore((s) => s.removeKnowledgeBase);
  const addToast = useToastStore((s) => s.addToast);
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [convError, setConvError] = useState(false);
  const [docsError, setDocsError] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const row = await tauriCommand<KnowledgeBaseRow>('get_knowledge_base', { id });
        setKb(knowledgeBaseFromRow(row));
      } catch {
        navigate('/');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, navigate]);

  const loadConversations = useCallback(async () => {
    if (!id) return;
    setConvLoading(true);
    setConvError(false);
    try {
      const rows = await tauriCommand<Conversation[]>('list_conversations', { kbId: id });
      const sorted = [...rows].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setConversations(sorted.slice(0, 5));
    } catch {
      setConvError(true);
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  }, [id]);

  const loadDocuments = useCallback(async () => {
    if (!id) return;
    setDocsLoading(true);
    setDocsError(false);
    try {
      const rows = await tauriCommand<Document[]>('list_documents', { kbId: id });
      setDocs(rows);
    } catch {
      setDocsError(true);
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || !kb) return;
    void Promise.all([loadConversations(), loadDocuments()]);
  }, [id, kb, loadConversations, loadDocuments]);

  const handleDelete = async () => {
    if (!id || !kb) return;
    setDeleting(true);
    try {
      await tauriCommand('delete_knowledge_base', { id });
      removeKnowledgeBase(id);
      addToast({
        type: 'success',
        title: '已删除知识库',
        message: `「${kb.name}」及其文档、对话已清除`,
        duration: 3500,
      });
      setDeleteOpen(false);
      navigate('/');
    } catch (e) {
      addToast({
        type: 'error',
        title: '删除失败',
        message: e instanceof Error ? e.message : String(e),
        duration: 6000,
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-[var(--color-text-secondary)]">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        加载中…
      </div>
    );
  }

  if (!kb || !id) return null;

  const health = summarizeDocumentHealth(docs);
  const chunkTotal = docs.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0);
  // Prefer loaded docs total; only fall back to kb.document_count when list failed.
  const docCount = docsError ? kb.document_count : health.total;
  const statusLabel = docsError
    ? '—'
    : health.error
      ? '有失败'
      : health.processing
        ? '处理中'
        : '就绪';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <KbSectionNav kbId={id} active="overview" />
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-auto px-6 py-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-4 text-[length:var(--text-meta)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)]"
        >
          ← 全部知识库
        </button>

        <section
          className="relative overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-hero)] sm:p-8"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 120% at 100% 0%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 55%)',
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                知识库工作台
              </p>
              <h1 className="mt-2 text-[length:var(--text-page-title)] font-bold tracking-tight text-[var(--color-text-primary)]">
                {kb.name}
              </h1>
              <p className="mt-2 text-[length:var(--text-body)] leading-relaxed text-[var(--color-text-secondary)]">
                {kb.description || '导入文档后即可检索问答；回答会附带来源引用。'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(`/kb/${id}/chat`)}
                className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[var(--color-on-accent)] shadow-[var(--shadow-sm)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                开始提问
              </button>
              <button
                type="button"
                onClick={() => navigate(`/kb/${id}/documents`)}
                className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                管理文档
              </button>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="文档"
            value={docCount}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
              </svg>
            }
          />
          <StatCard
            label="分块"
            value={docsError ? '—' : chunkTotal.toLocaleString()}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
              </svg>
            }
          />
          <StatCard
            label="就绪状态"
            value={statusLabel}
            icon={
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
                <path d="M22 4 12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-[length:var(--text-section)] font-semibold text-[var(--color-text-primary)]">最近对话</h2>
            {convLoading ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">加载中…</p>
            ) : convError ? (
              <div className="mt-3">
                <SectionError onRetry={() => void loadConversations()} />
              </div>
            ) : conversations.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">暂无对话，点击上方「开始提问」。</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/kb/${id}/chat/${c.id}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-[length:var(--radius-control)] px-2.5 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {c.title || '未命名对话'}
                      </span>
                      <span className="shrink-0 text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">
                        {formatRelativeTime(c.updated_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-[length:var(--text-section)] font-semibold text-[var(--color-text-primary)]">文档动态</h2>
            {docsLoading ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">加载中…</p>
            ) : docsError ? (
              <div className="mt-3">
                <SectionError onRetry={() => void loadDocuments()} />
              </div>
            ) : (
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-[length:var(--radius-control)] bg-[var(--color-muted-bg)] px-3 py-3">
                  <dt className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">就绪</dt>
                  <dd className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{health.ready}</dd>
                </div>
                <div className="rounded-[length:var(--radius-control)] bg-[var(--color-muted-bg)] px-3 py-3">
                  <dt className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">处理中</dt>
                  <dd className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{health.processing}</dd>
                </div>
                <div className="rounded-[length:var(--radius-control)] bg-[var(--color-muted-bg)] px-3 py-3">
                  <dt className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">失败</dt>
                  <dd className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">{health.error}</dd>
                </div>
              </dl>
            )}
          </section>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-danger-border)] px-4 py-2 text-sm text-[var(--color-danger-text)] transition-colors duration-150 hover:bg-[var(--color-danger-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            删除知识库
          </button>
        </div>

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`删除「${kb.name}」？`}
          description={`将永久删除该知识库下的全部文档、分块、对话与向量数据，且不可恢复。当前约有 ${kb.document_count} 份文档。`}
          confirmLabel="确认删除"
          cancelLabel="取消"
          danger
          loading={deleting}
          onConfirm={() => void handleDelete()}
        />
      </div>
    </div>
  );
}
