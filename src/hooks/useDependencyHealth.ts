import { useCallback, useEffect, useState } from 'react';
import { tauriCommand } from './useDatabase';
import type { OllamaStatusPayload } from './useOllama';
import { DEFAULT_SETTINGS } from '../types/settings';
import { useSettingsStore } from '../store/settings';

export type ChromaDbHealthPayload = {
  responding: boolean;
  status: { url?: string; last_error?: string | null };
};

export type DependencyHealth = {
  ready: boolean;
  ollamaOk: boolean;
  embedModelOk: boolean;
  chromaOk: boolean;
  issues: string[];
  checking: boolean;
  refresh: () => Promise<void>;
};

function parseStoredString(raw: string | null | undefined, fallback: string): string {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw;
  }
}

export function useDependencyHealth(): DependencyHealth {
  const embedFromStore = useSettingsStore((s) => s.settings.default_embedding_model);
  const [ollamaOk, setOllamaOk] = useState(true);
  const [embedModelOk, setEmbedModelOk] = useState(true);
  const [chromaOk, setChromaOk] = useState(true);
  const [issues, setIssues] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    const nextIssues: string[] = [];
    let nextOllama = false;
    let nextEmbed = false;
    let nextChroma = false;

    let embedModel = embedFromStore?.trim() || DEFAULT_SETTINGS.default_embedding_model;
    try {
      const raw = await tauriCommand<string | null>('get_setting', {
        key: 'default_embedding_model',
      });
      embedModel = parseStoredString(raw, embedModel);
    } catch {
      /* keep store / default */
    }

    try {
      const ollama = await tauriCommand<OllamaStatusPayload>('check_ollama_status');
      nextOllama = Boolean(ollama.connected);
      if (!nextOllama) {
        nextIssues.push('本机 Ollama 未连接，嵌入与本地对话不可用。');
      } else {
        const names = (ollama.models ?? []).map((m) => m.name.toLowerCase());
        const want = embedModel.toLowerCase();
        nextEmbed = names.some((n) => n === want || n.startsWith(`${want}:`));
        if (!nextEmbed) {
          nextIssues.push(`未找到嵌入模型 ${embedModel}，请在设置中拉取。`);
        }
      }
    } catch {
      nextOllama = false;
      nextIssues.push('本机 Ollama 未连接，嵌入与本地对话不可用。');
    }

    try {
      const chroma = await tauriCommand<ChromaDbHealthPayload>('chromadb_health');
      nextChroma = Boolean(chroma.responding);
      if (!nextChroma) {
        nextIssues.push('ChromaDB 未响应，向量检索暂不可用。');
      }
    } catch {
      nextChroma = false;
      nextIssues.push('ChromaDB 未响应，向量检索暂不可用。');
    }

    setOllamaOk(nextOllama);
    setEmbedModelOk(nextEmbed);
    setChromaOk(nextChroma);
    setIssues(nextIssues);
    setChecking(false);
  }, [embedFromStore]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const ready = ollamaOk && embedModelOk && chromaOk;

  return {
    ready,
    ollamaOk,
    embedModelOk,
    chromaOk,
    issues,
    checking,
    refresh,
  };
}
