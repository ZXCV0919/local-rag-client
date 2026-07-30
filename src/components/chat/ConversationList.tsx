import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import { useParams } from 'react-router-dom';

import { useAppNavigate } from '../../hooks/useAppNavigate';

import { tauriCommand } from '../../hooks/useDatabase';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';

import { useSettingsStore } from '../../store/settings';

import type { Conversation } from '../../types/conversation';

import { ConfirmDialog } from '../common/ConfirmDialog';



export function ConversationList({ refreshTick = 0 }: { refreshTick?: number }) {

  const { id: kbId, conversationId: activeConvId } = useParams<{ id: string; conversationId?: string }>();

  const navigate = useAppNavigate();

  const [items, setItems] = useState<Conversation[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');

  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  const [deleting, setDeleting] = useState(false);

  const dq = useDebouncedValue(search, 300);



  const visible = useMemo(() => {

    const q = dq.trim().toLowerCase();

    if (!q) return items;

    return items.filter((c) => c.title.toLowerCase().includes(q));

  }, [items, dq]);



  useEffect(() => {

    if (!kbId) return;

    let cancelled = false;

    (async () => {

      setLoading(true);

      try {

        const rows = await tauriCommand<Conversation[]>('list_conversations', { kbId });

        if (!cancelled) setItems(rows);

      } catch {

        if (!cancelled) setItems([]);

      } finally {

        if (!cancelled) setLoading(false);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [kbId, refreshTick]);



  const createNew = async () => {

    if (!kbId) return;

    const st = useSettingsStore.getState().settings;

    const llmModel =

      st.chat_provider === 'siliconflow' ? st.siliconflow_chat_model : st.default_chat_model;

    const conv = await tauriCommand<Conversation>('create_conversation', {

      kbId,

      title: '新对话',

      llmModel,

    });

    navigate(`/kb/${kbId}/chat/${conv.id}`);

  };



  const confirmDelete = async () => {

    if (!pendingDelete || !kbId) return;

    setDeleting(true);

    try {

      await tauriCommand('delete_conversation', { id: pendingDelete.id });

      if (activeConvId === pendingDelete.id) {

        navigate(`/kb/${kbId}/chat`);

      }

      setItems((prev) => prev.filter((x) => x.id !== pendingDelete.id));

      setPendingDelete(null);

    } finally {

      setDeleting(false);

    }

  };



  const removeOne = (c: Conversation, e: MouseEvent) => {

    e.stopPropagation();

    setPendingDelete(c);

  };



  if (!kbId) return null;



  return (

    <>

      <div className="flex w-full max-w-xs flex-col gap-2 border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_72%,var(--color-bg-primary))] p-3">

        <button

          type="button"

          onClick={() => void createNew()}

          className="w-full rounded-[length:var(--radius-control)] bg-[var(--color-accent)] py-2 text-sm text-[var(--color-on-accent)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-secondary)]"

        >

          新建对话

        </button>

        <div className="px-1 pb-1 pt-2 text-xs font-semibold tracking-tight text-[var(--color-text-secondary)]">

          历史对话

        </div>

        {!loading ? (

          <input

            id="conv-search"

            type="search"

            placeholder="筛选对话…"

            value={search}

            onChange={(e) => setSearch(e.target.value)}

            className="mb-2 w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

            data-hotkey-primary-search

          />

        ) : null}

        {loading ? (

          <span className="px-1 text-xs text-[var(--color-text-secondary)]">加载中…</span>

        ) : items.length === 0 ? (

          <div className="flex flex-col items-center gap-3 rounded-[length:var(--radius-card)] border border-dashed border-[var(--color-border)] px-3 py-8 text-center">

            <div

              className="flex h-12 w-12 items-center justify-center rounded-[length:var(--radius-control)] bg-[color-mix(in_srgb,var(--color-accent)_14%,var(--color-surface))] text-[var(--color-accent)]"

              aria-hidden

            >

              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">

                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />

              </svg>

            </div>

            <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">

              还没有对话，点上方按钮开一条。

            </p>

          </div>

        ) : visible.length === 0 && items.length > 0 ? (

          <p className="px-1 py-4 text-center text-xs leading-relaxed text-[var(--color-text-secondary)]">

            没有匹配的对话。

          </p>

        ) : (

          <ul className="flex-1 space-y-1 overflow-y-auto">

            {visible.map((c) => (

              <li key={c.id}>

                <div

                  className={`flex items-stretch gap-0.5 overflow-hidden rounded-[length:var(--radius-control)] border transition-colors duration-150 ${

                    activeConvId === c.id

                      ? 'border-[color-mix(in_srgb,var(--color-accent)_45%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-surface))] shadow-[var(--shadow-sm)]'

                      : 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)]'

                  }`}

                >

                  <button

                    type="button"

                    onClick={() => navigate(`/kb/${kbId}/chat/${c.id}`)}

                    className={`flex min-w-0 flex-1 items-stretch gap-2 py-2 text-left text-sm transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${

                      activeConvId === c.id

                        ? 'pl-2 pr-2 text-[var(--color-text-primary)]'

                        : 'px-2 text-[var(--color-text-primary)] hover:bg-[var(--color-btn-ghost-hover)]'

                    }`}

                  >

                    {activeConvId === c.id ? (

                      <span

                        aria-hidden

                        className="min-h-0 w-0.5 shrink-0 self-stretch rounded-full bg-[var(--color-accent)]"

                      />

                    ) : null}

                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 truncate">

                      <span className="truncate">{c.title}</span>

                      <span className="truncate text-[10px] text-[var(--color-text-secondary)]">

                        {c.updated_at || c.created_at}

                      </span>

                    </span>

                  </button>

                  <button

                    type="button"

                    title="删除对话"

                    onClick={(e) => removeOne(c, e)}

                    className="shrink-0 rounded-r-[length:var(--radius-control)] px-2 text-xs text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-danger-hover-bg)] hover:text-[var(--color-danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

                  >

                    ×

                  </button>

                </div>

              </li>

            ))}

          </ul>

        )}

      </div>



      <ConfirmDialog

        open={pendingDelete !== null}

        onOpenChange={(open) => {

          if (!open) setPendingDelete(null);

        }}

        title="删除对话"

        description={pendingDelete ? `确定删除「${pendingDelete.title}」？此操作不可撤销。` : undefined}

        confirmLabel="删除"

        danger

        loading={deleting}

        onConfirm={confirmDelete}

      />

    </>

  );

}

