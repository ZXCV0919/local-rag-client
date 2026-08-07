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
          title: next === 'siliconflow' ? '已切换为硅基流动' : '已切换为本地 Ollama',
          duration: 2600,
        });
      } catch (e) {
        addToast({
          type: 'error',
          title: '保存失败',
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
        title: '请输入新的 API Key',
        message: '密钥仅保存在本地数据库，前端读取时只会看到掩码。',
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
        title: 'API Key 已保存',
        message: '明文仅存于本地，界面只显示掩码',
        duration: 2800,
      });
    } catch (e) {
      addToast({
        type: 'error',
        title: '保存失败',
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
      addToast({ type: 'success', title: 'Base URL 已保存', duration: 2500 });
    } catch (e) {
      addToast({
        type: 'error',
        title: '保存失败',
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
        addToast({ type: 'success', title: '云端对话模型已保存', duration: 2500 });
      } catch (e) {
        addToast({
          type: 'error',
          title: '保存失败',
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
        title: '请先填写并保存 API Key',
        duration: 4000,
      });
      return;
    }
    setTesting(true);
    try {
      await siliconflowChatCompleteViaTauri([{ role: 'user', content: '回复 OK 两个字母' }], {
        model,
        baseUrl: base,
        apiKeyOverride: draft || undefined,
        maxTokens: 8,
        temperature: 0,
      });
      addToast({ type: 'success', title: '硅基流动连接正常', duration: 3000 });
    } catch (e) {
      addToast({
        type: 'error',
        title: '连接失败',
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
        <h2 className="font-semibold text-[var(--color-text-primary)]">对话提供商</h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          检索与向量化始终使用本地 Ollama；仅「生成回答」与可选自检可走云端。硅基流动请求由
          Rust 代理，API Key 不会出现在前端网络请求里。
        </p>
      </div>

      <ToggleGroup.Root
        type="single"
        value={provider}
        onValueChange={(v) => {
          if (v === 'ollama' || v === 'siliconflow') void persistProvider(v);
        }}
        className="inline-flex gap-0.5 rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
        aria-label="对话提供商"
      >
        <ToggleGroup.Item
          value="ollama"
          className="rounded-[length:var(--radius-control)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] outline-none data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[state=on]:shadow-[var(--shadow-sm)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          本地 Ollama
        </ToggleGroup.Item>
        <ToggleGroup.Item
          value="siliconflow"
          className="rounded-[length:var(--radius-control)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] outline-none data-[state=on]:bg-[var(--color-surface)] data-[state=on]:text-[var(--color-text-primary)] data-[state=on]:shadow-[var(--shadow-sm)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          硅基流动
        </ToggleGroup.Item>
      </ToggleGroup.Root>

      {provider === 'siliconflow' ? (
        <div className="space-y-4 border-t border-[var(--color-border)] pt-2">
          <p className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/40 px-3 py-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            检索到的文档片段将发送至硅基流动用于生成回答。敏感资料库建议继续使用本地 Ollama。
          </p>

          <label className="block text-xs">
            <span className="mb-1 block text-[var(--color-text-secondary)]">API Key</span>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder={maskedStored ? '输入新 Key 以更新…' : 'sk-…'}
              autoComplete="off"
              className="w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            {maskedStored ? (
              <span className="mt-1 block font-mono text-[11px] text-[var(--color-text-secondary)]">
                已保存（掩码）：{maskedStored}
              </span>
            ) : (
              <span className="mt-1 block text-[11px] text-[var(--color-text-secondary)]">
                尚未配置。保存后前端只能读到掩码，完整密钥由后端代理使用。
              </span>
            )}
          </label>
          <button
            type="button"
            disabled={savingKey}
            onClick={() => void persistApiKey()}
            className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50"
          >
            {savingKey ? '保存中…' : '保存 API Key'}
          </button>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              {showAdvanced ? '收起高级选项' : '展开高级选项（Base URL）'}
            </button>
            {showAdvanced ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-[12rem] flex-1 text-xs">
                  <span className="mb-1 block text-[var(--color-text-secondary)]">Base URL</span>
                  <input
                    value={baseUrlDraft}
                    onChange={(e) => setBaseUrlDraft(e.target.value)}
                    placeholder={DEFAULT_SETTINGS.siliconflow_base_url}
                    className="w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void persistBaseUrl()}
                  className="rounded-[length:var(--radius-control)] border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-btn-ghost-hover)]"
                >
                  保存 Base URL
                </button>
              </div>
            ) : null}
          </div>

          <label className="block text-xs">
            <span className="mb-1 block text-[var(--color-text-secondary)]">云端对话模型</span>
            <select
              value={presetSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v === CUSTOM_MODEL_VALUE) return;
                setModelDraft(v);
                void persistModel(v);
              }}
              className="w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            >
              {SILICONFLOW_CHAT_PRESETS.map((p) => (
                <option key={p.model} value={p.model}>
                  {p.label}
                  {p.hint ? ` — ${p.hint}` : ''}
                </option>
              ))}
              <option value={CUSTOM_MODEL_VALUE}>自定义模型 ID…</option>
            </select>
          </label>

          {presetSelectValue === CUSTOM_MODEL_VALUE ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[12rem] flex-1 text-xs">
                <span className="mb-1 block text-[var(--color-text-secondary)]">自定义 model id</span>
                <input
                  value={modelDraft}
                  onChange={(e) => setModelDraft(e.target.value)}
                  placeholder="Qwen/Qwen2.5-72B-Instruct"
                  className="w-full rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => void persistModel(modelDraft)}
                className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-on-accent)]"
              >
                保存模型
              </button>
            </div>
          ) : (
            <p className="break-all font-mono text-[11px] text-[var(--color-text-secondary)]">
              当前：{modelDraft}
            </p>
          )}

          <button
            type="button"
            disabled={testing}
            onClick={() => void runTest()}
            className="rounded-[length:var(--radius-control)] bg-[var(--color-accent)] px-4 py-2 text-sm text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
