import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import type { Message } from '../../types/conversation';
import { EmptyState } from '../common/EmptyState';
import { MessageBubble } from './MessageBubble';

export interface MessageListProps {
  conversationId: string;
  messages: Message[];
  /** Retrieval before meta */
  retrieving: boolean;
  /** Waiting for first token from LLM */
  pendingLlm: boolean;
  streamingBody: string | null;
  streamingReferencedChunkIds: string[];
  highlightQuery?: string;
}

export function MessageList({
  conversationId,
  messages,
  retrieving,
  pendingLlm,
  streamingBody,
  streamingReferencedChunkIds,
  highlightQuery,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { id: kbId } = useParams<{ id: string }>();
  const navigate = useAppNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingBody, retrieving, pendingLlm]);

  const showDraft = retrieving || pendingLlm || streamingBody !== null;
  const showEmpty = messages.length === 0 && !showDraft;

  const draftMessage: Message = {
    id: '__assistant_draft',
    conversation_id: conversationId,
    role: 'assistant',
    content: streamingBody ?? '',
    referenced_chunks: streamingReferencedChunkIds,
    token_count: 0,
    created_at: '',
  };

  const thinkingLabel = retrieving ? '正在检索知识库…' : pendingLlm ? '正在生成回答…' : '思考中…';

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-2">
      {showEmpty ? (
        <div className="flex min-h-[min(420px,60vh)] items-center justify-center">
          <EmptyState
            title="问一句试试"
            description="基于本库文档检索后回答。需要核对命中时，点「排查检索」。"
            primaryLabel="开始提问"
            onPrimary={() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus()}
            secondaryLabel={kbId ? '去导入文档' : undefined}
            onSecondary={kbId ? () => navigate(`/kb/${kbId}/documents`) : undefined}
            steps={['导入文档并等待「就绪」', '在下方输入问题', '查看回答中的引用溯源']}
            icon={
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M8 9h8M8 13h5" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
      ) : null}
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} highlightQuery={highlightQuery} />
      ))}
      {showDraft ? (
        <MessageBubble
          message={draftMessage}
          streamingBody={streamingBody ?? ''}
          isThinking={retrieving || (pendingLlm && (streamingBody ?? '') === '')}
          thinkingLabel={thinkingLabel}
          referencedChunkIds={streamingReferencedChunkIds}
          highlightQuery={highlightQuery}
        />
      ) : null}
      <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
}
