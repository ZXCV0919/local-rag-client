import { Separator } from 'react-resizable-panels';

/** Between chat column and search results (drag horizontally). */
export function ColumnSplitterHandle() {
  return (
    <Separator
      id="kb-split-main-results"
      title="拖动调整宽度"
      className="relative mx-0.5 flex w-2 shrink-0 select-none items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
      aria-label="调整对话区与检索结果宽度"
    >
      <span className="splitter-inner pointer-events-none h-[min(100%-16px,720px)] w-px rounded-full bg-[var(--color-border)] transition-colors" />
    </Separator>
  );
}

/** Between message list and composer (drag vertically). */
export function RowSplitterHandle() {
  return (
    <Separator
      id="kb-split-messages-input"
      title="拖动调整高度"
      className="relative my-0.5 flex h-2 shrink-0 select-none items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
      aria-label="调整消息区与输入区高度"
    >
      <span className="splitter-inner pointer-events-none h-px w-[min(100%-24px,920px)] rounded-full bg-[var(--color-border)] transition-colors" />
    </Separator>
  );
}
