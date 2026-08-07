import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useKnowledgeBaseCardStats } from '../../hooks/useKnowledgeBaseCardStats';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { useToastStore } from '../../store/toast';
import { tauriCommand } from '../../hooks/useDatabase';
import { EmptyState } from '../common/EmptyState';
import { KnowledgeBaseCard } from './KnowledgeBaseCard';
import { CreateKnowledgeBaseDialog } from './CreateKnowledgeBaseDialog';
import { seedDemoKnowledgeBase } from '../../services/demo/seed-demo-kb';
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
  const [seeding, setSeeding] = useState(false);
  const location = useLocation();
  const navigate = useAppNavigate();
  const addToast = useToastStore((s) => s.addToast);
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

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const { knowledgeBase } = await seedDemoKnowledgeBase();
      const rows = await tauriCommand<KnowledgeBaseRow[]>('list_knowledge_bases');
      setKnowledgeBases(rows.map(knowledgeBaseFromRow));
      addToast({
        type: 'success',
        title: '演示知识库就绪',
        message: '已导入样例文档，可开始提问（需本机 Ollama 完成嵌入）。',
      });
      navigate(`/kb/${knowledgeBase.id}/chat`);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const hint =
        /Ollama|embed|11434|ECONNREFUSED|fetch failed/i.test(raw)
          ? '请确认 Ollama 已连接并已拉取嵌入模型。'
          : '若仍失败，请查看控制台日志或改用手动导入 Markdown。';
      addToast({
        type: 'error',
        title: '演示语料导入失败',
        message: `${raw} ${hint}`,
      });
    } finally {
      setSeeding(false);
    }
  };

  const cardGridClass =
    'grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-5';

  return (
    <div className="page-enter flex h-full min-h-0 w-full flex-col px-6 py-6 lg:px-8 xl:px-10">
      <div className="mb-8 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
            Workspace
          </p>
          <h1 className="mt-1 text-[length:var(--text-page-title)] font-bold tracking-tight text-[var(--color-text-primary)]">
            我的知识库
          </h1>
          <p className="mt-2 max-w-xl text-[length:var(--text-body)] leading-relaxed text-[var(--color-text-secondary)]">
            本地导入文档，混合检索后带引用回答——数据不出本机。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {knowledgeBases.length > 0 ? (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeedDemo()}
              className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-3 py-2.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-btn-ghost-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {seeding ? '正在导入演示语料…' : '导入 / 补齐演示语料'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-on-accent)] shadow-[var(--shadow-sm)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建知识库
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {loading ? (
          <div className={cardGridClass}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[220px] animate-pulse rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/35"
              />
            ))}
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex min-h-[min(480px,70%)] items-center justify-center rounded-[length:var(--radius-card)] border border-dashed border-[var(--color-border)]">
            <EmptyState
              title="创建第一个知识库"
              description="导入文档后即可检索引用；也可先装入演示语料快速体验。"
              primaryLabel="创建第一个知识库"
              onPrimary={() => setShowCreate(true)}
              secondaryLabel={seeding ? '导入中…' : '导入演示语料'}
              secondaryDisabled={seeding}
              onSecondary={() => void handleSeedDemo()}
            />
          </div>
        ) : (
          <div className={cardGridClass}>
            {knowledgeBases.map((kb) => (
              <KnowledgeBaseCard key={kb.id} knowledgeBase={kb} stats={cardStats[kb.id]} />
            ))}
          </div>
        )}
      </div>

      <CreateKnowledgeBaseDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
    </div>
  );
}
