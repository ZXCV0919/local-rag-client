import { DEFAULT_SETTINGS, type ColorSchemePreference } from '../types/settings';

export type { ColorSchemePreference };

export function resolveColorScheme(pref: ColorSchemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

/** 将解析后的明暗应用到 DOM（供样式变量使用） */
export function applyResolvedTheme(el: HTMLElement, resolved: 'light' | 'dark'): void {
  el.dataset.theme = resolved;
}

export function applyColorSchemePreference(el: HTMLElement, pref: ColorSchemePreference): void {
  applyResolvedTheme(el, resolveColorScheme(pref));
}

export function subscribePreferredColorScheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function parseColorSchemeStored(raw: string | undefined): ColorSchemePreference {
  if (raw == null || raw === '') return DEFAULT_SETTINGS.color_scheme;
  try {
    const v = JSON.parse(raw) as string;
    if (v === 'system' || v === 'light' || v === 'dark') return v;
  } catch {
    if (raw === 'system' || raw === 'light' || raw === 'dark') return raw as ColorSchemePreference;
  }
  return DEFAULT_SETTINGS.color_scheme;
}
