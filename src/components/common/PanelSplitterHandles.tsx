import { Separator } from 'react-resizable-panels';

const handleBase =
  'relative flex shrink-0 select-none items-center justify-center outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 ' +
  'data-[separator=active]:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]';

/** Horizontal drag handle between columns. */
export function ColumnSplitterHandle({
  id,
  label = '拖动调整宽度',
}: {
  id: string;
  label?: string;
}) {
  return (
    <Separator
      id={id}
      title={label}
      aria-label={label}
      className={`${handleBase} w-1.5 cursor-col-resize hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]`}
    >
      <span className="pointer-events-none h-full w-px bg-[var(--color-border)]" />
    </Separator>
  );
}

/** Vertical drag handle between rows. */
export function RowSplitterHandle({
  id,
  label = '拖动调整高度',
}: {
  id: string;
  label?: string;
}) {
  return (
    <Separator
      id={id}
      title={label}
      aria-label={label}
      className={`${handleBase} h-1.5 cursor-row-resize hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]`}
    >
      <span className="pointer-events-none h-px w-full bg-[var(--color-border)]" />
    </Separator>
  );
}
