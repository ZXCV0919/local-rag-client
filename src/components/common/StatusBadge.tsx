type StatusType =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'error'
  | 'available'
  | 'downloading'
  | 'connected'
  | 'disconnected';

const STATUS_STYLES: Record<StatusType, string> = {
  pending: 'bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-fg)]',
  processing: 'bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  ready: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  error: 'bg-[var(--badge-error-bg)] text-[var(--badge-error-fg)]',
  available: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  downloading: 'bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]',
  connected: 'bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]',
  disconnected: 'bg-[var(--badge-error-bg)] text-[var(--badge-error-fg)]',
};

const STATUS_LABELS: Record<StatusType, string> = {
  pending: '等待中',
  processing: '处理中',
  ready: '就绪',
  error: '错误',
  available: '可用',
  downloading: '下载中',
  connected: '已连接',
  disconnected: '已断开',
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status]} ${className}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
