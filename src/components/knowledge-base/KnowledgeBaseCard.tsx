import type { ReactNode } from 'react';
import type { KnowledgeBase } from '../../types/knowledge-base';
import type { KnowledgeBaseCardStats } from '../../hooks/useKnowledgeBaseCardStats';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { FILE_TYPE_BADGE, formatRelativeTime, kbThemeForId } from '../../utils/kb-theme';
import { KbKindIcon } from './KbKindIcon';

interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase;
  stats?: KnowledgeBaseCardStats;
}

function StatCell({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-2 py-1 text-center">
      <div className="text-[var(--color-text-secondary)]">{icon}</div>
      <div className="text-base font-bold tabular-nums text-[var(--color-text-primary)]">{value}</div>
      <div className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">{label}</div>
    </div>
  );
}

export function KnowledgeBaseCard({ knowledgeBase: kb, stats }: KnowledgeBaseCardProps) {
  const navigate = useAppNavigate();
  const fileTypes = stats?.fileTypes ?? [];
  const theme = kbThemeForId(kb.id);

  return (
    <button
      type="button"
      onClick={() => navigate(`/kb/${kb.id}`)}
      className="group flex h-full w-full flex-col overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-left shadow-[var(--shadow-sm)] transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--color-accent)_28%,var(--color-border))] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      <div className="h-1 w-full" style={{ background: theme.strip }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[length:var(--radius-control)]"
            style={{ background: theme.avatarBg, color: theme.avatarFg }}
            aria-hidden
          >
            <KbKindIcon kind={theme.kind} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)]">
              {kb.name}
            </h3>
            <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {kb.description || '暂无描述'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
          <div className="flex divide-x divide-[var(--color-border)] rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_30%,var(--color-surface))] py-2">
            <StatCell
              icon={
                <svg className="mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" />
                  <path d="M14 2v6h6" strokeLinecap="round" />
                </svg>
              }
              value={kb.document_count}
              label="文档"
            />
            <StatCell
              icon={
                <svg className="mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" strokeLinecap="round" />
                </svg>
              }
              value={stats?.conversationCount ?? '—'}
              label="对话"
            />
            <StatCell
              icon={
                <svg className="mx-auto h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
              }
              value={formatRelativeTime(kb.updated_at)}
              label="活跃"
            />
          </div>

          {fileTypes.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">文档类型</span>
              <div className="flex flex-wrap gap-1">
                {fileTypes.map((ft) => {
                  const badge = FILE_TYPE_BADGE[ft] ?? FILE_TYPE_BADGE.txt;
                  return (
                    <span
                      key={ft}
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold leading-none"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
