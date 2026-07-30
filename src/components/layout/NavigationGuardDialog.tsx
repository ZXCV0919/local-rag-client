import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { abortChatGeneration } from '../../services/chat-generation';
import { useChatStore } from '../../store/chat';
import { useNavigationGuardStore } from '../../store/navigation-guard';

export function NavigationGuardDialog() {
  const navigate = useNavigate();
  const open = useNavigationGuardStore((s) => s.open);
  const pending = useNavigationGuardStore((s) => s.pending);
  const closeGuard = useNavigationGuardStore((s) => s.close);

  function goBehind() {
    if (!pending) return;
    navigate(pending.to, pending.options ?? {});
    closeGuard();
  }

  function goAndStop() {
    if (!pending) return;
    abortChatGeneration();
    useChatStore.getState().resetStreamingUi();
    navigate(pending.to, pending.options ?? {});
    closeGuard();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) closeGuard();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(100vw-2rem,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)] text-[var(--color-text-primary)]">
          <Dialog.Title className="text-base font-semibold">回答仍在生成</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
            你已请求离开当前界面。你可以选择仍在后台继续生成并在完成后回到会话查看，也可以在离开前先停止生成。
          </Dialog.Description>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                取消，留在当前页
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => goBehind()}
              className="rounded-[length:var(--radius-control)] border border-[var(--color-accent)] px-3 py-1.5 text-sm bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-text-primary)] hover:bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              前往（后台继续生成）
            </button>
            <button
              type="button"
              onClick={() => goAndStop()}
              className="rounded-[length:var(--radius-control)] px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              停止生成并前往
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
