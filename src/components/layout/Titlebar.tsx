import { getCurrentWindow } from '@tauri-apps/api/window';
import { BrandMark } from '../brand/BrandMark';
import { useAppNavigate } from '../../hooks/useAppNavigate';

async function safeWindowOp(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (import.meta.env.DEV && '__TAURI_INTERNALS__' in window) {
      console.warn('[Titlebar] window control failed', e);
    }
  }
}

const titlebarBtn =
  'inline-flex h-full w-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-[var(--color-text-sidebar-dim)] outline-none transition-colors duration-150 ' +
  'hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-sidebar)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]';

function WindowControls() {
  return (
    <div
      data-tauri-no-drag
      className="flex h-full shrink-0 items-stretch overflow-hidden rounded-none"
      role="toolbar"
      aria-label="窗口控制"
    >
      <button
        type="button"
        className={titlebarBtn}
        aria-label="最小化"
        onClick={() => void safeWindowOp(() => getCurrentWindow().minimize())}
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
          <path d="M2 9h8" strokeLinecap="square" />
        </svg>
      </button>
      <button
        type="button"
        className={titlebarBtn}
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
          titlebarBtn +
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
  const navigate = useAppNavigate();

  return (
    <div className="relative flex h-[var(--titlebar-height)] min-h-[var(--titlebar-height)] items-stretch select-none border-b border-[var(--color-border-sidebar)] bg-[var(--color-bg-sidebar)] transition-colors duration-150">
      <div
        data-tauri-drag-region
        className="flex min-w-0 flex-1 cursor-default items-center overflow-hidden pl-2"
        aria-label="拖拽可移动窗口；双击最大化或还原"
        onDoubleClick={(e) => {
          const t = e.target as HTMLElement | null;
          if (t?.closest('[data-tauri-no-drag],button,a,input,textarea,select,[contenteditable=true]'))
            return;
          e.preventDefault();
          void safeWindowOp(() => getCurrentWindow().toggleMaximize());
        }}
      >
        <button
          type="button"
          data-tauri-no-drag
          onClick={() => navigate('/')}
          title="回到首页"
          aria-label="回到首页"
          className="flex items-center gap-2.5 rounded-[length:var(--radius-control)] px-2 py-1 transition-colors hover:bg-[var(--color-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <BrandMark size={22} />
          <div className="flex flex-col leading-none text-left">
            <span className="text-[13px] font-semibold tracking-tight text-[var(--color-text-sidebar)]">
              本地知识库
            </span>
            <span className="mt-0.5 text-[10px] text-[var(--color-text-sidebar-dim)]">Local RAG Workbench</span>
          </div>
        </button>
      </div>
      <WindowControls />
    </div>
  );
}
