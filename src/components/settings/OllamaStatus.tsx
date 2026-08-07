import type { OllamaModelTag, OllamaStatusPayload } from '../../hooks/useOllama';

export function OllamaStatus({
  status,
  loading,
  checkStatus,
}: {
  status: OllamaStatusPayload | null;
  loading: boolean;
  checkStatus: () => void;
}) {
  const embedding = status?.models.filter((m) => m.model_type === 'embedding') ?? [];
  const chat = status?.models.filter((m) => m.model_type === 'chat') ?? [];

  return (
    <section className="rounded-[length:var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
              loading ? 'bg-amber-400' : status?.connected ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={loading ? '检测中' : status?.connected ? '已连�? : '未连�?}
            aria-hidden
          />
          <div>
            <h2 className="font-semibold">Ollama</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {status?.url || '�?} · {loading ? '检测中�? : status?.connected ? '在线' : '离线'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void checkStatus()}
          disabled={loading}
          className="px-4 py-2 text-sm rounded border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-btn-ghost-hover)] disabled:opacity-50"
        >
          检测连�?
        </button>
      </div>

      {status?.connected ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
              Embedding
            </h3>
            <ul className="text-sm space-y-1">
              {embedding.length === 0 ? (
                <li className="text-[var(--color-text-secondary)]">暂无</li>
              ) : (
                embedding.map((m: OllamaModelTag) => (
                  <li key={m.name} className="truncate">
                    {m.name}{' '}
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      ({m.parameter_size})
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
              Chat
            </h3>
            <ul className="text-sm space-y-1">
              {chat.length === 0 ? (
                <li className="text-[var(--color-text-secondary)]">暂无</li>
              ) : (
                chat.map((m: OllamaModelTag) => (
                  <li key={m.name} className="truncate">
                    {m.name}{' '}
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      ({m.parameter_size})
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm text-[var(--color-text-secondary)]">
          <p>
            请在本机启动 Ollama（默认端�?<code className="bg-[var(--color-code-bg)] px-1 rounded">11434</code>
            ），安装需要的模型后再检测连接�?
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              嵌入模型（导入必需）：
              <code className="bg-[var(--color-code-bg)] px-1 rounded">ollama pull nomic-embed-text</code>
            </li>
            <li>对话模型按需拉取（如 qwen2.5:7b�?/li>
            <li>
              仍失败时查看排障文档�?
              <code className="bg-[var(--color-code-bg)] px-1 rounded">docs/ops/troubleshooting.md</code>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
}
