import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

function shortModelLabel(model: string, options: { value: string; label: string }[]): string {
  const hit = options.find((o) => o.value === model);
  if (hit) {
    const base = hit.label.split('—')[0]?.trim() || hit.label;
    return base.length > 28 ? `${base.slice(0, 26)}…` : base;
  }
  return model.length > 28 ? `${model.slice(0, 26)}…` : model;
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
    el.style.height = `${Math.min(lines * LINE_HEIGHT + 8, MAX_ROWS * LINE_HEIGHT + 8)}px`;
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
  const canSend = Boolean(text.trim()) && !disabled && !streaming;
  const displayModel =
    chatProvider === 'siliconflow'
      ? shortModelLabel(siliconflowChatModel, modelOptions)
      : shortModelLabel(defaultChatModel, [{ value: defaultChatModel, label: defaultChatModel }]);

  return (
    <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-4 pt-2">
      <div className="w-full min-w-0">
        {showSuggestions && !streaming ? (
          <div className="mb-2.5 flex flex-wrap gap-x-3 gap-y-1 px-1">
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

        {/* Cursor-style pill composer */}
        <div className="flex items-end gap-2 rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            disabled={controlsDisabled}
            onClick={() =>
              void persistProvider(chatProvider === 'siliconflow' ? 'ollama' : 'siliconflow')
            }
            title={
              chatProvider === 'siliconflow'
                ? '当前云端 · 点击切换为本地'
                : '当前本地 · 点击切换为云端'
            }
            aria-label={
              chatProvider === 'siliconflow'
                ? '当前云端，点击切换为本地'
                : '当前本地，点击切换为云端'
            }
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
          >
            {chatProvider === 'siliconflow' ? '云' : '本'}
          </button>

          <div className="flex min-w-0 flex-1 flex-col justify-center px-1">
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
              className="min-h-[28px] max-h-[120px] w-full resize-none border-0 bg-transparent py-1.5 text-[15px] leading-[22px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus-visible:outline-none disabled:opacity-50"
            />
          </div>

          <div className="mb-0.5 flex shrink-0 items-center gap-1">
            {chatProvider === 'siliconflow' ? (
              <label className="relative flex max-w-[11rem] cursor-pointer items-center gap-0.5 rounded-full px-2 py-1.5 text-[13px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]">
                <span className="pointer-events-none truncate">{displayModel}</span>
                <svg className="h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <select
                  value={siliconflowChatModel}
                  disabled={controlsDisabled}
                  onChange={(e) => void persistCloudModel(e.target.value)}
                  aria-label="云端对话模型"
                  title={siliconflowChatModel}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span
                className="max-w-[11rem] truncate rounded-full px-2 py-1.5 text-[13px] text-[var(--color-text-secondary)]"
                title={defaultChatModel}
              >
                {displayModel}
              </span>
            )}

            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c62828] text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                title="停止生成"
                aria-label="停止生成"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="1.5" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:bg-[#e5e5e5] disabled:text-[#a3a3a3] disabled:hover:opacity-100 dark:bg-[#f5f5f5] dark:text-[#1a1a1a] dark:disabled:bg-[#333] dark:disabled:text-[#777]"
                title="发送"
                aria-label="发送"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
