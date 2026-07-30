import { useCallback, useEffect, useRef, useState } from 'react';

import type { RetrievalMode } from '../../types/settings';

import { useKbChatWorkbench } from '../../context/KbChatWorkbenchContext';



const MAX_ROWS = 5;

const LINE_HEIGHT = 22;



const SUGGESTIONS = [

  '这份文档的核心内容是什么？',

  '有哪些需要注意的事项？',

  '请总结关键步骤',

];



export interface InputBarProps {

  disabled?: boolean;

  streaming?: boolean;

  showSuggestions?: boolean;

  /** 外部预填问题（如从分块预览跳转） */
  prefill?: string | null;

  onSend: (text: string, mode: RetrievalMode) => void;

  onStop: () => void;

}



export function InputBar({ disabled, streaming, showSuggestions = false, prefill, onSend, onStop }: InputBarProps) {

  const { retrievalMode } = useKbChatWorkbench();

  const [text, setText] = useState('');

  const taRef = useRef<HTMLTextAreaElement>(null);

  const prefillApplied = useRef<string | null>(null);



  useEffect(() => {

    if (prefill && prefill !== prefillApplied.current) {

      prefillApplied.current = prefill;

      setText(prefill);

    }

  }, [prefill]);



  const resize = useCallback(() => {

    const el = taRef.current;

    if (!el) return;

    el.style.height = 'auto';

    const lines = Math.min(MAX_ROWS, Math.max(1, Math.ceil(el.scrollHeight / LINE_HEIGHT)));

    el.style.height = `${Math.min(lines * LINE_HEIGHT + 12, MAX_ROWS * LINE_HEIGHT + 12)}px`;

  }, []);



  useEffect(() => {

    resize();

  }, [text, resize]);



  const submit = () => {

    const trimmed = text.trim();

    if (!trimmed || disabled || streaming) return;

    setText('');

    onSend(trimmed, retrievalMode);

  };



  return (

    <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">

      <div className="w-full min-w-0 md:px-2">

        {showSuggestions && !streaming ? (

          <div className="mb-2 flex flex-wrap gap-2">

            {SUGGESTIONS.map((s) => (

              <button

                key={s}

                type="button"

                onClick={() => setText(s)}

                className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[length:var(--text-meta)] text-[var(--color-text-secondary)] transition-colors hover:border-[color-mix(in_srgb,var(--color-accent)_42%,var(--color-border))] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

              >

                {s}

              </button>

            ))}

          </div>

        ) : null}

        <div className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-sm)]">

          <div className="flex items-end gap-2">

            <textarea

              ref={taRef}

              value={text}

              onChange={(e) => setText(e.target.value)}

              onKeyDown={(e) => {

                const mod = e.ctrlKey || e.metaKey;

                if (e.key === 'Enter' && mod) {

                  e.preventDefault();

                  submit();

                  return;

                }

                if (e.key === 'Enter' && !e.shiftKey) {

                  e.preventDefault();

                  submit();

                }

              }}

              placeholder="输入问题…"

              disabled={disabled || streaming}

              rows={1}

              title="Enter 发送 · Shift+Enter 换行 · Ctrl/Cmd+Enter 发送"

              className="min-h-[40px] max-h-[140px] flex-1 resize-none rounded-[length:var(--radius-control)] border-0 bg-transparent px-1 py-2 text-[length:var(--text-body)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors duration-150 focus-visible:outline-none disabled:opacity-50"

            />

            {streaming ? (

              <button

                type="button"

                onClick={onStop}

                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-danger-border)] bg-[var(--badge-error-bg)] text-[var(--badge-error-fg)] transition-colors duration-150 hover:bg-[var(--color-danger-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

                title="停止生成"

                aria-label="停止生成"

              >

                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>

                  <rect x="6" y="6" width="12" height="12" rx="1" />

                </svg>

              </button>

            ) : (

              <button

                type="button"

                onClick={submit}

                disabled={disabled || !text.trim()}

                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:opacity-40"

                title="发送"

                aria-label="发送"

              >

                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>

                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />

                </svg>

              </button>

            )}

          </div>

        </div>

      </div>

    </div>

  );

}

