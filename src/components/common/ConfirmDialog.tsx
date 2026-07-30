import * as Dialog from '@radix-ui/react-dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(100vw-2rem,400px)] -translate-x-1/2 -translate-y-1/2 rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)] text-[var(--color-text-primary)]">
          <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={loading}
                className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={loading}
              onClick={() => void onConfirm()}
              className={`rounded-[length:var(--radius-control)] px-3 py-1.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 ${
                danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[var(--color-on-accent)]'
              }`}
            >
              {loading ? '处理中…' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
