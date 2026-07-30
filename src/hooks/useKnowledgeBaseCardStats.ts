import { useEffect, useState } from 'react';
import { tauriCommand } from '../hooks/useDatabase';
import type { Conversation } from '../types/conversation';
import type { Document } from '../types/document';
import type { FileType } from '../types/document';

export interface KnowledgeBaseCardStats {
  conversationCount: number;
  fileTypes: FileType[];
}

export function useKnowledgeBaseCardStats(kbIds: string[]) {
  const [stats, setStats] = useState<Record<string, KnowledgeBaseCardStats>>({});
  const key = kbIds.join(',');

  useEffect(() => {
    if (kbIds.length === 0) {
      setStats({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        kbIds.map(async (kbId) => {
          try {
            const [conversations, documents] = await Promise.all([
              tauriCommand<Conversation[]>('list_conversations', { kbId }),
              tauriCommand<Document[]>('list_documents', { kbId }),
            ]);
            const fileTypes = [...new Set(documents.map((d) => d.file_type))];
            return [
              kbId,
              { conversationCount: conversations.length, fileTypes },
            ] as const;
          } catch {
            return [kbId, { conversationCount: 0, fileTypes: [] as FileType[] }] as const;
          }
        }),
      );
      if (!cancelled) setStats(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [key, kbIds]);

  return stats;
}
