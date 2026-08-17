import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import type { Conversation } from '../../types/conversation';
import type { KnowledgeBaseRow } from '../../types/knowledge-base';
import { knowledgeBaseFromRow } from '../../types/knowledge-base';
import { useKnowledgeBaseStore } from '../../store/knowledge-base';
import { useSettingsStore } from '../../store/settings';

const refreshListeners = new Set<() => void>();

/** ChatInterface title updates call this via RetrievalWorkbench. */
export function notifyConversationsNeedRefresh(): void {
  refreshListeners.forEach((cb) => cb());
}

function subscribeConversationsRefresh(cb: () => void): () => void {
  refreshListeners.add(cb);
  return () => {
    refreshListeners.delete(cb);
  };
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diffMs = Math.max(0, Date.now() - t);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function rowClass(active: boolean): string {
  const base =
    'relative flex w-full items-center gap-1.5 rounded-sm py-1 text-left text-[13px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]';
  if (active) {
    return `${base} bg-[var(--color-bg-active)] pl-[calc(0.5rem-2px)] pr-2 text-[var(--color-text-primary)] before:absolute before:bottom-0.5 before:left-0 before:top-0.5 before:w-0.5 before:bg-[var(--color-accent)] before:content-['']`;
  }
  return `${base} px-2 text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-sidebar)]`;
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
      <path d="M4.5 2.5h5l2 2V13.5h-7v-11Z" strokeLinejoin="round" />
      <path d="M9.5 2.5V4.5H11.5" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-[var(--color-text-sidebar-dim)] transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 3.5 10.5 8 6 12.5V3.5Z" />
    </svg>
  );
}

