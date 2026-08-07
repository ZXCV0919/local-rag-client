import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSourcesPanelContext } from '../../context/SourcesPanelContext';
import { SourcesPanel } from '../sources/SourcesPanel';

export function WorkbenchShell({ children }: { children: ReactNode }) {
  const { open } = useSourcesPanelContext();
  const loc = useLocation();
  const hideSources = loc.pathname.startsWith('/settings') || loc.pathname === '/';

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      {open && !hideSources ? (
        <aside className="flex w-[min(420px,42%)] shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)]">
          <SourcesPanel />
        </aside>
      ) : null}
    </div>
  );
}
