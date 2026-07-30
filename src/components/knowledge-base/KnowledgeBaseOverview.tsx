import { useParams } from 'react-router-dom';

import { useAppNavigate } from '../../hooks/useAppNavigate';

import { useEffect, useState, type ReactNode } from 'react';

import { tauriCommand } from '../../hooks/useDatabase';

import type { KnowledgeBase, KnowledgeBaseRow } from '../../types/knowledge-base';

import { knowledgeBaseFromRow } from '../../types/knowledge-base';



function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {

  return (

    <div className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition-shadow duration-150 hover:shadow-[var(--shadow-float)]">

      <div className="mb-2 flex items-center gap-2 text-[var(--color-accent)]">{icon}</div>

      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>

      <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{label}</div>

    </div>

  );

}



export function KnowledgeBaseOverview() {

  const { id } = useParams<{ id: string }>();

  const navigate = useAppNavigate();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);

  const [loading, setLoading] = useState(true);



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



  if (loading) {

    return (

      <div className="flex items-center gap-2 p-6 text-sm text-[var(--color-text-secondary)]">

        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />

        加载中…

      </div>

    );

  }

  if (!kb) return null;



  return (

    <div className="mx-auto max-w-4xl p-6">

      <button

        type="button"

        onClick={() => navigate('/')}

        className="mb-3 text-[length:var(--text-meta)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)]"

      >

        ← 全部知识库

      </button>

      <h1 className="text-[length:var(--text-page-title)] font-bold text-[var(--color-text-primary)]">{kb.name}</h1>

      {kb.description ? (

        <p className="mt-1 text-[length:var(--text-body)] text-[var(--color-text-secondary)]">{kb.description}</p>

      ) : null}



      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

        <StatCard

          label="文档"

          value={kb.document_count}

          icon={

            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>

              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />

              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />

            </svg>

          }

        />

        <StatCard

          label="Tokens"

          value={kb.total_tokens.toLocaleString()}

          icon={

            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>

              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />

            </svg>

          }

        />

        <StatCard

          label="Embedding 模型"

          value={kb.embedding_model}

          icon={

            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>

              <circle cx="12" cy="12" r="3" />

              <path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeLinecap="round" />

            </svg>

          }

        />

      </div>



      <div className="mt-8 flex flex-wrap gap-3">

        <button

          type="button"

          onClick={() => navigate(`/kb/${id}/chat`)}

          className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-[var(--color-on-accent)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

        >

          开始对话

        </button>

        <button

          type="button"

          onClick={() => navigate(`/kb/${id}/documents`)}

          className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

        >

          管理文档

        </button>

      </div>

    </div>

  );

}

