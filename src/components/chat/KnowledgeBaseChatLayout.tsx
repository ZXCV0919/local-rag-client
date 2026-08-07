import { Outlet, useParams } from 'react-router-dom';
import { RetrievalWorkbench } from './RetrievalWorkbench';
import { notifyConversationsNeedRefresh } from '../layout/KbConversationSidebar';

export function KnowledgeBaseChatLayout() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
        无效的知识库
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <RetrievalWorkbench kbId={id} onConversationsNeedRefresh={notifyConversationsNeedRefresh}>
        <Outlet />
      </RetrievalWorkbench>
    </div>
  );
}

export function ChatSessionPlaceholder() {
  return (
    <div className="flex min-h-[200px] flex-1 items-center justify-center px-6 text-center text-sm text-[var(--color-text-secondary)]">
      <div className="max-w-sm space-y-2">
        <p className="font-medium text-[var(--color-text-primary)]">选择或新建对话</p>
        <p className="leading-relaxed">从左侧选一条历史，或点「新对话」后在下方提问。</p>
      </div>
    </div>
  );
}
