import type { ChatProvider, RetrievalMode } from '../../types/settings';

const MODE_LABELS: Record<RetrievalMode, string> = {
  hybrid: '智能混合',
  semantic: '语义',
  keyword: '关键词',
};

const PROVIDER_BADGE: Record<ChatProvider, { label: string; className: string }> = {
  ollama: {
    label: '本地',
    className:
      'border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-surface))] text-[var(--color-accent)]',
  },
  siliconflow: {
    label: '云端',
    className:
      'border-[color-mix(in_srgb,#38bdf8_40%,var(--color-border))] bg-[color-mix(in_srgb,#38bdf8_12%,var(--color-surface))] text-[color-mix(in_srgb,#38bdf8_85%,var(--color-text-primary))]',
  },
};

export interface ChatHeaderProps {
  kbName: string;
  model: string;
  retrievalMode: RetrievalMode;
  chatProvider?: ChatProvider;
}

export function ChatHeader({ kbName, model, retrievalMode, chatProvider = 'ollama' }: ChatHeaderProps) {
  const badge = PROVIDER_BADGE[chatProvider];

  return (
    <header className="flex shrink-0 flex-col gap-1.5 pb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="truncate text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">
          {kbName}
        </h2>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-2.5 py-0.5 text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">
          {MODE_LABELS[retrievalMode]}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[length:var(--text-meta)] font-medium ${badge.className}`}
          title={chatProvider === 'siliconflow' ? '对话走硅基流动云端' : '对话走本地 Ollama'}
        >
          {badge.label}
        </span>
        <span className="truncate text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">{model}</span>
      </div>
      <p className="text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
        在下方提问；需要核对命中时点右上角「排查检索」。
      </p>
    </header>
  );
}
