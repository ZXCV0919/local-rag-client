import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { KbChatWorkbenchProvider } from '../../context/KbChatWorkbenchContext';
import { tauriCommand } from '../../hooks/useDatabase';
import { retrieve, type RetrievalResult } from '../../services/retrieval';
import type { KnowledgeBase, KnowledgeBaseRow } from '../../types/knowledge-base';
import { knowledgeBaseFromRow } from '../../types/knowledge-base';
import { DEFAULT_SETTINGS, type ChatProvider, type RetrievalMode } from '../../types/settings';
import { ModeSelector } from './ModeSelector';
import { SearchResultsPanel } from './SearchResultsPanel';

function parseStoredString(raw: string | undefined, fallback: string): string {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw;
  }
}

function parseChatProvider(raw: string | undefined): ChatProvider {
  if (raw === 'siliconflow') return 'siliconflow';
  try {
    const parsed = raw ? (JSON.parse(raw) as string) : '';
    if (parsed === 'siliconflow') return 'siliconflow';
  } catch {
    /* plain string */
  }
  return 'ollama';
}

function parseStoredNumber(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === '') return fallback;
  try {
    return Number(JSON.parse(raw));
  } catch {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
}

export function RetrievalWorkbench({
  kbId,
  children,
  onConversationsNeedRefresh,
}: {
  kbId: string;
  children: ReactNode;
  onConversationsNeedRefresh?: () => void;
}) {
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [mode, setMode] = useState<RetrievalMode>(DEFAULT_SETTINGS.retrieval_mode);
  const [vectorWeight, setVectorWeight] = useState(DEFAULT_SETTINGS.vector_weight);
  const [keywordWeight, setKeywordWeight] = useState(DEFAULT_SETTINGS.keyword_weight);
  const [maxResults, setMaxResults] = useState(DEFAULT_SETTINGS.max_results);
  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_SETTINGS.ollama_url);
  const [chatProvider, setChatProvider] = useState<ChatProvider>(DEFAULT_SETTINGS.chat_provider);
  const [siliconflowApiKey, setSiliconflowApiKey] = useState(DEFAULT_SETTINGS.siliconflow_api_key);
  const [siliconflowBaseUrl, setSiliconflowBaseUrl] = useState(DEFAULT_SETTINGS.siliconflow_base_url);
  const [siliconflowChatModel, setSiliconflowChatModel] = useState(
    DEFAULT_SETTINGS.siliconflow_chat_model,
  );
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<RetrievalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await tauriCommand<KnowledgeBaseRow>('get_knowledge_base', { id: kbId });
        if (!cancelled) setKb(knowledgeBaseFromRow(row));
      } catch {
        if (!cancelled) setKb(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  useEffect(() => {
    setSearchAttempted(false);
    setResult(null);
    setError(null);
  }, [kbId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await tauriCommand<Record<string, string>>('get_all_settings');
        if (cancelled) return;
        const rm = parseStoredString(all.retrieval_mode, DEFAULT_SETTINGS.retrieval_mode);
        if (rm === 'hybrid' || rm === 'semantic' || rm === 'keyword') setMode(rm);
        setVectorWeight(parseStoredNumber(all.vector_weight, DEFAULT_SETTINGS.vector_weight));
        setKeywordWeight(parseStoredNumber(all.keyword_weight, DEFAULT_SETTINGS.keyword_weight));
        setMaxResults(
          Math.max(1, Math.min(50, parseStoredNumber(all.max_results, DEFAULT_SETTINGS.max_results))),
        );
        setOllamaUrl(parseStoredString(all.ollama_url, DEFAULT_SETTINGS.ollama_url));
        setChatProvider(parseChatProvider(all.chat_provider));
        setSiliconflowApiKey(parseStoredString(all.siliconflow_api_key, ''));
        setSiliconflowBaseUrl(
          parseStoredString(all.siliconflow_base_url, DEFAULT_SETTINGS.siliconflow_base_url),
        );
        setSiliconflowChatModel(
          parseStoredString(all.siliconflow_chat_model, DEFAULT_SETTINGS.siliconflow_chat_model),
        );
      } catch {
        /* 使用默认 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || !kb) return;
    setSearchAttempted(true);
    setLoading(true);
    setError(null);
    try {
      const r = await retrieve(q, kb.id, kb.embedding_model, ollamaUrl || null, {
        mode,
        maxResults,
        vectorWeight,
        keywordWeight,
      });
      setResult(r);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [kb, mode, maxResults, query, vectorWeight, keywordWeight, ollamaUrl]);

  const modeLabel =
    mode === 'hybrid' ? '智能混合' : mode === 'semantic' ? '语义' : '关键词';

  const bumpConversations = useCallback(() => {
    onConversationsNeedRefresh?.();
  }, [onConversationsNeedRefresh]);

  const workbench = useMemo(
    () => ({
      kb,
      retrievalMode: mode,
      setRetrievalMode: setMode,
      vectorWeight,
      keywordWeight,
      maxResults,
      ollamaUrl,
      chatProvider,
      siliconflowApiKey,
      siliconflowBaseUrl,
      siliconflowChatModel,
      onConversationsNeedRefresh: bumpConversations,
    }),
    [
      kb,
      mode,
      vectorWeight,
      keywordWeight,
      maxResults,
      ollamaUrl,
      chatProvider,
      siliconflowApiKey,
      siliconflowBaseUrl,
      siliconflowChatModel,
      bumpConversations,
    ],
  );

  return (
    <KbChatWorkbenchProvider value={workbench}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-btn-ghost-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {drawerOpen ? '关闭排查' : '排查检索'}
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          {drawerOpen ? (
            <aside className="flex min-h-0 w-[min(360px,38%)] shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border)] p-3">
                <ModeSelector value={mode} onChange={setMode} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch();
                  }}
                  placeholder="排查检索：先看命中片段…"
                  title="检索工作台：先看检索命中，再决定要不要问模型"
                  disabled={!kb}
                  className="w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  disabled={!kb || loading || !query.trim()}
                  title="先看检索命中，再决定要不要问模型"
                  className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
                >
                  {loading ? '检索中…' : '排查检索'}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <SearchResultsPanel
                  className="h-full min-h-0 overflow-hidden"
                  chunks={result?.chunks ?? []}
                  loading={loading}
                  error={error}
                  modeLabel={modeLabel}
                  hasSearched={searchAttempted}
                  totalCandidates={result?.totalCandidates ?? -1}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </KbChatWorkbenchProvider>
  );
}
