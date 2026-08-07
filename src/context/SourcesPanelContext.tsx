import { createContext, useContext, type ReactNode } from 'react';
import { useSourcesPanel } from '../hooks/useSourcesPanel';

type SourcesPanelContextValue = ReturnType<typeof useSourcesPanel>;

const SourcesPanelContext = createContext<SourcesPanelContextValue | null>(null);

export function SourcesPanelProvider({ children }: { children: ReactNode }) {
  const value = useSourcesPanel();
  return (
    <SourcesPanelContext.Provider value={value}>{children}</SourcesPanelContext.Provider>
  );
}

export function useSourcesPanelContext(): SourcesPanelContextValue {
  const value = useContext(SourcesPanelContext);
  if (!value) {
    throw new Error('useSourcesPanelContext requires SourcesPanelProvider');
  }
  return value;
}
