import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useKnowledgeBaseCardStats } from '../../hooks/useKnowledgeBaseCardStats';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { tauriCommand } from '../../hooks/useDatabase';
import { KnowledgeBaseCard } from './KnowledgeBaseCard';
import { CreateKnowledgeBaseDialog } from './CreateKnowledgeBaseDialog';
import {
  knowledgeBaseFromRow,
  type CreateKnowledgeBaseInput,
  type KnowledgeBase,
  type KnowledgeBaseRow,
} from '../../types/knowledge-base';

export function KnowledgeBaseList() {
  const { knowledgeBases, setKnowledgeBases, addKnowledgeBase, loading, setLoading } =
    useKnowledgeBaseStore();
  const [showCreate, setShowCreate] = useState(false);
  const location = useLocation();
  const navigate = useAppNavigate();
  const kbIds = useMemo(() => knowledgeBases.map((kb) => kb.id), [knowledgeBases]);
  const cardStats = useKnowledgeBaseCardStats(kbIds);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await tauriCommand<KnowledgeBaseRow[]>('list_knowledge_bases');
        if (!cancelled) setKnowledgeBases(rows.map(knowledgeBaseFromRow));
      } catch (err) {
        console.error('Failed to load knowledge bases:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setKnowledgeBases, setLoading]);

  useEffect(() => {
    const st = location.state as { openKbCreate?: boolean } | null | undefined;
    if (st?.openKbCreate) {
      setShowCreate(true);
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleCreate = async (input: CreateKnowledgeBaseInput) => {
    const row = await tauriCommand<KnowledgeBaseRow>('create_knowledge_base', {
      request: {
        name: input.name,
        description: input.description ?? '',
      },
    });
    const kb: KnowledgeBase = knowledgeBaseFromRow(row);
    addKnowledgeBase(kb);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--text-page-title)] font-bold text-[var(--color-text-primary)]">知识库</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            管理和浏览您的知识库，助力更智能的对话体验
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-accent)] shadow-[var(--shadow-sm)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          新建知识库
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[220px] animate-pulse rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/35"
            />
          ))}
        </div>
      ) : knowledgeBases.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[length:var(--radius-card)] border border-dashed border-[var(--color-border)] px-6 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] text-[var(--color-accent)] shadow-[var(--shadow-sm)]"
            aria-hidden
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[var(--color-text-primary)]">还没有知识库</p>
            <p className="max-w-sm text-sm leading-relaxed text-[var(--color-text-secondary)]">
              创建一个知识库，导入文档后即可检索与对话。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-on-accent)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            创建第一个知识库
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {knowledgeBases.map((kb) => (
            <KnowledgeBaseCard key={kb.id} knowledgeBase={kb} stats={cardStats[kb.id]} />
          ))}
        </div>
      )}

      <CreateKnowledgeBaseDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
    </div>
  );
}
