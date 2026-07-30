import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels';
import { KbChatWorkbenchProvider } from '../../context/KbChatWorkbenchContext';
import { ColumnSplitterHandle } from '../common/PanelSplitterHandles';
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

  const retrievalLayout = useDefaultLayout({
    id: 'kb-retrieval-split',
    storage: localStorage,
    panelIds: ['main', 'results'],
  });

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
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        <div className="flex flex-wrap items-center gap-3 shrink-0 px-4 pt-3">
          <ModeSelector value={mode} onChange={setMode} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch();
            }}
            placeholder="输入检索问题…"
            disabled={!kb}
            className="min-w-[160px] max-w-xl flex-1 rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={!kb || loading || !query.trim()}
            className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
          >
            {loading ? '检索中…' : '检索'}
          </button>
        </div>

        <Group
          id="kb-retrieval-split"
          orientation="horizontal"
          className="flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2"
          defaultLayout={retrievalLayout.defaultLayout}
          onLayoutChanged={retrievalLayout.onLayoutChanged}
        >
          <Panel id="main" defaultSize="74%" minSize="42%" className="min-w-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
          </Panel>
          <ColumnSplitterHandle />
          <Panel id="results" defaultSize="26%" minSize="16%" maxSize="42%" className="min-w-0">
            <SearchResultsPanel
              className="h-full min-h-0"
              chunks={result?.chunks ?? []}
              loading={loading}
              error={error}
              modeLabel={modeLabel}
              hasSearched={searchAttempted}
              totalCandidates={result?.totalCandidates ?? -1}
            />
          </Panel>
        </Group>
      </div>
    </KbChatWorkbenchProvider>
  );
}
