import { useAppNavigate } from '../../hooks/useAppNavigate';

const ITEMS = [
  { key: 'overview', label: '概览', path: (id: string) => `/kb/${id}` },
  { key: 'documents', label: '文档', path: (id: string) => `/kb/${id}/documents` },
  { key: 'chat', label: '对话', path: (id: string) => `/kb/${id}/chat` },
] as const;

export function KbSectionNav({
  kbId,
  active,
}: {
  kbId: string;
  active: (typeof ITEMS)[number]['key'];
}) {
  const navigate = useAppNavigate();
  return (
    <nav className="flex gap-1 border-b border-[var(--color-border)] px-4 pt-3" aria-label="知识库分区">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path(kbId))}
            className={
              isActive
                ? 'border-b-2 border-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]'
                : 'border-b-2 border-transparent px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
