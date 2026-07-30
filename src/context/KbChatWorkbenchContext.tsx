import { createContext, useContext, type ReactNode } from 'react';
import type { KnowledgeBase } from '../types/knowledge-base';
import type { ChatProvider, RetrievalMode } from '../types/settings';

export interface KbChatWorkbenchContextValue {
  kb: KnowledgeBase | null;
  retrievalMode: RetrievalMode;
  setRetrievalMode: (m: RetrievalMode) => void;
  vectorWeight: number;
  keywordWeight: number;
  maxResults: number;
  ollamaUrl: string;
  chatProvider: ChatProvider;
  siliconflowApiKey: string;
  siliconflowBaseUrl: string;
  siliconflowChatModel: string;
  onConversationsNeedRefresh: () => void;
}

const KbChatWorkbenchContext = createContext<KbChatWorkbenchContextValue | null>(null);

export function KbChatWorkbenchProvider({
  value,
  children,
}: {
  value: KbChatWorkbenchContextValue;
  children: ReactNode;
}) {
  return <KbChatWorkbenchContext.Provider value={value}>{children}</KbChatWorkbenchContext.Provider>;
}

export function useKbChatWorkbench(): KbChatWorkbenchContextValue {
  const ctx = useContext(KbChatWorkbenchContext);
  if (!ctx) {
    throw new Error('useKbChatWorkbench must be used inside KbChatWorkbenchProvider');
  }
  return ctx;
}
