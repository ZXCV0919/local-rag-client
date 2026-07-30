import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import { KbKindIcon } from '../knowledge-base/KbKindIcon';
import type { KnowledgeBaseRow } from '../../types/knowledge-base';
import { knowledgeBaseFromRow } from '../../types/knowledge-base';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { kbThemeForId } from '../../utils/kb-theme';

function sidebarItemClass(active: boolean): string {
  const base =
    'relative mb-1 flex w-full items-center gap-2.5 rounded-[length:var(--radius-control)] border border-transparent py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';
  if (active) {
    return `${base} bg-[var(--color-bg-hover)] pl-[calc(0.625rem-2px)] pr-2.5 text-[var(--color-text-sidebar)] before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:rounded-full before:bg-[var(--color-accent)] before:content-['']`;
  }
  return `${base} px-2.5 text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-sidebar)]`;
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
      <div className="border-b border-[var(--color-border-sidebar)] px-3 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-sidebar-icon-bg)] text-[var(--color-sidebar-icon-fg)]">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-sidebar)]">本地知识库</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--color-text-sidebar-dim)]">知识库</span>
          <button
            type="button"
            onClick={() => navigate('/', { state: { openKbCreate: true } })}
            className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-sidebar-dim)] transition-colors hover:border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] hover:text-[var(--color-text-sidebar)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            + 新建
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {knowledgeBases.length === 0 ? (
          <div className="px-2 py-3 text-xs text-[var(--color-text-sidebar-dim)]">暂无知识库</div>
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
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-sidebar-icon-bg)] text-[var(--color-sidebar-icon-fg)]"
                  aria-hidden
                >
                  <KbKindIcon kind={theme.kind} />
                </span>
                <span className="min-w-0 flex-1 truncate">{kb.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-sidebar-dim)]">{kb.document_count}</span>
              </button>
            );
          })
        )}
      </nav>

      <div className="border-t border-[var(--color-border-sidebar)] p-2">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={sidebarItemClass(settingsActive)}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="flex-1 text-left">设置</span>
          <svg className="h-3.5 w-3.5 opacity-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
