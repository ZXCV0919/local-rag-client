import { useCallback } from 'react';
import { tauriCommand } from '../../hooks/useDatabase';
import { useSettingsStore } from '../../store/settings';
import { DEFAULT_SETTINGS, type ColorSchemePreference } from '../../types/settings';
import { ACCENT_PRESETS, applyAccentVariables, normalizeHex } from '../../utils/accent-theme';
import {
  applyColorSchemePreference,
  resolveColorScheme,
} from '../../utils/color-scheme';
import {
  SettingsPanel,
  SettingsRow,
  settingsControlClass,
  settingsSecondaryBtnClass,
} from './SettingsPanel';

const SCHEME_OPTIONS: { value: ColorSchemePreference; label: string; hint: string }[] = [
  { value: 'system', label: '系统', hint: '跟随 OS' },
  { value: 'light', label: '浅色', hint: '纸感工作台' },
  { value: 'dark', label: '深色', hint: '低光环境' },
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
      ? `系统（当前 ${resolveColorScheme('system') === 'dark' ? '深色' : '浅色'}）`
      : SCHEME_OPTIONS.find((o) => o.value === colorScheme)?.label ?? colorScheme;

  return (
    <div className="space-y-5">
      <SettingsPanel
        title="外观"
        description="配色方案控制窗口背景与文字；主题色用于主按钮、引用与强调元素。"
      >
        <SettingsRow label="配色方案" hint={`当前生效：${resolvedLabel}`}>
          <div
            className="inline-flex rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1"
            role="group"
            aria-label="配色方案"
          >
            {SCHEME_OPTIONS.map((o) => {
              const active = colorScheme === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => void commitScheme(o.value)}
                  className={
                    active
                      ? 'min-w-[4.5rem] rounded-[calc(var(--radius-control)-2px)] bg-[var(--color-surface)] px-3 py-2 text-center shadow-[var(--shadow-sm)] ring-1 ring-[color-mix(in_srgb,var(--color-accent)_25%,var(--color-border))]'
                      : 'min-w-[4.5rem] rounded-[calc(var(--radius-control)-2px)] px-3 py-2 text-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }
                >
                  <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{o.label}</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--color-text-secondary)]">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </SettingsRow>

        <SettingsRow label="主题色" hint="用于按钮、链接与引用高亮。系统会按亮度自动选择按钮文字色。">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((p) => {
                const selected = accent.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    type="button"
                    title={p.hex}
                    onClick={() => void commitAccent(p.hex)}
                    className={
                      selected
                        ? 'inline-flex items-center gap-2 rounded-[length:var(--radius-control)] border border-[var(--color-accent)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-meta)] font-medium ring-2 ring-[color-mix(in_srgb,var(--color-accent)_28%,transparent)]'
                        : 'inline-flex items-center gap-2 rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[length:var(--text-meta)] hover:border-[var(--color-text-secondary)]'
                    }
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-[var(--color-border-dark)]"
                      style={{ backgroundColor: p.hex }}
                    />
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                <span className="shrink-0 text-[var(--color-text-secondary)]">自定义</span>
                <input
                  type="color"
                  value={normalizeHex(accent) ?? DEFAULT_SETTINGS.accent_color}
                  onChange={(e) => void commitAccent(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
                  aria-label="选择主题色"
                />
                <code className={`${settingsControlClass} !w-auto font-mono text-xs`}>
                  {normalizeHex(accent) ?? DEFAULT_SETTINGS.accent_color}
                </code>
              </label>
              <button
                type="button"
                onClick={() => void commitAccent(DEFAULT_SETTINGS.accent_color)}
                className={settingsSecondaryBtnClass}
              >
                恢复默认色
              </button>
            </div>

            <div className="rounded-[length:var(--radius-control)] border border-dashed border-[var(--color-border)] bg-[var(--color-muted-bg)] px-4 py-3">
              <p className="text-[length:var(--text-meta)] font-medium text-[var(--color-text-secondary)]">预览</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)]"
                >
                  主按钮
                </button>
                <span className="text-sm font-medium text-[var(--color-accent)]">链接样式</span>
                <span className="rounded-full bg-[var(--color-citation-bg)] px-2.5 py-0.5 text-[length:var(--text-meta)] text-[var(--color-citation-fg)]">
                  引用 pill
                </span>
              </div>
            </div>
          </div>
        </SettingsRow>
      </SettingsPanel>
    </div>
  );
}
