import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

import { useKbChatWorkbench } from '../../context/KbChatWorkbenchContext';
import { tauriCommand } from '../../hooks/useDatabase';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import type { ChatProvider, RetrievalMode } from '../../types/settings';
import { SILICONFLOW_CHAT_PRESETS } from '../../utils/siliconflow-presets';

const MAX_ROWS = 5;
const LINE_HEIGHT = 22;

const SUGGESTIONS = [
  '这份文档的核心内容是什么？',
  '有哪些需要注意的事项？',
  '请总结关键步骤',
];

export interface ComposerBarProps {
  disabled?: boolean;
  streaming?: boolean;
  showSuggestions?: boolean;
  /** 外部预填问题（如从分块预览跳转） */
  prefill?: string | null;
  onSend: (text: string, mode: RetrievalMode) => void;
  onStop: () => void;
}

export function ComposerBar({
  disabled,
  streaming,
  showSuggestions = false,
  prefill,
  onSend,
  onStop,
}: ComposerBarProps) {
  const { retrievalMode } = useKbChatWorkbench();
  const chatProvider = useSettingsStore((s) => s.settings.chat_provider);
  const defaultChatModel = useSettingsStore((s) => s.settings.default_chat_model);
  const siliconflowChatModel = useSettingsStore((s) => s.settings.siliconflow_chat_model);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const addToast = useToastStore((s) => s.addToast);

  const [text, setText] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
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

  const modelOptions = useMemo(() => {
    const presets = SILICONFLOW_CHAT_PRESETS.map((p) => ({
      value: p.model,
      label: p.hint ? `${p.label} — ${p.hint}` : p.label,
    }));
    const presetIds = new Set(presets.map((p) => p.value));
    if (siliconflowChatModel && !presetIds.has(siliconflowChatModel)) {
      presets.push({ value: siliconflowChatModel, label: siliconflowChatModel });
    }
    return presets;
  }, [siliconflowChatModel]);

  const persistProvider = useCallback(
    async (next: ChatProvider) => {
      if (next === chatProvider || savingProvider) return;
      setSavingProvider(true);
      try {
        await tauriCommand('set_setting', {
          key: 'chat_provider',
          value: JSON.stringify(next),
        });
        setSettings({ chat_provider: next });
        addToast({
          type: 'success',
          title: next === 'siliconflow' ? '已切换为云端' : '已切换为本地 Ollama',
          duration: 2600,
        });
      } catch (e) {
        addToast({
          type: 'error',
          title: '保存失败',
          message: e instanceof Error ? e.message : String(e),
          duration: 5000,
        });
      } finally {
        setSavingProvider(false);
      }
    },
    [addToast, chatProvider, savingProvider, setSettings],
  );

  const persistCloudModel = useCallback(
    async (model: string) => {
      const trimmed = model.trim();
      if (!trimmed || trimmed === siliconflowChatModel || savingModel) return;
      setSavingModel(true);
      try {
        await tauriCommand('set_setting', {
          key: 'siliconflow_chat_model',
          value: JSON.stringify(trimmed),
        });
        setSettings({ siliconflow_chat_model: trimmed });
        addToast({ type: 'success', title: '对话模型已保存', duration: 2500 });
      } catch (e) {
        addToast({
          type: 'error',
          title: '保存失败',
          message: e instanceof Error ? e.message : String(e),
          duration: 5000,
        });
      } finally {
        setSavingModel(false);
      }
    },
    [addToast, savingModel, setSettings, siliconflowChatModel],
  );

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || streaming) return;
    setText('');
    onSend(trimmed, retrievalMode);
  };

  const controlsDisabled = disabled || streaming || savingProvider || savingModel;

  return (
    <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3">
      <div className="w-full min-w-0">
        {showSuggestions && !streaming ? (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                className="border-0 bg-transparent px-0 py-0.5 text-left text-[length:var(--text-meta)] text-[var(--color-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--color-text-primary)] hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-none">
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
            className="min-h-[40px] max-h-[140px] w-full resize-none border-0 bg-transparent px-0.5 py-1.5 text-[length:var(--text-body)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors duration-150 focus-visible:outline-none disabled:opacity-50"
          />

          <div className="mt-1.5 flex items-center gap-2">
            <ToggleGroup.Root
              type="single"
              value={chatProvider}
              onValueChange={(v) => {
                if (v === 'ollama' || v === 'siliconflow') void persistProvider(v);
              }}
              disabled={controlsDisabled}
              className="inline-flex shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
              aria-label="对话提供方"
            >
              <ToggleGroup.Item
                value="ollama"
                className="rounded-sm px-2.5 py-1 text-[length:var(--text-meta)] text-[var(--color-text-secondary)] outline-none transition-colors data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[disabled]:opacity-50 focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
              >
                本地
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="siliconflow"
                className="rounded-sm px-2.5 py-1 text-[length:var(--text-meta)] text-[var(--color-text-secondary)] outline-none transition-colors data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[disabled]:opacity-50 focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
              >
                云端
              </ToggleGroup.Item>
            </ToggleGroup.Root>

            {chatProvider === 'siliconflow' ? (
              <select
                value={siliconflowChatModel}
                disabled={controlsDisabled}
                onChange={(e) => void persistCloudModel(e.target.value)}
                aria-label="云端对话模型"
                title={siliconflowChatModel}
                className="max-w-[min(14rem,42vw)] truncate rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[length:var(--text-meta)] text-[var(--color-text-primary)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className="max-w-[min(14rem,42vw)] truncate rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-[length:var(--text-meta)] text-[var(--color-text-secondary)]"
                title={defaultChatModel}
              >
                {defaultChatModel}
              </span>
            )}

            <div className="ml-auto shrink-0">
              {streaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-danger-border)] bg-[var(--badge-error-bg)] text-[var(--badge-error-fg)] transition-colors duration-150 hover:bg-[var(--color-danger-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  title="停止生成"
                  aria-label="停止生成"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={disabled || !text.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)] text-[var(--color-on-accent)] transition-colors duration-150 hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:opacity-40"
                  title="发送"
                  aria-label="发送"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path
                      d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
