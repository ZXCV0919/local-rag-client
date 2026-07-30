import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Chunk, ChunkType } from '../../types/chunk';
import type { Document } from '../../types/document';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { tauriCommand } from '../../hooks/useDatabase';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { loadDocumentSource } from '../../services/document/source-preview';
import type { DocContent } from '../../types/chunk';
import type { Conversation } from '../../types/conversation';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import { ChunkDetailPanel } from './chunk-preview/ChunkDetailPanel';
import { ChunkMinimap } from './chunk-preview/ChunkMinimap';
import { ChunkSourcePanel } from './chunk-preview/ChunkSourcePanel';
import { ChunkTocList } from './chunk-preview/ChunkTocList';

const CHUNK_TYPES: Array<{ id: ChunkType | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'paragraph', label: '段落' },
  { id: 'heading', label: '标题' },
  { id: 'code', label: '代码' },
  { id: 'table', label: '表格' },
  { id: 'mixed', label: '混合' },
];

interface ChunkPreviewProps {
  doc: Document;
  chunks: Chunk[];
  focusChunkId?: string;
}

export function ChunkPreview({ doc, chunks, focusChunkId }: ChunkPreviewProps) {
  const navigate = useAppNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ChunkType | 'all'>('all');
  const [source, setSource] = useState<DocContent | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [asking, setAsking] = useState(false);

  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSourceLoading(true);
      const content = await loadDocumentSource(doc);
      if (!cancelled) {
        setSource(content);
        setSourceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (chunks.length === 0) {
      setActiveChunkId(null);
      return;
    }
    if (focusChunkId && chunks.some((c) => c.id === focusChunkId)) {
      setActiveChunkId(focusChunkId);
      return;
    }
    setActiveChunkId((prev) => (prev && chunks.some((c) => c.id === prev) ? prev : chunks[0]!.id));
  }, [chunks, focusChunkId]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return chunks.filter((c) => {
      if (typeFilter !== 'all' && c.chunk_type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.content.toLowerCase().includes(q) ||
        c.heading_path.toLowerCase().includes(q) ||
        (typeof c.metadata.section_heading === 'string' &&
          c.metadata.section_heading.toLowerCase().includes(q)) ||
        c.chunk_type.toLowerCase().includes(q)
      );
    });
  }, [chunks, debouncedQuery, typeFilter]);

  const activeChunk = useMemo(
    () => chunks.find((c) => c.id === activeChunkId) ?? null,
    [chunks, activeChunkId],
  );

  const selectChunk = useCallback((chunkId: string) => {
    setActiveChunkId(chunkId);
  }, []);

  const askInChat = useCallback(async () => {
    if (!activeChunk) return;
    setAsking(true);
    try {
      const st = useSettingsStore.getState().settings;
      const llmModel =
        st.chat_provider === 'siliconflow' ? st.siliconflow_chat_model : st.default_chat_model;
      const conv = await tauriCommand<Conversation>('create_conversation', {
        kbId: doc.knowledge_base_id,
        title: '新对话',
        llmModel,
      });
      const snippet = activeChunk.content.replace(/\s+/g, ' ').trim().slice(0, 280);
      const prefill = `关于《${doc.title}》中的以下片段，请帮我解释或总结要点：\n\n${snippet}${activeChunk.content.length > 280 ? '…' : ''}`;
      navigate(`/kb/${doc.knowledge_base_id}/chat/${conv.id}`, { state: { prefill } });
    } catch (e) {
      addToast({ type: 'error', title: '无法打开对话', message: e instanceof Error ? e.message : String(e) });
    } finally {
      setAsking(false);
    }
  }, [activeChunk, doc.knowledge_base_id, doc.title, navigate, addToast]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3 justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          共 <span className="font-semibold text-[var(--color-text-primary)]">{chunks.length}</span> 个分块
          {debouncedQuery.trim() || typeFilter !== 'all' ? (
            <>
              ，显示{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">{filtered.length}</span> 个
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {CHUNK_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  typeFilter === t.id
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-btn-ghost-hover)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="搜索分块内容或标题路径…"
            value={query}
            data-hotkey-primary-search
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64 rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[240px_minmax(0,1.2fr)_minmax(0,0.8fr)_12px] overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)]">
          <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            分块目录
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <ChunkTocList
              chunks={filtered}
              activeChunkId={activeChunkId}
              onSelect={selectChunk}
            />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[var(--color-border)]">
          <ChunkSourcePanel
            source={source}
            sourceLoading={sourceLoading}
            activeChunk={activeChunk}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <ChunkDetailPanel
            chunk={activeChunk}
            searchQuery={debouncedQuery}
            asking={asking}
            onAskInChat={askInChat}
          />
        </div>

        <ChunkMinimap
          chunks={filtered}
          activeChunkId={activeChunkId}
          onSelect={selectChunk}
        />
      </div>
    </div>
  );
}
