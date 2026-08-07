import { useState, type ReactNode } from 'react';
import { AppearanceSection } from './AppearanceSection';
import { ChunkingSettings } from './ChunkingSettings';
import { DataManager } from './DataManager';
import { OllamaSettings } from './OllamaSettings';
import { RetrievalSettings } from './RetrievalSettings';

type SettingsSectionId = 'appearance' | 'models' | 'chunking' | 'retrieval' | 'data';

const NAV: {
  id: SettingsSectionId;
  label: string;
  blurb: string;
  icon: ReactNode;
}[] = [
  {
    id: 'appearance',
    label: '外观',
    blurb: '主题与强调色',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'models',
    label: '模型与连接',
    blurb: 'Ollama / 云端对话',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M7 20h10M12 16v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'chunking',
    label: '分块参数',
    blurb: '新建知识库默认',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 6h16M4 12h10M4 18h14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'retrieval',
    label: '检索参数',
    blurb: '混合检索与重排',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'data',
    label: '数据管理',
    blurb: '导出与清理',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" strokeLinejoin="round" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 12h8" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSectionId>('appearance');
  const active = NAV.find((n) => n.id === section) ?? NAV[0]!;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] px-6 py-5 backdrop-blur-sm lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
          Preferences
        </p>
        <h1 className="mt-1 text-[length:var(--text-page-title)] font-bold tracking-tight text-[var(--color-text-primary)]">
          设置
        </h1>
        <p className="mt-1 max-w-2xl text-[length:var(--text-body)] text-[var(--color-text-secondary)]">
          配置外观、模型连接、检索行为与本地数据。更改即时写入本机。
        </p>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 gap-0 overflow-hidden lg:gap-8 lg:px-8 lg:py-6">
        <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-secondary)_40%,var(--color-surface))] p-3 lg:rounded-[length:var(--radius-card)] lg:border lg:shadow-[var(--shadow-sm)]">
          <nav className="flex flex-col gap-1" aria-label="设置分区">
            {NAV.map((item) => {
              const isActive = item.id === section;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={
                    isActive
                      ? 'flex items-start gap-3 rounded-[length:var(--radius-control)] bg-[var(--color-surface)] px-3 py-2.5 text-left shadow-[var(--shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--color-accent)_28%,var(--color-border))]'
                      : 'flex items-start gap-3 rounded-[length:var(--radius-control)] px-3 py-2.5 text-left text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-btn-ghost-hover)] hover:text-[var(--color-text-primary)]'
                  }
                >
                  <span
                    className={
                      isActive
                        ? 'mt-0.5 text-[var(--color-accent)]'
                        : 'mt-0.5 text-[var(--color-text-secondary)]'
                    }
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={
                        isActive
                          ? 'block text-sm font-semibold text-[var(--color-text-primary)]'
                          : 'block text-sm font-medium'
                      }
                    >
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-text-secondary)]">
                      {item.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 lg:px-0 lg:py-0">
          <div className="mb-4 lg:hidden">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{active.label}</h2>
            <p className="text-[length:var(--text-meta)] text-[var(--color-text-secondary)]">{active.blurb}</p>
          </div>
          {section === 'appearance' ? <AppearanceSection /> : null}
          {section === 'models' ? <OllamaSettings /> : null}
          {section === 'chunking' ? <ChunkingSettings /> : null}
          {section === 'retrieval' ? <RetrievalSettings /> : null}
          {section === 'data' ? <DataManager /> : null}
        </main>
      </div>
    </div>
  );
}
