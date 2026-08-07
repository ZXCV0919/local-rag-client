import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import { KbKindIcon } from '../knowledge-base/KbKindIcon';
import type { KnowledgeBaseRow } from '../../types/knowledge-base';
import { knowledgeBaseFromRow } from '../../types/knowledge-base';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { kbThemeForId } from '../../utils/kb-theme';
import { BrandMark } from '../brand/BrandMark';

function sidebarItemClass(active: boolean): string {
  const base =
    'relative mb-1.5 flex w-full items-center gap-2.5 rounded-[length:var(--radius-control)] border border-transparent py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';
  if (active) {
    return `${base} bg-[var(--color-bg-hover)] pl-[calc(0.75rem-2px)] pr-3 text-[var(--color-text-sidebar)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-full before:bg-[var(--color-accent)] before:content-['']`;
  }
  return `${base} px-3 text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-sidebar)]`;
}

export function Sidebar() {
  const navigate = useAppNavigate();
  const location = useLocation();
  const knowledgeBases = useKnowledgeBaseStore((s) => s.knowledgeBases);
  const setKnowledgeBases = useKnowledgeBaseStore((s) => s.setKnowledgeBases);

  useEffect(() => {
    (async () => {
      try {
        const rows = await tauriCommand<KnowledgeBaseRow[]>('list_knowledge_bases');
        setKnowledgeBases(rows.map(knowledgeBaseFromRow));
      } catch (err) {
        console.error('Failed to load knowledge bases:', err);
      }
    })();
  }, [setKnowledgeBases]);

  const settingsActive = location.pathname.startsWith('/settings');

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] min-w-[var(--sidebar-width)] flex-col overflow-hidden border-r border-[var(--color-border-sidebar)] bg-[var(--color-bg-sidebar)] text-[var(--color-text-sidebar)]">
      <div className="border-b border-[var(--color-border-sidebar)] px-4 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <BrandMark size={40} className="shrink-0 shadow-[var(--shadow-sm)]" />
          <div className="min-w-0 pt-0.5">
            <div className="truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-sidebar)]">
              本地知识库
            </div>
            <p className="mt-0.5 text-[length:var(--text-meta)] leading-snug text-[var(--color-text-sidebar-dim)]">
              私有文档 · 可溯源问答
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-sidebar-dim)]">
            知识库
          </span>
          <button
            type="button"
            onClick={() => navigate('/', { state: { openKbCreate: true } })}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-border-sidebar)] bg-[var(--color-bg-hover)] px-2.5 py-1 text-[length:var(--text-meta)] font-medium text-[var(--color-text-sidebar)] transition-colors hover:border-[color-mix(in_srgb,var(--color-accent)_50%,var(--color-border-sidebar))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            + 新建
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {knowledgeBases.length === 0 ? (
          <div className="rounded-[length:var(--radius-card)] border border-dashed border-[var(--color-border-sidebar)] px-3 py-4 text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-sidebar-dim)]">
            还没有知识库。先新建一个，再导入文档即可提问。
            <button
              type="button"
              onClick={() => navigate('/', { state: { openKbCreate: true } })}
              className="mt-3 block w-full rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-3 py-2 text-center text-sm font-medium text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
            >
              新建知识库
            </button>
          </div>
        ) : (
          knowledgeBases.map((kb) => {
            const active = location.pathname.startsWith(`/kb/${kb.id}`);
            const theme = kbThemeForId(kb.id);
            return (
              <button
                key={kb.id}
                type="button"
                onClick={() => navigate(`/kb/${kb.id}`)}
                className={sidebarItemClass(active)}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[length:var(--radius-control)]"
                  style={{ background: theme.iconBg, color: theme.iconFg }}
                  aria-hidden
                >
                  <KbKindIcon kind={theme.kind} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{kb.name}</span>
              </button>
            );
          })
        )}
      </nav>

      <div className="border-t border-[var(--color-border-sidebar)] p-2.5">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={sidebarItemClass(settingsActive)}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[length:var(--radius-control)] bg-[var(--color-bg-hover)] text-[var(--color-text-sidebar-dim)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
            </svg>
          </span>
          <span className="font-medium">设置</span>
        </button>
      </div>
    </aside>
  );
}
