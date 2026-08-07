import { useState } from 'react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useDependencyHealth } from '../../hooks/useDependencyHealth';

export function DependencyHealthBanner() {
  const { ready, issues, checking, refresh } = useDependencyHealth();
  const navigate = useAppNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || ready || issues.length === 0) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[color-mix(in_srgb,var(--color-warning)_45%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-surface))] px-4 py-2 text-sm text-[var(--color-text-primary)]"
    >
      <p className="min-w-0 flex-1 leading-relaxed">
        {issues.join(' ')}
        {checking ? <span className="ml-2 text-[var(--color-text-secondary)]">检测中…</span> : null}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          重新检测
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          打开设置
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="关闭提示"
          className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
