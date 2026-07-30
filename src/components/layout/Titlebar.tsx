import { getCurrentWindow } from '@tauri-apps/api/window';

async function safeWindowOp(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (import.meta.env.DEV && '__TAURI_INTERNALS__' in window) {
      console.warn('[Titlebar] window control failed', e);
    }
  }
}

function WindowControls() {
  const baseBtn =
    'inline-flex h-full w-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-[var(--color-text-secondary)] outline-none transition-colors duration-150 ' +
    'hover:bg-[var(--color-btn-ghost-hover)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]';

  return (
    <div
      data-tauri-no-drag
      className="flex h-full shrink-0 items-stretch overflow-hidden rounded-none"
      role="toolbar"
      aria-label="窗口控制"
    >
      <button
        type="button"
        className={baseBtn}
        aria-label="最小化"
        onClick={() => void safeWindowOp(() => getCurrentWindow().minimize())}
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <path d="M2 9h8" strokeLinecap="square" />
        </svg>
      </button>
      <button
        type="button"
        className={baseBtn}
        aria-label="最大化或还原"
        onClick={() => void safeWindowOp(() => getCurrentWindow().toggleMaximize())}
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <rect x="1" y="1" width="10" height="10" rx="0.8" />
        </svg>
      </button>
      <button
        type="button"
        className={
          baseBtn +
          ' hover:!bg-[#e81123] hover:!text-white focus-visible:!ring-[#e81123] dark:hover:!bg-[#e81123]'
        }
        aria-label="关闭"
        onClick={() => void safeWindowOp(() => getCurrentWindow().close())}
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden strokeLinecap="square">
          <path d="M2 2l8 8M10 2L2 10" />
        </svg>
      </button>
    </div>
  );
}

export function Titlebar() {
  return (
    <div className="relative flex h-[38px] min-h-[38px] items-stretch select-none border-b border-[var(--color-border-sidebar)] bg-[var(--color-bg-sidebar)] transition-colors duration-150">
      {/* One continuous strip (split regions often break dragging on Windows / WebView2) */}
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 cursor-default items-center overflow-hidden pl-3"
        aria-label="拖拽可移动窗口；双击最大化或还原"
        onDoubleClick={(e) => {
          const t = e.target as HTMLElement | null;
          if (t?.closest('[data-tauri-no-drag],button,a,input,textarea,select,[contenteditable=true]'))
            return;
          e.preventDefault();
          void safeWindowOp(() => getCurrentWindow().toggleMaximize());
        }}
      />
      <WindowControls />
    </div>
  );
}
