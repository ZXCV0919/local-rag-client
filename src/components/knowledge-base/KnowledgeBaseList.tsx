import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { useToastStore } from '../../store/toast';
import { tauriCommand } from '../../hooks/useDatabase';
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center px-6 py-10">
      {loading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">加载中…</p>
      ) : knowledgeBases.length === 0 ? (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-base text-[var(--color-text-primary)]">从左侧选择或新建知识库</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            新建知识库
          </button>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeedDemo()}
            className="text-xs text-[var(--color-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--color-text-primary)] hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {seeding ? '正在导入演示语料…' : '导入演示语料'}
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
          <p className="text-base text-[var(--color-text-primary)]">从左侧选择知识库开始对话</p>
          <ul className="w-full space-y-1 text-left">
            {knowledgeBases.map((kb) => (
              <li key={kb.id}>
                <Link
                  to={`/kb/${kb.id}/chat`}
                  className="block rounded-[length:var(--radius-control)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-btn-ghost-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                >
                  {kb.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-sm text-[var(--color-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              新建知识库
            </button>
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeedDemo()}
              className="text-xs text-[var(--color-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--color-text-primary)] hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {seeding ? '正在导入演示语料…' : '导入演示语料'}
            </button>
          </div>
        </div>
      )}

      <CreateKnowledgeBaseDialog open={showCreate} onOpenChange={setShowCreate} onSubmit={handleCreate} />
    </div>
  );
}
