import * as ToggleGroup from '@radix-ui/react-toggle-group';
import type { RetrievalMode } from '../../types/settings';

export interface ModeSelectorProps {
  value: RetrievalMode;
  onChange: (mode: RetrievalMode) => void;
  className?: string;
}

const MODES: { value: RetrievalMode; label: string; hint: string }[] = [
  { value: 'hybrid', label: '智能', hint: '向量 + 关键词融合' },
  { value: 'semantic', label: '语义', hint: '仅向量相似度' },
  { value: 'keyword', label: '关键词', hint: '全文检索 (FTS5)' },
];

export function ModeSelector({ value, onChange, className = '' }: ModeSelectorProps) {
  return (
    <div className={className}>
      <ToggleGroup.Root
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v === 'hybrid' || v === 'semantic' || v === 'keyword') onChange(v);
        }}
        className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5 gap-0.5"
        aria-label="检索模式"
      >
        {MODES.map((m) => (
          <ToggleGroup.Item
            key={m.value}
            value={m.value}
            title={m.hint}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--color-text-secondary)] data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[state=on]:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <span className="mr-1" aria-hidden>
              {m.value === 'hybrid' ? '◇' : m.value === 'semantic' ? '◎' : '≡'}
            </span>
            {m.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
