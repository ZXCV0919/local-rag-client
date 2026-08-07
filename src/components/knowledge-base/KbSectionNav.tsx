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
    <nav
      className="flex shrink-0 gap-1 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_78%,transparent)] px-5 pt-2 backdrop-blur-sm"
      aria-label="知识库分区"
    >
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(item.path(kbId))}
            className={
              isActive
                ? 'relative border-b-2 border-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)]'
                : 'border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]'
            }
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
