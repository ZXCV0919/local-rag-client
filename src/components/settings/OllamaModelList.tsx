import { useCallback, useEffect, useState } from 'react';

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { tauriCommand } from '../../hooks/useDatabase';

import type { OllamaModelTag } from '../../hooks/useOllama';

import { useSettingsStore } from '../../store/settings';

import { useToastStore } from '../../store/toast';

import { SILICONFLOW_CHAT_PRESETS } from '../../utils/siliconflow-presets';

import { ConfirmDialog } from '../common/ConfirmDialog';



function formatBytes(n: number): string {

  if (n <= 0) return '—';

  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;

  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;

  return `${(n / 1024).toFixed(0)} KB`;

}



async function writeSettingJson(key: string, value: string): Promise<void> {

  await tauriCommand('set_setting', { key, value: JSON.stringify(value) });

}



export type OllamaModelListVariant = 'embedding' | 'chat' | 'siliconflow';



export function OllamaModelList({

  variant,

  models,

  connected,

  onRefresh,

  ollamaUrl,

}: {

  variant: OllamaModelListVariant;

  models: OllamaModelTag[];

  connected: boolean;

  onRefresh: () => void;

  ollamaUrl: string;

}) {

  const embStore = useSettingsStore((st) => st.settings.default_embedding_model);

  const chatStore = useSettingsStore((st) => st.settings.default_chat_model);

  const siliconflowModel = useSettingsStore((st) => st.settings.siliconflow_chat_model);

  const setGlobal = useSettingsStore((st) => st.setSettings);

  const addToast = useToastStore((st) => st.addToast);



  const [defaults, setDefaults] = useState({ emb: embStore, chat: chatStore });

  const [pullName, setPullName] = useState('');

  const [pullBusy, setPullBusy] = useState(false);

  const [pullLine, setPullLine] = useState<string | null>(null);

  const [busyModel, setBusyModel] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [pct, setPct] = useState<number | null>(null);



  useEffect(() => {

    setDefaults({ emb: embStore, chat: chatStore });

  }, [embStore, chatStore]);



  useEffect(() => {

    if (variant !== 'embedding') return;

    let un: UnlistenFn | undefined;

    void listen<Record<string, unknown>>('ollama:model-downloading', (ev) => {

      const p = ev.payload;

      const status = typeof p.status === 'string' ? p.status : '';

      const completed = typeof p.completed === 'number' ? p.completed : undefined;

      const total = typeof p.total === 'number' ? p.total : undefined;

      if (completed != null && total != null && total > 0) {

        setPct(Math.round((completed / total) * 100));

        setPullLine(`${status}`);

      } else {

        setPct(null);

        setPullLine(status || JSON.stringify(p).slice(0, 120));

      }

    }).then((fn) => {

      un = fn;

    });

    return () => {

      void un?.();

    };

  }, [variant]);



  const embedding = models.filter((m) => m.model_type === 'embedding');

  const chats = models.filter((m) => m.model_type === 'chat');



  const pull = useCallback(async () => {

    const name = pullName.trim();

    if (!name) return;

    setPullBusy(true);

    setPullLine('开始下载…');

    setPct(null);

    try {

      await tauriCommand('pull_ollama_model', {

        name,

        ollamaUrl: ollamaUrl.trim() || null,

      });

      setPullLine('完成');

      addToast({ type: 'success', title: '模型拉取完成', duration: 3000 });

      onRefresh();

    } catch (e) {

      setPullLine(e instanceof Error ? e.message : String(e));

      addToast({

        type: 'error',

        title: '下载失败',

        message: e instanceof Error ? e.message : String(e),

        duration: 6000,

      });

    } finally {

      setPullBusy(false);

      setPct(null);

    }

  }, [addToast, pullName, ollamaUrl, onRefresh]);



  const runDelete = async (name: string) => {

    setBusyModel(name);

    try {

      await tauriCommand('delete_ollama_model', { name, ollamaUrl: ollamaUrl.trim() || null });

      onRefresh();

      addToast({ type: 'success', title: `已删除 ${name}`, duration: 2800 });

    } catch (e) {

      addToast({

        type: 'error',

        title: '删除失败',

        message: e instanceof Error ? e.message : String(e),

        duration: 6000,

      });

    } finally {

      setBusyModel(null);

      setPendingDelete(null);

    }

  };



  const setDefaultEmb = async (name: string) => {

    await writeSettingJson('default_embedding_model', name);

    setDefaults((d) => ({ ...d, emb: name }));

    setGlobal({ default_embedding_model: name });

  };



  const setDefaultChat = async (name: string) => {

    await writeSettingJson('default_chat_model', name);

    setDefaults((d) => ({ ...d, chat: name }));

    setGlobal({ default_chat_model: name });

  };



  if (variant === 'siliconflow') {

    const preset = SILICONFLOW_CHAT_PRESETS.find((p) => p.model === siliconflowModel);

    return (

      <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">

        <p>

          当前云端对话模型：

          <span className="font-mono text-[var(--color-text-primary)] break-all"> {siliconflowModel}</span>

        </p>

        {preset ? (

          <p className="text-xs leading-relaxed">

            预设：{preset.label}

            {preset.hint ? ` — ${preset.hint}` : ''}

          </p>

        ) : (

          <p className="text-xs">使用自定义模型 ID，请在上方「对话提供商」区块修改。</p>

        )}

        <p className="text-xs leading-relaxed">

          本机 Ollama 的 Chat 模型拉取/删除已隐藏；嵌入模型仍在「嵌入模型」区块管理。

        </p>

      </div>

    );

  }



  if (!connected) {

    return (

      <p className="text-sm text-[var(--color-text-secondary)]">

        连接 Ollama 后可管理本机模型；请先保存服务地址并「检测连接」。

      </p>

    );

  }



  return (

    <div className="space-y-6">

      {variant === 'embedding' ? (

        <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)]/30 space-y-2">

          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">

            拉取模型

          </div>

          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">

            下载与删除沿用页面上方的 Ollama 服务地址（常用于嵌入模型，如 nomic-embed-text）。

          </p>

          <div className="flex flex-wrap gap-2">

            <input

              value={pullName}

              onChange={(e) => setPullName(e.target.value)}

              placeholder="模型名，如 nomic-embed-text"

              className="flex-1 min-w-[12rem] px-3 py-2 text-sm rounded border border-[var(--color-border)]"

            />

            <button

              type="button"

              disabled={pullBusy}

              onClick={() => void pull()}

              className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] disabled:opacity-50"

            >

              {pullBusy ? '下载中…' : '下载模型'}

            </button>

          </div>

          {pct != null && pullBusy ? (

            <div className="space-y-1">

              <progress value={pct} max={100} className="w-full h-2 accent-[var(--color-accent)]" />

              <p className="text-xs font-mono text-[var(--color-text-secondary)]">

                {pullLine} · {pct}%

              </p>

            </div>

          ) : pullLine ? (

            <p className="text-xs text-[var(--color-text-secondary)] mt-2 font-mono">{pullLine}</p>

          ) : null}

        </div>

      ) : null}



      {variant === 'embedding' ? (

        <ModelColumn

          title="Embedding"

          subtitle={`默认：${defaults.emb}`}

          variant="embedding"

          items={embedding}

          defaultValue={defaults.emb}

          onPickDefault={(name) => void setDefaultEmb(name)}

          busyModel={busyModel}

          onAskDelete={(name) => setPendingDelete(name)}

        />

      ) : (

        <ModelColumn

          title="Chat"

          subtitle={`默认：${defaults.chat}`}

          variant="chat"

          items={chats}

          defaultValue={defaults.chat}

          onPickDefault={(name) => void setDefaultChat(name)}

          busyModel={busyModel}

          onAskDelete={(name) => setPendingDelete(name)}

        />

      )}



      <ConfirmDialog

        open={pendingDelete != null}

        onOpenChange={(o) => {

          if (!o) setPendingDelete(null);

        }}

        title="删除本地模型"

        description={pendingDelete ? `确定要从 Ollama 删除模型「${pendingDelete}」吗？（不可撤销）` : undefined}

        confirmLabel="删除"

        danger

        loading={busyModel === pendingDelete}

        onConfirm={async () => {

          if (pendingDelete) await runDelete(pendingDelete);

        }}

      />

    </div>

  );

}



