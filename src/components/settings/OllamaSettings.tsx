import { useCallback, useEffect, useState } from 'react';

import { tauriCommand } from '../../hooks/useDatabase';

import { useOllama } from '../../hooks/useOllama';

import { useSettingsStore } from '../../store/settings';

import { useToastStore } from '../../store/toast';

import { DEFAULT_SETTINGS } from '../../types/settings';

import { ChatProviderSettings } from './ChatProviderSettings';

import { OllamaModelList } from './OllamaModelList';

import { OllamaStatus } from './OllamaStatus';



export function OllamaSettings() {

  const { status, loading, checkStatus } = useOllama();

  const ollamaUrl = useSettingsStore((s) => s.settings.ollama_url);

  const chatProvider = useSettingsStore((s) => s.settings.chat_provider);

  const setSettings = useSettingsStore((s) => s.setSettings);

  const addToast = useToastStore((s) => s.addToast);

  const [urlDraft, setUrlDraft] = useState(() => ollamaUrl);



  useEffect(() => {

    setUrlDraft(ollamaUrl);

  }, [ollamaUrl]);



  const persistUrl = useCallback(async () => {

    try {

      await tauriCommand('set_ollama_url', { url: urlDraft.trim() });

      setSettings({ ollama_url: urlDraft.trim() });

      addToast({

        type: 'success',

        title: '已保存 Ollama 地址',

        duration: 2500,

      });

      await checkStatus();

    } catch (e) {

      addToast({

        type: 'error',

        title: '保存失败',

        message: e instanceof Error ? e.message : String(e),

        duration: 5000,

      });

    }

  }, [addToast, checkStatus, setSettings, urlDraft]);



  return (

    <div className="space-y-6">

      <ChatProviderSettings />



      <section className="space-y-3 overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">

        <h2 className="text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">本地向量化</h2>

        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">

          嵌入与检索始终使用本机 Ollama。默认为{' '}

          <code className="px-1 rounded bg-[var(--color-code-bg)]">{DEFAULT_SETTINGS.ollama_url}</code>

          ，保存后写入本地设置并重新检测连接。

        </p>

        <div className="flex flex-wrap gap-2 items-end">

          <label className="flex-1 min-w-[12rem] text-xs">

            <span className="block mb-1 text-[var(--color-text-secondary)]">Ollama 服务 URL</span>

            <input

              value={urlDraft}

              onChange={(e) => setUrlDraft(e.target.value)}

              className="w-full px-3 py-2 text-sm rounded-[length:var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

            />

          </label>

          <button

            type="button"

            onClick={() => void persistUrl()}

            className="px-4 py-2 text-sm rounded-[length:var(--radius-control)] bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"

          >

            保存并应用

          </button>

        </div>

      </section>



      <OllamaStatus status={status} loading={loading} checkStatus={checkStatus} />



      <section className="overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">

        <h2 className="mb-1 text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">嵌入模型</h2>

        <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">

          用于文档分块向量化与知识库检索，与对话提供商无关。

        </p>

        <OllamaModelList

          variant="embedding"

          models={status?.models ?? []}

          connected={!!status?.connected}

          onRefresh={checkStatus}

          ollamaUrl={urlDraft}

        />

      </section>



      {chatProvider === 'ollama' ? (

        <section className="overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">

          <h2 className="mb-1 text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">本地对话模型</h2>

          <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">

            RAG 回答生成使用本机已安装的 Chat 模型。

          </p>

          <OllamaModelList

            variant="chat"

            models={status?.models ?? []}

            connected={!!status?.connected}

            onRefresh={checkStatus}

            ollamaUrl={urlDraft}

          />

        </section>

      ) : (

        <section className="overflow-hidden rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">

          <h2 className="mb-1 text-[length:var(--text-section)] font-semibold tracking-tight text-[var(--color-text-primary)]">云端对话模型</h2>

          <OllamaModelList variant="siliconflow" models={[]} connected={false} onRefresh={checkStatus} ollamaUrl={urlDraft} />

        </section>

      )}

    </div>

  );

}


