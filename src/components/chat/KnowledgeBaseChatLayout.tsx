import { useCallback, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { RetrievalWorkbench } from './RetrievalWorkbench';
import { KbSectionNav } from '../knowledge-base/KbSectionNav';

export function KnowledgeBaseChatLayout() {
  const { id } = useParams<{ id: string }>();
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
    <div className="flex h-full min-h-[320px] min-w-0 flex-col">
      <KbSectionNav kbId={id} active="chat" />
      <div className="flex min-h-0 min-w-0 flex-1">
        <ConversationList refreshTick={convRefreshTick} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <RetrievalWorkbench kbId={id} onConversationsNeedRefresh={bumpConversations}>
            <Outlet />
          </RetrievalWorkbench>
        </div>
      </div>
    </div>
  );
}

export function ChatSessionPlaceholder() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center px-6 text-center text-sm text-[var(--color-text-secondary)]">
      <div className="max-w-sm space-y-2">
        <p className="font-medium text-[var(--color-text-primary)]">选择或新建对话</p>
        <p className="leading-relaxed">
          从左侧选一条历史，或点「新建对话」后在下方提问。需要核对命中时点「排查检索」。
        </p>
      </div>
    </div>
  );
}
