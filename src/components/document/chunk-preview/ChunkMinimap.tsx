import type { Chunk } from '../../../types/chunk';
import { chunkTypeMinimapColor } from '../../../utils/chunk-display';

interface ChunkMinimapProps {
  chunks: Chunk[];
  activeChunkId: string | null;
  onSelect: (chunkId: string) => void;
}

export function ChunkMinimap({ chunks, activeChunkId, onSelect }: ChunkMinimapProps) {
  if (chunks.length === 0) return null;

  const totalTokens = chunks.reduce((sum, c) => sum + Math.max(c.token_count, 1), 0);

  return (
    <div
      className="flex min-h-0 w-full shrink-0 flex-col gap-px self-stretch rounded-full bg-[var(--color-bg-secondary)] p-0.5"
      role="navigation"
      aria-label="分块迷你地图"
    >
      {chunks.map((chunk) => {
        const flex = Math.max(1, Math.round((chunk.token_count / totalTokens) * 100));
        const active = chunk.id === activeChunkId;
        return (
          <button
            key={chunk.id}
            type="button"
            title={`#${chunk.chunk_index + 1} · ~${chunk.token_count} tokens`}
            onClick={() => onSelect(chunk.id)}
            style={{
              flex,
              background: active ? 'var(--color-accent)' : chunkTypeMinimapColor(chunk.chunk_type),
              opacity: active ? 1 : 0.55,
            }}
            className="min-h-[3px] w-full rounded-sm transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
          />
        );
      })}
    </div>
  );
}
