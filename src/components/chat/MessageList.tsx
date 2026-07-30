import { useEffect, useRef } from 'react';
import type { Message } from '../../types/conversation';
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
        <div className="flex min-h-[min(420px,60vh)] flex-col items-center justify-center gap-4 px-4 py-10 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] text-[var(--color-accent)] shadow-[var(--shadow-sm)]"
            aria-hidden
          >
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 9h8M8 13h5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="max-w-sm space-y-1">
            <p className="text-base font-semibold text-[var(--color-text-primary)]">从这里开始对话</p>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              用下方输入框提问，模型会结合检索到的片段作答；也可先用顶部检索栏摸索资料。
            </p>
          </div>
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
