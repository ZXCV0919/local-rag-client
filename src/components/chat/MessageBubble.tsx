import { memo, useMemo } from 'react';

import ReactMarkdown from 'react-markdown';

import remarkGfm from 'remark-gfm';

import rehypeHighlight from 'rehype-highlight';

import type { ReactNode } from 'react';

import type { Message } from '../../types/conversation';

import { parseCitations } from '../../utils/citations';

import { useSourcesPanelContext } from '../../context/SourcesPanelContext';
import { tauriCommand } from '../../hooks/useDatabase';
import { useToastStore } from '../../store/toast';
import type { ChunkRow } from '../../types/chunk';
import { chunkFromRow } from '../../types/chunk';

import { MessageSourcesBar } from './MessageSourcesBar';



function attachCopyHandler(e: React.MouseEvent<HTMLButtonElement>) {

  const wrap = e.currentTarget.closest('.hljs-copy-host');

  const code =

    wrap?.querySelector('pre code')?.textContent ?? wrap?.querySelector('code')?.textContent ?? '';

  if (code) void navigator.clipboard.writeText(code);

}



function PreWithCopy({ children }: { children?: ReactNode }) {

  return (

    <div className="hljs-copy-host relative group my-2 overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-code-block-bg)]">

      <button

        type="button"

        className="absolute top-2 right-2 z-10 rounded px-2 py-0.5 text-[10px] bg-white/10 text-white/90 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100"

        onClick={attachCopyHandler}

      >

        复制

      </button>

      <pre className="max-h-[min(70vh,420px)] overflow-x-auto p-3 text-xs leading-relaxed [&_.hljs]:bg-transparent">

        {children}

      </pre>

    </div>

  );

}



const MarkdownBlock = memo(function MarkdownBlock({ text }: { text: string }) {

  return (

    <ReactMarkdown

      remarkPlugins={[remarkGfm]}

      rehypePlugins={[rehypeHighlight]}

      components={{

        pre(props) {

          return <PreWithCopy>{props.children}</PreWithCopy>;

        },

        code(props) {

          const { className, children, ...rest } = props;

          const inline = !className?.includes('language-');

          return inline ? (

            <code

              className="rounded-[length:var(--radius-control)] bg-[var(--color-code-bg)] px-1 py-0.5 text-[0.9em]"

              {...rest}

            >

              {children}

            </code>

          ) : (

            <code className={className} {...rest}>

              {children}

            </code>

          );

        },

        a(props) {

          const { href, children: ch, ...rest } = props;

          return (

            <a

              href={href}

              target="_blank"

              rel="noreferrer noopener"

              className="text-[var(--color-accent)] underline"

              {...rest}

            >

              {ch}

            </a>

          );

        },

        img({ alt, ...props }) {

          return (

            <img

              {...props}

              alt={alt ?? ''}

              loading="lazy"

              className="my-2 max-w-full rounded-[length:var(--radius-card)] border border-[var(--color-border)]"

            />

          );

        },

      }}

    >

      {text}

    </ReactMarkdown>

  );

});



function UserAvatar() {
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-user-bubble-bg)] text-xs font-semibold text-[var(--color-text-secondary)]"
    >
      我
    </span>
  );
}



function AssistantAvatar() {

  return (

    <span

      aria-hidden

      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] text-[var(--color-accent)]"

    >

      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">

        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" strokeLinejoin="round" />

        <path d="M5 19h14" strokeLinecap="round" />

      </svg>

    </span>

  );

}



export interface MessageBubbleProps {

  message: Message;

  streamingBody?: string | null;

  isThinking?: boolean;

  thinkingLabel?: string;

  referencedChunkIds?: string[];

  highlightQuery?: string;

}



export function MessageBubble({

  message,

  streamingBody,

  isThinking,

  thinkingLabel = '思考中…',

  referencedChunkIds,

  highlightQuery,

}: MessageBubbleProps) {

  const isUser = message.role === 'user';

  const { revealChunk } = useSourcesPanelContext();
  const addToast = useToastStore((s) => s.addToast);



  const assistantBody =

    streamingBody !== undefined && streamingBody !== null ? streamingBody : message.content;



  const ids =

    referencedChunkIds && referencedChunkIds.length > 0

      ? referencedChunkIds

      : (message.referenced_chunks ?? []);



  const citationParts = useMemo(() => parseCitations(assistantBody), [assistantBody]);

  const citationOnly = useMemo(

    () => citationParts.filter((p): p is Extract<typeof p, { type: 'citation' }> => p.type === 'citation'),

    [citationParts],

  );



  if (isUser) {

    return (

      <div className="message-enter flex justify-end gap-2.5">

        <div className="max-w-[min(100%,720px)] rounded-2xl rounded-br-md border border-[var(--color-border)] bg-[var(--color-user-bubble-bg)] px-4 py-3 text-[length:var(--text-body)] leading-relaxed whitespace-pre-wrap text-[var(--color-user-bubble-fg)]">

          {message.content}

        </div>

        <UserAvatar />

      </div>

    );

  }



  return (

    <div className="message-enter flex flex-col items-start gap-0">

      <div className="flex justify-start gap-2.5">

        <AssistantAvatar />

        <div className="max-w-[min(100%,720px)] rounded-2xl rounded-tl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 text-[length:var(--text-body)] leading-relaxed shadow-[var(--shadow-sm)] chat-markdown">

          {isThinking ? (

            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">

              <span className="inline-flex gap-1">

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />

              </span>

              {thinkingLabel}

            </div>

          ) : (

            <div className="prose prose-sm max-w-none text-[var(--color-text-primary)] [&_.hljs]:text-[13px]">

              {citationParts.map((part, i) => {

                if (part.type === 'text') {

                  return <MarkdownBlock key={i} text={part.text} />;

                }

                const chunkId = ids[part.refIndex - 1];

                const btn = (

                  <button

                    type="button"

                    disabled={!chunkId}

                    onClick={async () => {
                      if (!chunkId) return;
                      try {
                        const row = await tauriCommand<ChunkRow>('get_chunk', { id: chunkId });
                        const chunk = chunkFromRow(row);
                        revealChunk({
                          documentId: chunk.document_id,
                          chunkId: chunk.id,
                        });
                      } catch (e) {
                        addToast({
                          type: 'warning',
                          title: '未找到对应片段',
                          message: e instanceof Error ? e.message : String(e),
                          duration: 3500,
                        });
                      }
                    }}

                    className="mx-0.5 inline-flex items-center gap-0.5 rounded-full border border-[var(--color-citation-border)] bg-[var(--color-citation-bg)] px-2 py-0.5 align-baseline text-[length:var(--text-meta)] font-medium text-[var(--color-citation-fg)] hover:bg-[var(--color-citation-hover-bg)] disabled:opacity-40"

                  >

                    <span aria-hidden>📄</span>

                    {part.fileLabel} · {part.refIndex}

                  </button>

                );

                return <span key={i}>{btn}</span>;

              })}

            </div>

          )}

        </div>

      </div>

      {!isThinking && citationOnly.length > 0 ? (

        <div className="ml-[42px]">

          <MessageSourcesBar parts={citationOnly} chunkIds={ids} highlightQuery={highlightQuery} />

        </div>

      ) : null}

    </div>

  );

}

