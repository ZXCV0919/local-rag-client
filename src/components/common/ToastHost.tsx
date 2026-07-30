import { useEffect } from 'react';
import { useToastStore } from '../../store/toast';

const tone: Record<
  string,
  { bg: string; fg: string; ring: string }
> = {
  success: {
    bg: 'bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))]',
    fg: 'text-[var(--color-text-primary)]',
    ring: 'ring-[color-mix(in_srgb,var(--color-accent)_35%,transparent)]',
  },
  info: {
    bg: 'bg-[var(--color-surface)]',
    fg: 'text-[var(--color-text-primary)]',
    ring: 'ring-[var(--color-border)]',
  },
  warning: {
    bg: 'bg-[var(--badge-warning-bg)]',
    fg: 'text-[var(--badge-warning-fg)]',
    ring: 'ring-[color-mix(in_srgb,var(--badge-warning-fg)_25%,transparent)]',
  },
  error: {
    bg: 'bg-[var(--badge-error-bg)]',
    fg: 'text-[var(--badge-error-fg)]',
    ring: 'ring-[color-mix(in_srgb,var(--badge-error-fg)_25%,transparent)]',
  },
};

function ToastAutoDismiss({ id, duration }: { id: string; duration: number }) {
  const remove = useToastStore((s) => s.removeToast);
  useEffect(() => {
    const t = window.setTimeout(() => remove(id), duration);
    return () => window.clearTimeout(t);
  }, [id, duration, remove]);
  return null;
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.removeToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const pal = tone[t.type] ?? tone.info;
        const ms = t.duration ?? 3200;
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto animate-in fade-in slide-in-from-bottom-2 rounded-[length:var(--radius-card)] border border-[var(--color-border)] px-4 py-3 shadow-[var(--shadow-float)] ring-2 ring-inset ${pal.bg} ${pal.fg} ${pal.ring}`}
          >
            <ToastAutoDismiss id={t.id} duration={ms} />
            <div className="flex justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{t.title}</p>
                {t.message ? <p className="mt-1 text-xs opacity-90 whitespace-pre-wrap">{t.message}</p> : null}
              </div>
              <button
                type="button"
                aria-label="关闭提示"
                className="shrink-0 text-xs opacity-70 hover:opacity-100 rounded px-1 py-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                onClick={() => remove(t.id)}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
