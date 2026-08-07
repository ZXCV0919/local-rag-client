import type { ReactNode } from 'react';
import { BrandMark } from '../brand/BrandMark';

export type EmptyStateProps = {
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  steps?: string[];
  icon?: ReactNode;
};

export function EmptyState({
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  steps,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      {icon ? (
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] text-[var(--color-accent)] shadow-[var(--shadow-sm)]"
          aria-hidden
        >
          {icon}
        </div>
      ) : (
        <BrandMark size={36} className="shadow-[var(--shadow-sm)]" />
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{description}</p>
      </div>
      {steps && steps.length > 0 ? (
        <ol className="max-w-sm space-y-1.5 text-left text-sm text-[var(--color-text-secondary)]">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="font-medium text-[var(--color-accent)]">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onPrimary}
          className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            disabled={secondaryDisabled}
            onClick={onSecondary}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-btn-ghost-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