function ModelColumn(props: {

  title: string;

  subtitle: string;

  variant: 'embedding' | 'chat';

  items: OllamaModelTag[];

  defaultValue: string;

  onPickDefault: (name: string) => void;

  busyModel: string | null;

  onAskDelete: (name: string) => void;

}) {

  const { title, subtitle, variant, items, defaultValue, onPickDefault, busyModel, onAskDelete } = props;

  return (

    <div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">

        {title}

      </h3>

      <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">{subtitle}</p>

      {items.length === 0 ? (

        <p className="text-sm text-[var(--color-text-secondary)]">暂无</p>

      ) : (

        <div className="space-y-2">

          <label className="text-xs block text-[var(--color-text-secondary)]">

            <span className="block mb-1">设为默认 ({variant})</span>

            <select

              value={items.some((x) => x.name === defaultValue) ? defaultValue : items[0].name}

              onChange={(e) => onPickDefault(e.target.value)}

              className="w-full px-2 py-1.5 text-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)]"

            >

              {items.map((m) => (

                <option key={m.name} value={m.name}>

                  {m.name}

                </option>

              ))}

            </select>

          </label>

          <ul className="text-sm space-y-2">

            {items.map((m) => (

              <li key={m.name} className="flex flex-col gap-1 rounded border border-[var(--color-border)] p-2">

                <span className="font-medium truncate" title={m.name}>

                  {m.name}

                </span>

                <span className="text-xs text-[var(--color-text-secondary)]">

                  {m.parameter_size} · {formatBytes(m.size)}

                  {defaultValue === m.name ? (

                    <span className="ml-2 text-[var(--color-accent)]">· 默认</span>

                  ) : null}

                </span>

                <div className="flex flex-wrap gap-1 pt-1">

                  <button

                    type="button"

                    onClick={() => onPickDefault(m.name)}

                    className="px-2 py-0.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-btn-ghost-hover)]"

                  >

                    设为默认

                  </button>

                  <button

                    type="button"

                    disabled={busyModel === m.name}

                    onClick={() => onAskDelete(m.name)}

                    className="px-2 py-0.5 text-xs rounded border border-[var(--color-danger-border)] text-[var(--color-danger-text)]"

                  >

                    删除

                  </button>

                </div>

              </li>

            ))}

          </ul>

        </div>

      )}

    </div>

  );

}