export function KbConversationSidebar() {
  const navigate = useAppNavigate();
  const location = useLocation();
  const { id: routeKbId, conversationId: activeConvId } = useParams<{
    id?: string;
    conversationId?: string;
  }>();

  const knowledgeBases = useKnowledgeBaseStore((s) => s.knowledgeBases);
  const setKnowledgeBases = useKnowledgeBaseStore((s) => s.setKnowledgeBases);

  const activeKbId = useMemo(() => {
    const m = location.pathname.match(/^\/kb\/([^/]+)/);
    return m?.[1] ?? routeKbId ?? null;
  }, [location.pathname, routeKbId]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [conversationsByKb, setConversationsByKb] = useState<Record<string, Conversation[]>>({});
  const [loadingByKb, setLoadingByKb] = useState<Record<string, boolean>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    return subscribeConversationsRefresh(() => setRefreshTick((t) => t + 1));
  }, []);

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

  // Current route KB stays expanded
  useEffect(() => {
    if (!activeKbId) return;
    setExpanded((prev) => (prev[activeKbId] ? prev : { ...prev, [activeKbId]: true }));
  }, [activeKbId]);

  const loadConversations = useCallback(async (kbId: string) => {
    setLoadingByKb((prev) => ({ ...prev, [kbId]: true }));
    try {
      const rows = await tauriCommand<Conversation[]>('list_conversations', { kbId });
      setConversationsByKb((prev) => ({ ...prev, [kbId]: rows }));
      return rows;
    } catch {
      setConversationsByKb((prev) => ({ ...prev, [kbId]: [] }));
      return [] as Conversation[];
    } finally {
      setLoadingByKb((prev) => ({ ...prev, [kbId]: false }));
    }
  }, []);

  // Load conversations for expanded KBs
  useEffect(() => {
    const ids = Object.entries(expanded)
      .filter(([, open]) => open)
      .map(([id]) => id);
    for (const kbId of ids) {
      void loadConversations(kbId);
    }
  }, [expanded, refreshTick, loadConversations]);

  // If on /kb/:id/chat with no conversation, jump to most recent once list is ready
  useEffect(() => {
    if (!activeKbId) return;
    const onChatIndex =
      location.pathname === `/kb/${activeKbId}/chat` ||
      location.pathname === `/kb/${activeKbId}/chat/`;
    if (!onChatIndex) return;
    const list = conversationsByKb[activeKbId];
    if (!list || list.length === 0) return;
    const latest = [...list].sort(
      (a, b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at),
    )[0];
    if (latest) navigate(`/kb/${activeKbId}/chat/${latest.id}`, { replace: true });
  }, [activeKbId, conversationsByKb, location.pathname, navigate]);

  const toggleExpand = (kbId: string, e: MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [kbId]: !prev[kbId] }));
  };

  const selectKb = (kbId: string) => {
    setExpanded((prev) => ({ ...prev, [kbId]: true }));
    navigate(`/kb/${kbId}/chat`);
  };

  const createConversation = async (kbId: string) => {
    const st = useSettingsStore.getState().settings;
    const llmModel =
      st.chat_provider === 'siliconflow' ? st.siliconflow_chat_model : st.default_chat_model;
    const conv = await tauriCommand<Conversation>('create_conversation', {
      kbId,
      title: '新对话',
      llmModel,
    });
    setConversationsByKb((prev) => ({
      ...prev,
      [kbId]: [conv, ...(prev[kbId] ?? [])],
    }));
    navigate(`/kb/${kbId}/chat/${conv.id}`);
  };

  const settingsActive = location.pathname.startsWith('/settings');

  return (
    <aside className="flex h-full w-full min-w-0 flex-col overflow-hidden border-r border-[var(--color-border-sidebar)] bg-[var(--color-bg-sidebar)] text-[var(--color-text-sidebar)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-sidebar)] px-3 py-2.5">
        <span className="truncate text-[12px] font-medium tracking-tight text-[var(--color-text-sidebar)]">
          本地知识库
        </span>
        <button
          type="button"
          onClick={() => navigate('/', { state: { openKbCreate: true } })}
          className="rounded-sm px-1.5 py-0.5 text-[11px] text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-sidebar)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
          title="新建知识库"
        >
          + 新建
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 py-2">
        {knowledgeBases.length === 0 ? (
          <div className="px-2 py-3 text-[12px] leading-relaxed text-[var(--color-text-sidebar-dim)]">
            还没有知识库。
            <button
              type="button"
              onClick={() => navigate('/', { state: { openKbCreate: true } })}
              className="mt-2 block w-full rounded-sm bg-[var(--color-bg-active)] px-2 py-1.5 text-left text-[12px] text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-hover)]"
            >
              + 新建知识库
            </button>
          </div>
        ) : (
          knowledgeBases.map((kb) => {
            const open = !!expanded[kb.id];
            const kbActive = activeKbId === kb.id && !activeConvId;
            const convs = conversationsByKb[kb.id] ?? [];
            const loading = !!loadingByKb[kb.id];

            return (
              <div key={kb.id} className="mb-0.5">
                <div className="flex items-stretch gap-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={(e) => toggleExpand(kb.id, e)}
                    className="flex w-5 shrink-0 items-center justify-center rounded-sm text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                    title={open ? '收起' : '展开'}
                  >
                    <Chevron open={open} />
                  </button>
                  <button
                    type="button"
                    onClick={() => selectKb(kb.id)}
                    className={`${rowClass(kbActive)} min-w-0 flex-1`}
                  >
                    <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate font-medium">{kb.name}</span>
                  </button>
                </div>

                {open ? (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[var(--color-border-sidebar)] pl-1.5">
                    {loading && convs.length === 0 ? (
                      <div className="px-2 py-1 text-[11px] text-[var(--color-text-sidebar-dim)]">加载中…</div>
                    ) : null}
                    {convs.map((c) => {
                      const active = activeConvId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => navigate(`/kb/${kb.id}/chat/${c.id}`)}
                          className={`${rowClass(active)} w-full`}
                        >
                          <span className="min-w-0 flex-1 truncate">{c.title}</span>
                          <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-sidebar-dim)]">
                            {formatRelativeTime(c.updated_at || c.created_at)}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => void createConversation(kb.id)}
                      className="w-full rounded-sm px-2 py-1 text-left text-[12px] text-[var(--color-text-sidebar-dim)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-sidebar)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                    >
                      + 新对话
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </nav>

      <div className="border-t border-[var(--color-border-sidebar)] p-1.5">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={`${rowClass(settingsActive)} w-full`}
        >
          <svg className="h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
          </svg>
          <span className="font-medium">设置</span>
        </button>
      </div>
    </aside>
  );
}
