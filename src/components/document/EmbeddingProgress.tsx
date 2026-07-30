import { cancelActiveEmbedding } from '../../services/embedding/batch-queue';
import type { EmbeddingSubProgress } from '../../types/document';

interface EmbeddingProgressProps {
  progress: EmbeddingSubProgress;
}

export function EmbeddingProgress({ progress }: EmbeddingProgressProps) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex justify-between text-xs text-[var(--color-text-secondary)] gap-2">
        <span>
          向量化 {progress.completed}/{progress.total}
        </span>
        {progress.failedChunks > 0 ? (
          <span className="text-amber-600 shrink-0">失败分块 {progress.failedChunks}</span>
        ) : null}
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-muted-bg)] overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        type="button"
        onClick={() => cancelActiveEmbedding()}
        className="text-xs text-[var(--color-danger-text)] hover:underline"
      >
        取消向量化
      </button>
    </div>
  );
}
