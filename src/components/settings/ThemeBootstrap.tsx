import { useEffect } from 'react';
import type { ChunkingStrategy } from '../../types/knowledge-base';
import { tauriCommand } from '../../hooks/useDatabase';
import { useSettingsStore } from '../../store/settings';
import { DEFAULT_SETTINGS, type ChatProvider, type RetrievalMode } from '../../types/settings';
import {
  applyColorSchemePreference,
  parseColorSchemeStored,
  subscribePreferredColorScheme,
} from '../../utils/color-scheme';
import { applyAccentVariables, normalizeHex } from '../../utils/accent-theme';

function parseAccentStored(raw: string | undefined): string {
  if (raw == null || raw === '') return DEFAULT_SETTINGS.accent_color;
  try {
    const v = JSON.parse(raw) as string;
    return normalizeHex(typeof v === 'string' ? v : '') ?? DEFAULT_SETTINGS.accent_color;
  } catch {
    return normalizeHex(raw) ?? DEFAULT_SETTINGS.accent_color;
  }
}

function parseAnswerSelfCheckStored(raw: string | undefined): boolean {
  if (raw == null || raw === '') return DEFAULT_SETTINGS.answer_self_check;
  try {
    const v = JSON.parse(raw);
    if (typeof v === 'boolean') return v;
  } catch {
    /* ignore */
  }
  const t = raw.trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  return DEFAULT_SETTINGS.answer_self_check;
}

function parseJsonOrPlainString(raw: string | undefined, fallback: string): string {
  if (raw == null || raw.trim() === '') return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v === 'string' && v.trim()) return v.trim();
  } catch {
    /* ignore */
  }
  const t = raw.trim();
  return t || fallback;
}

function parseRetrievalMode(raw: string | undefined): RetrievalMode {
  const s = parseJsonOrPlainString(raw, DEFAULT_SETTINGS.retrieval_mode).toLowerCase();
  if (s === 'hybrid' || s === 'semantic' || s === 'keyword') return s;
  return DEFAULT_SETTINGS.retrieval_mode;
}

function parseChatProvider(raw: string | undefined): ChatProvider {
  const s = parseJsonOrPlainString(raw, DEFAULT_SETTINGS.chat_provider).toLowerCase();
  if (s === 'ollama' || s === 'siliconflow') return s;
  return DEFAULT_SETTINGS.chat_provider;
}

function parseNumberStored(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  try {
    const j = JSON.parse(raw) as unknown;
    if (typeof j === 'number' && Number.isFinite(j)) return j;
    if (typeof j === 'string') {
      const n = Number.parseFloat(j);
      return Number.isFinite(n) ? n : fallback;
    }
  } catch {
    /* ignore */
  }
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseIntStored(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  try {
    const j = JSON.parse(raw) as unknown;
    if (typeof j === 'number') return Math.trunc(j);
    if (typeof j === 'string') return Math.trunc(Number.parseFloat(j));
  } catch {
    /* ignore */
  }
  return Math.trunc(Number.parseFloat(raw.trim())) || fallback;
}

function parseChunkingStored(raw: string | undefined): ChunkingStrategy {
  const fb = DEFAULT_SETTINGS.default_chunking_strategy;
  if (raw == null || raw.trim() === '') return { ...fb };
  try {
    const v = JSON.parse(raw) as ChunkingStrategy;
    if (typeof v !== 'object' || v == null) return { ...fb };
    return {
      max_chunk_size: clamp(Number(v.max_chunk_size) || fb.max_chunk_size, 200, 2000),
      min_chunk_size: clamp(Number(v.min_chunk_size) || fb.min_chunk_size, 50, 500),
      overlap: clamp(Number(v.overlap) || fb.overlap, 0, 200),
      heading_as_context: typeof v.heading_as_context === 'boolean' ? v.heading_as_context : fb.heading_as_context,
    };
  } catch {
    return { ...fb };
  }
}

/** 启动时恢复配色与主题色；跟随系统时在 OS 主题变化时自动切换 */
export function ThemeBootstrap() {
  const colorScheme = useSettingsStore((s) => s.settings.color_scheme);
  const accentColor = useSettingsStore((s) => s.settings.accent_color);
  const setSettings = useSettingsStore((s) => s.setSettings);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await tauriCommand<Record<string, string>>('get_all_settings');
        if (cancelled) return;
        const scheme = parseColorSchemeStored(all.color_scheme);
        const hex = parseAccentStored(all.accent_color);
        setSettings({
          color_scheme: scheme,
          accent_color: hex,
          answer_self_check: parseAnswerSelfCheckStored(all.answer_self_check),
          ollama_url: parseJsonOrPlainString(all.ollama_url, DEFAULT_SETTINGS.ollama_url),
          default_embedding_model: parseJsonOrPlainString(
            all.default_embedding_model,
            DEFAULT_SETTINGS.default_embedding_model,
          ),
          default_chat_model: parseJsonOrPlainString(all.default_chat_model, DEFAULT_SETTINGS.default_chat_model),
          retrieval_mode: parseRetrievalMode(all.retrieval_mode),
          vector_weight: clamp(parseNumberStored(all.vector_weight, DEFAULT_SETTINGS.vector_weight), 0, 1),
          keyword_weight: clamp(parseNumberStored(all.keyword_weight, DEFAULT_SETTINGS.keyword_weight), 0, 1),
          max_results: clamp(parseIntStored(all.max_results, DEFAULT_SETTINGS.max_results), 1, 50),
          data_directory: parseJsonOrPlainString(all.data_directory, DEFAULT_SETTINGS.data_directory),
          default_chunking_strategy: parseChunkingStored(all.default_chunking_strategy),
          chat_provider: parseChatProvider(all.chat_provider),
          siliconflow_api_key: parseJsonOrPlainString(all.siliconflow_api_key, ''),
          siliconflow_base_url: parseJsonOrPlainString(
            all.siliconflow_base_url,
            DEFAULT_SETTINGS.siliconflow_base_url,
          ),
          siliconflow_chat_model: parseJsonOrPlainString(
            all.siliconflow_chat_model,
            DEFAULT_SETTINGS.siliconflow_chat_model,
          ),
        });
      } catch {
        /* main.tsx 已写入默认值 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSettings]);

  useEffect(() => {
    applyColorSchemePreference(document.documentElement, colorScheme);
    if (colorScheme !== 'system') return;
    return subscribePreferredColorScheme(() => {
      applyColorSchemePreference(document.documentElement, 'system');
    });
  }, [colorScheme]);

  useEffect(() => {
    applyAccentVariables(document.documentElement, accentColor);
  }, [accentColor]);

  return null;
}
