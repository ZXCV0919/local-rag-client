import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriCommand } from '../../hooks/useDatabase';
import type { StreamChunk } from './stream-handler';

export interface SiliconflowChatEvent {
  streamId: StringLike;
  kind: string;
  content?: string;
  error?: string;
}

/** Tauri may deliver camelCase from serde rename_all */
type StringLike = string;

function normalizeEvent(raw: unknown): {
  streamId: string;
  kind: string;
  content?: string;
  error?: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const streamId = (o.streamId ?? o.stream_id) as string | undefined;
  const kind = o.kind as string | undefined;
  if (!streamId || !kind) return null;
  return {
    streamId,
    kind,
    content: typeof o.content === 'string' ? o.content : undefined,
    error: typeof o.error === 'string' ? o.error : undefined,
  };
}

export async function siliconflowChatCompleteViaTauri(
  messages: Array<{ role: string; content: string }>,
  opts: {
    model: string;
    baseUrl?: string;
    /** Only for "test before save"; omit to use DB secret */
    apiKeyOverride?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  return tauriCommand<string>('siliconflow_chat_complete', {
    messages,
    model: opts.model,
    baseUrl: opts.baseUrl ?? null,
    apiKeyOverride: opts.apiKeyOverride?.trim() ? opts.apiKeyOverride.trim() : null,
    temperature: opts.temperature ?? 0,
    maxTokens: opts.maxTokens ?? 256,
  });
}

export async function* streamSiliconflowViaTauri(
  messages: Array<{ role: string; content: string }>,
  opts: { model: string; baseUrl: string; signal?: AbortSignal },
): AsyncGenerator<StreamChunk> {
  const streamId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sf-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const queue: StreamChunk[] = [];
  let notify: (() => void) | null = null;
  const wait = () =>
    new Promise<void>((resolve) => {
      notify = resolve;
    });
  const wake = () => {
    const n = notify;
    notify = null;
    n?.();
  };

  let finished = false;
  const unlisten: UnlistenFn = await listen('siliconflow:chat', (event) => {
    const payload = normalizeEvent(event.payload);
    if (!payload || payload.streamId !== streamId) return;
    if (payload.kind === 'content' && payload.content) {
      queue.push({ type: 'content', content: payload.content });
      wake();
    } else if (payload.kind === 'error') {
      queue.push({ type: 'error', error: payload.error || '硅基流动请求失败' });
      finished = true;
      wake();
    } else if (payload.kind === 'done') {
      queue.push({ type: 'done' });
      finished = true;
      wake();
    }
  });

  const onAbort = () => {
    void tauriCommand('siliconflow_chat_abort', { streamId }).catch(() => {});
  };
  opts.signal?.addEventListener('abort', onAbort);

  const invokePromise = tauriCommand('siliconflow_chat_stream', {
    streamId,
    messages,
    model: opts.model,
    baseUrl: opts.baseUrl || null,
  }).catch((e) => {
    queue.push({
      type: 'error',
      error: e instanceof Error ? e.message : String(e),
    });
    finished = true;
    wake();
  });

  try {
    while (true) {
      while (queue.length > 0) {
        const chunk = queue.shift()!;
        yield chunk;
        if (chunk.type === 'done' || chunk.type === 'error') {
          await invokePromise;
          return;
        }
      }
      if (finished && queue.length === 0) {
        yield { type: 'done' };
        await invokePromise;
        return;
      }
      await wait();
    }
  } finally {
    opts.signal?.removeEventListener('abort', onAbort);
    unlisten();
  }
}
