import { useCallback, useEffect, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { tauriCommand } from '../../hooks/useDatabase';
import { siliconflowChatCompleteViaTauri } from '../../services/llm/siliconflow-tauri';
import { useSettingsStore } from '../../store/settings';
import { useToastStore } from '../../store/toast';
import {
  DEFAULT_SETTINGS,
  type ChatProvider,
} from '../../types/settings';
import {
  SILICONFLOW_CHAT_PRESETS,
  SILICONFLOW_DEFAULT_BASE_URL,
} from '../../utils/siliconflow-presets';

const CUSTOM_MODEL_VALUE = '__custom__';

async function writeSetting(key: string, value: string): Promise<void> {
  await tauriCommand('set_setting', { key, value: JSON.stringify(value) });
}

async function writeProvider(key: string, value: ChatProvider): Promise<void> {
  await tauriCommand('set_setting', { key, value: JSON.stringify(value) });
}

export function ChatProviderSettings() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const addToast = useToastStore((s) => s.addToast);

  const [provider, setProvider] = useState<ChatProvider>(settings.chat_provider);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [maskedStored, setMaskedStored] = useState(settings.siliconflow_api_key);
  const [baseUrlDraft, setBaseUrlDraft] = useState(settings.siliconflow_base_url);
  const [modelDraft, setModelDraft] = useState(settings.siliconflow_chat_model);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const presetModels = SILICONFLOW_CHAT_PRESETS.map((p) => p.model);
  const presetSelectValue = presetModels.includes(modelDraft)
    ? modelDraft
    : CUSTOM_MODEL_VALUE;

  useEffect(() => {
    setProvider(settings.chat_provider);
    setMaskedStored(settings.siliconflow_api_key);
    setBaseUrlDraft(settings.siliconflow_base_url);
    setModelDraft(settings.siliconflow_chat_model);
  }, [
    settings.chat_provider,
    settings.siliconflow_api_key,
    settings.siliconflow_base_url,
    settings.siliconflow_chat_model,
  ]);

  const persistProvider = useCallback(
    async (next: ChatProvider) => {
      try {
        await writeProvider('chat_provider', next);
        setProvider(next);
        setSettings({ chat_provider: next });
        addToast({
          type: 'success',
          title: next === 'siliconflow' ? 'ĺˇ˛ĺć˘čłçĄĺşćľĺ¨' : 'ĺˇ˛ĺć˘čłćŹĺ° Ollama',
          duration: 2600,
        });
      } catch (e) {
        addToast({
          type: 'error',
          title: 'äżĺ­ĺ¤ąč´Ľ',
          message: e instanceof Error ? e.message : String(e),
          duration: 5000,
        });
      }
    },
    [addToast, setSettings],
  );

  const persistApiKey = useCallback(async () => {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      addToast({
        type: 'error',
        title: 'čŻˇčžĺĽć°ç API Key',
        message: 'ĺŻéĽäťäżĺ­ĺ¨ćŹĺ°ć°ćŽĺşďźĺçŤŻčŻťĺćśĺŞäźçĺ°ćŠç ă',
        duration: 4000,
      });
      return;
    }
    setSavingKey(true);
    try {
      await writeSetting('siliconflow_api_key', trimmed);
      const all = await tauriCommand<Record<string, string>>('get_all_settings');
      let masked = '';
      try {
        masked = JSON.parse(all.siliconflow_api_key || '""') as string;
      } catch {
        masked = all.siliconflow_api_key || '';
      }
      setMaskedStored(typeof masked === 'string' ? masked : '');
      setSettings({ siliconflow_api_key: typeof masked === 'string' ? masked : '' });
      setApiKeyDraft('');
      addToast({
        type: 'success',
        title: 'API Key ĺˇ˛äżĺ­',
        message: 'ććäťĺ­äşćŹĺ°ďźçé˘ĺŞćžç¤şćŠç ',
        duration: 2800,
      });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'äżĺ­ĺ¤ąč´Ľ',
        message: e instanceof Error ? e.message : String(e),
        duration: 5000,
      });
    } finally {
      setSavingKey(false);
    }
  }, [addToast, apiKeyDraft, setSettings]);

  const persistBaseUrl = useCallback(async () => {
    const trimmed = baseUrlDraft.trim() || SILICONFLOW_DEFAULT_BASE_URL;
    try {
      await writeSetting('siliconflow_base_url', trimmed);
      setBaseUrlDraft(trimmed);
      setSettings({ siliconflow_base_url: trimmed });
      addToast({ type: 'success', title: 'Base URL ĺˇ˛äżĺ­', duration: 2500 });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'äżĺ­ĺ¤ąč´Ľ',
        message: e instanceof Error ? e.message : String(e),
        duration: 5000,
      });
    }
  }, [addToast, baseUrlDraft, setSettings]);

  const persistModel = useCallback(
    async (model: string) => {
      const trimmed = model.trim();
      if (!trimmed) return;
      try {
        await writeSetting('siliconflow_chat_model', trimmed);
        setModelDraft(trimmed);
        setSettings({ siliconflow_chat_model: trimmed });
        addToast({ type: 'success', title: 'äşçŤŻĺŻščŻć¨Ąĺĺˇ˛äżĺ­', duration: 2500 });
      } catch (e) {
        addToast({
          type: 'error',
          title: 'äżĺ­ĺ¤ąč´Ľ',
          message: e instanceof Error ? e.message : String(e),
          duration: 5000,
        });
      }
    },
    [addToast, setSettings],
  );

  const runTest = useCallback(async () => {
    const draft = apiKeyDraft.trim();
    const base = baseUrlDraft.trim() || settings.siliconflow_base_url;
    const model = modelDraft.trim() || settings.siliconflow_chat_model;
    if (!draft && !maskedStored) {
      addToast({
        type: 'error',
        title: 'čŻˇĺĺĄŤĺĺšśäżĺ­ API Key',
        duration: 4000,
      });
      return;
    }
    setTesting(true);
    try {
      await siliconflowChatCompleteViaTauri([{ role: 'user', content: 'ĺĺ¤ OK ä¸¤ä¸Şĺ­ćŻ' }], {
        model,
        baseUrl: base,
        apiKeyOverride: draft || undefined,
        maxTokens: 8,
        temperature: 0,
      });
      addToast({ type: 'success', title: 'çĄĺşćľĺ¨čżćĽć­Łĺ¸¸', duration: 3000 });
    } catch (e) {
      addToast({
        type: 'error',
        title: 'čżćĽĺ¤ąč´Ľ',
        message: e instanceof Error ? e.message : String(e),
        duration: 6000,
      });
    } finally {
      setTesting(false);
    }
  }, [
    addToast,
    apiKeyDraft,
    baseUrlDraft,
    maskedStored,
    modelDraft,
    settings.siliconflow_base_url,
    settings.siliconflow_chat_model,
  ]);

  return (
    <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] space-y-4">
      <div>
        <h2 className="font-semibold text-[var(--color-text-primary)]">ĺŻščŻćäžĺ</h2>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
          ćŁç´˘ä¸ĺéĺĺ§çťä˝żç¨ćŹĺ° Ollamaďźäťăçćĺç­ăä¸ĺŻéčŞćŁĺŻčľ°äşçŤŻăçĄĺşćľĺ¨čŻˇćąçą
          Rust äťŁçďźAPI Key ä¸äźĺşç°ĺ¨ĺçŤŻç˝çťčŻˇćąéă
        </p>
      </div>

      <ToggleGroup.Root
        type="single"
        value={provider}
        onValueChange={(v) => {
          if (v === 'ollama' || v === 'siliconflow') void persistProvider(v);
        }}
        className="inline-flex rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5 gap-0.5"
        aria-label="ĺŻščŻćäžĺ"
      >
        <ToggleGroup.Item
          value="ollama"
          className="px-4 py-2 text-sm font-medium rounded-[length:var(--radius-control)] text-[var(--color-text-secondary)] data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[state=on]:shadow-[var(--shadow-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          ćŹĺ° Ollama
        </ToggleGroup.Item>
        <ToggleGroup.Item
          value="siliconflow"
          className="px-4 py-2 text-sm font-medium rounded-[length:var(--radius-control)] text-[var(--color-text-secondary)] data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[state=on]:shadow-[var(--shadow-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          çĄĺşćľĺ¨
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      {provider === 'siliconflow' ? (
        <div className="space-y-4 pt-2 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 px-3 py-2">
            ćŁç´˘ĺ°çććĄŁçćŽľĺ°ĺéčłçĄĺşćľĺ¨ç¨äşçćĺç­ăććčľćĺşĺťşčŽŽçť§çť­ä˝żç¨ćŹĺ° Ollamaă
          </p>

          <label className="block text-xs">
            <span className="block mb-1 text-[var(--color-text-secondary)]">API Key</span>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder={maskedStored ? 'čžĺĽć° Key äťĽć´ć°âŚ' : 'sk-âŚ'}
              autoComplete="off"
              className="w-full px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {maskedStored ? (
              <span className="mt-1 block font-mono text-[11px] text-[var(--color-text-secondary)]">
                ĺˇ˛äżĺ­ďźćŠç ďźďź{maskedStored}
              </span>
            ) : (
              <span className="mt-1 block text-[11px] text-[var(--color-text-secondary)]">
                ĺ°ćŞéç˝Žăäżĺ­ĺĺçŤŻĺŞč˝čŻťĺ°ćŠç ďźĺŽć´ĺŻéĽçąĺçŤŻäťŁçä˝żç¨ă
              </span>
            )}
          </label>
          <button
            type="button"
            disabled={savingKey}
            onClick={() => void persistApiKey()}
            className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50"
          >
            {savingKey ? 'äżĺ­ä¸­âŚ' : 'äżĺ­ API Key'}
          </button>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              {showAdvanced ? 'ćśčľˇéŤçş§ééĄš' : 'ĺąĺźéŤçş§ééĄšďźBase URLďź'}
            </button>
            {showAdvanced ? (
              <div className="mt-2 flex flex-wrap gap-2 items-end">
                <label className="flex-1 min-w-[12rem] text-xs">
                  <span className="block mb-1 text-[var(--color-text-secondary)]">Base URL</span>
                  <input
                    value={baseUrlDraft}
                    onChange={(e) => setBaseUrlDraft(e.target.value)}
                    placeholder={DEFAULT_SETTINGS.siliconflow_base_url}
                    className="w-full px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void persistBaseUrl()}
                  className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)]"
                >
                  äżĺ­ Base URL
                </button>
              </div>
            ) : null}
          </div>

          <label className="block text-xs">
            <span className="block mb-1 text-[var(--color-text-secondary)]">äşçŤŻĺŻščŻć¨Ąĺ</span>
            <select
              value={presetSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === CUSTOM_MODEL_VALUE) return;
                setModelDraft(v);
                void persistModel(v);
              }}
              className="w-full px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              {SILICONFLOW_CHAT_PRESETS.map((p) => (
                <option key={p.model} value={p.model}>
                  {p.label}
                  {p.hint ? ` â ${p.hint}` : ''}
                </option>
              ))}
              <option value={CUSTOM_MODEL_VALUE}>čŞĺŽäšć¨Ąĺ IDâŚ</option>
            </select>
          </label>

          {presetSelectValue === CUSTOM_MODEL_VALUE ? (
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex-1 min-w-[12rem] text-xs">
                <span className="block mb-1 text-[var(--color-text-secondary)]">čŞĺŽäš model id</span>
                <input
                  value={modelDraft}
                  onChange={(e) => setModelDraft(e.target.value)}
                  placeholder="Qwen/Qwen2.5-72B-Instruct"
                  className="w-full px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] font-mono"
                />
              </label>
              <button
                type="button"
                onClick={() => void persistModel(modelDraft)}
                className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] bg-[var(--color-accent)] text-[var(--color-on-accent)]"
              >
                äżĺ­ć¨Ąĺ
              </button>
            </div>
          ) : (
            <p className="text-[11px] font-mono text-[var(--color-text-secondary)] break-all">
              ĺ˝ĺďź{modelDraft}
            </p>
          )}

          <button
            type="button"
            disabled={testing}
            onClick={() => void runTest()}
            className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50"
          >
            {testing ? 'ćľčŻä¸­âŚ' : 'ćľčŻčżćĽ'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
