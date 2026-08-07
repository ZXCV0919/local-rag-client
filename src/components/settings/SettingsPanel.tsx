import type { ReactNode } from 'react';

export function SettingsPanel({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="space-y-6 px-5 py-5">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-start sm:gap-8">
      <div className="min-w-0 pt-0.5">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{label}</div>
        {hint ? (
          <p className="mt-1 text-[length:var(--text-meta)] leading-relaxed text-[var(--color-text-secondary)]">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const settingsControlClass =
  'w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';

export const settingsSecondaryBtnClass =
  'rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';

export const settingsPrimaryBtnClass =
  'rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';
