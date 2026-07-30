import { StatusBadge } from '../common/StatusBadge';
import { EmbeddingProgress } from './EmbeddingProgress';
import type { Document, ImportProgress } from '../../types/document';

function fileIconStyle(fileType: string): { label: string; bg: string; fg: string } {
  switch (fileType) {
    case 'pdf':
      return { label: 'PDF', bg: 'color-mix(in srgb, #ef4444 18%, var(--color-surface))', fg: '#dc2626' };
    case 'md':
      return { label: 'MD', bg: 'color-mix(in srgb, #2563eb 18%, var(--color-surface))', fg: '#2563eb' };
    case 'docx':
      return { label: 'DOC', bg: 'color-mix(in srgb, #7c3aed 18%, var(--color-surface))', fg: '#7c3aed' };
    default:
      return { label: 'TXT', bg: 'color-mix(in srgb, var(--color-text-secondary) 15%, var(--color-surface))', fg: 'var(--color-text-secondary)' };
  }
}

function stepLabel(step: string): string {
  const m: Record<string, string> = {
    parsing: '解析中…',
    chunking: '分块中…',
    saving_chunks: '写入分块…',
    embedding: '向量化中…',
    complete: '处理完成',
    error: '处理失败',
    creating_record: '创建记录…',
  };
  return m[step] ?? step;
}

interface DocumentCardProps {
  doc: Document;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onViewChunks?: (id: string) => void;
  importProgress?: ImportProgress;
}

export function DocumentCard({
  doc,
  onDelete,
  onRetry,
  onViewChunks,
  importProgress,
}: DocumentCardProps) {
  const live =
    importProgress &&
    importProgress.document_id === doc.id &&
    importProgress.current_step !== 'complete' &&
    importProgress.status !== 'error';

  const showStepText = live && importProgress.current_step !== 'embedding';
  const showEmbedding = live && importProgress.embedding;
  const iconStyle = fileIconStyle(doc.file_type);

  const steps = ['parsing', 'chunking', 'saving_chunks', 'embedding'] as const;
  const currentStepIdx = live && importProgress ? steps.indexOf(importProgress.current_step as (typeof steps)[number]) : -1;

  return (
    <div className="flex flex-col gap-3 rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[length:var(--radius-control)] text-xs font-bold"
            style={{ background: iconStyle.bg, color: iconStyle.fg }}
          >
            {iconStyle.label}
          </span>
          <div className="min-w-0">
            <div className="font-medium truncate">{doc.title}</div>
            <div className="text-xs text-[var(--color-text-secondary)] truncate">{doc.file_name}</div>
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <div className="text-xs text-[var(--color-text-secondary)] flex gap-4">
        <span>分块 {doc.chunk_count}</span>
        <span className="truncate">{doc.file_type.toUpperCase()}</span>
      </div>

      {showStepText ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-accent)]">{stepLabel(importProgress.current_step)}</p>
          <div className="flex gap-1">
            {['解析', '分块', '写入', '向量'].map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-1 w-full rounded-full ${
                    i <= currentStepIdx ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-muted-bg)]'
                  }`}
                />
                <span className="text-[9px] text-[var(--color-text-secondary)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showEmbedding && importProgress.embedding ? (
        <EmbeddingProgress progress={importProgress.embedding} />
      ) : null}

      {doc.status === 'processing' && !showEmbedding ? (
        <div className="h-1.5 rounded-full bg-[var(--color-muted-bg)] overflow-hidden">
          <div className="h-full w-1/3 bg-[var(--color-accent)] animate-pulse rounded-full" />
        </div>
      ) : null}

      {doc.status === 'error' && doc.error_message ? (
        <p className="text-xs text-[var(--color-danger-text)] line-clamp-2">{doc.error_message}</p>
      ) : null}

      {doc.status === 'ready' && doc.error_message ? (
        <p className="text-xs text-amber-700 line-clamp-2">{doc.error_message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {onViewChunks ? (
          <button
            type="button"
            onClick={() => onViewChunks(doc.id)}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-accent)] px-3 py-1.5 text-xs text-[var(--color-accent)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            分块预览
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onRetry(doc.id)}
          disabled={doc.status === 'processing'}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-btn-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
        >
          重新处理
        </button>
        <button
          type="button"
          onClick={() => onDelete(doc.id)}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-danger-border)] px-3 py-1.5 text-xs text-[var(--color-danger-text)] transition-colors duration-150 hover:bg-[var(--color-danger-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          删除
        </button>
      </div>
    </div>
  );
}
