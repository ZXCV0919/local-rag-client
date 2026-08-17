import type { ReactNode } from 'react';

/** Mid-column shell; sources panel is hosted under chat chrome in RetrievalWorkbench. */
export function WorkbenchShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
