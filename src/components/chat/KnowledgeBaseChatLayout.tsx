import { useCallback, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { ConversationList } from './ConversationList';
import { RetrievalWorkbench } from './RetrievalWorkbench';

export function KnowledgeBaseChatLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useAppNavigate();
  const [convRefreshTick, setConvRefreshTick] = useState(0);
  const bumpConversations = useCallback(() => setConvRefreshTick((t) => t + 1), []);

  if (!id) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
        无效的知识库
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] min-w-0">
      <ConversationList refreshTick={convRefreshTick} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <nav className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4 py-2 text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded px-1"
          >
            知识库
          </button>
          <span aria-hidden className="opacity-40">
            /
          </span>
          <button
            type="button"
            onClick={() => navigate(`/kb/${id}`)}
            className="transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded px-1"
          >
            概览
          </button>
          <span aria-hidden className="opacity-40">
            /
          </span>
          <span className="text-[var(--color-text-primary)]">对话</span>
        </nav>
        <RetrievalWorkbench kbId={id} onConversationsNeedRefresh={bumpConversations}>
          <Outlet />
        </RetrievalWorkbench>
      </div>
    </div>
  );
}

export function ChatSessionPlaceholder() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center px-6 text-center text-sm text-[var(--color-text-secondary)]">
      <div className="max-w-sm space-y-2">
        <p className="font-medium text-[var(--color-text-primary)]">选择或新建对话</p>
        <p className="leading-relaxed">从左侧选一条历史对话，或点「新建对话」；也可用上方检索栏探索资料。</p>
      </div>
    </div>
  );
}
