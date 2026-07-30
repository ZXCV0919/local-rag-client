import { useCallback } from 'react';
import { tauriCommand } from '../../hooks/useDatabase';
import { useSettingsStore } from '../../store/settings';
import { DEFAULT_SETTINGS, type ColorSchemePreference } from '../../types/settings';
import { ACCENT_PRESETS, applyAccentVariables, normalizeHex } from '../../utils/accent-theme';
import {
  applyColorSchemePreference,
  resolveColorScheme,
} from '../../utils/color-scheme';

const SCHEME_OPTIONS: { value: ColorSchemePreference; label: string }[] = [
  { value: 'system', label: '系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

export function AppearanceSection() {
  const accent = useSettingsStore((s) => s.settings.accent_color);
  const colorScheme = useSettingsStore((s) => s.settings.color_scheme);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const commitScheme = useCallback(
    async (next: ColorSchemePreference) => {
      applyColorSchemePreference(document.documentElement, next);
      setSettings({ color_scheme: next });
      await tauriCommand('set_setting', { key: 'color_scheme', value: JSON.stringify(next) });
    },
    [setSettings],
  );

  const commitAccent = useCallback(
    async (hexInput: string) => {
      const hex = normalizeHex(hexInput) ?? DEFAULT_SETTINGS.accent_color;
      applyAccentVariables(document.documentElement, hex);
      setSettings({ accent_color: hex });
      await tauriCommand('set_setting', { key: 'accent_color', value: JSON.stringify(hex) });
    },
    [setSettings],
  );

  const resolvedLabel =
    colorScheme === 'system'
      ? `系统 (${resolveColorScheme('system') === 'dark' ? '深色' : '浅色'})`
      : SCHEME_OPTIONS.find((o) => o.value === colorScheme)?.label ?? colorScheme;

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">外观</h2>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
          配色方案控制窗口背景与文字颜色；主题色用于按钮与强调。切换明暗时会整套更新语义色，避免出现背景变了字还跟不上的情况。
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">配色方案</div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            选择应用跟随系统、浅色或深色界面。当前生效：
            <span className="text-[var(--color-text-primary)] font-medium ml-1">{resolvedLabel}</span>
          </p>
        </div>
        <label className="shrink-0 sm:w-52">
          <span className="sr-only">配色方案</span>
          <select
            value={colorScheme}
            onChange={(e) => void commitScheme(e.target.value as ColorSchemePreference)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            {SCHEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-t border-[var(--color-border)] pt-8 space-y-4">
        <div>
          <div className="text-sm font-medium text-[var(--color-text-primary)]">主题色</div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            自定义强调色与主按钮颜色。系统会根据亮度自动选择按钮上的文字颜色（含 hover），尽量避免看不清字。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.hex}
              onClick={() => void commitAccent(p.hex)}
              className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                accent.toLowerCase() === p.hex.toLowerCase()
                  ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-secondary)]'
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full mr-1.5 align-middle border border-[var(--color-border-dark)]"
                style={{ backgroundColor: p.hex }}
              />
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <span className="text-[var(--color-text-secondary)] shrink-0">自定义</span>
            <input
              type="color"
              value={normalizeHex(accent) ?? DEFAULT_SETTINGS.accent_color}
              onChange={(e) => void commitAccent(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
              aria-label="选择主题色"
            />
            <code className="text-xs text-[var(--color-text-secondary)] font-mono">
              {normalizeHex(accent) ?? DEFAULT_SETTINGS.accent_color}
            </code>
          </label>
          <button
            type="button"
            onClick={() => void commitAccent(DEFAULT_SETTINGS.accent_color)}
            className="text-sm px-3 py-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)] text-[var(--color-text-primary)]"
          >
            恢复默认色
          </button>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)] space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-primary)]">预览</p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)]"
            >
              主按钮
            </button>
            <span className="text-sm text-[var(--color-accent)] underline cursor-default">链接样式</span>
          </div>
        </div>
      </div>
    </section>
  );
}
