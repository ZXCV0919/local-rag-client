import type { StreamChunk } from './stream-handler';

/** 用户可见：fetch 阶段网络失败（无 HTTP 响应） */
export const SILICONFLOW_NETWORK_ERROR = '无法连接硅基流动，请检查网络';

export function mapSiliconFlowHttpError(status: number, body: string): string {
  const snippet = body.trim().slice(0, 200);
  switch (status) {
    case 401:
      return 'API Key 无效或已过期，请在设置中更新';
    case 402:
      return '账户余额不足，请充值后重试';
    case 429:
      return '请求过于频繁或触发限流，请稍后再试';
    default:
      if (status >= 500) {
        return `硅基流动服务暂时不可用（${status}）`;
      }
      return snippet ? `请求失败（${status}）: ${snippet}` : `请求失败（${status}）`;
  }
}

function parseSseDataLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  return payload;
}

export async function* streamOpenAiChat(
  messages: Array<{ role: string; content: string }>,
  opts: { model: string; baseUrl: string; apiKey: string; signal?: AbortSignal },
): AsyncGenerator<StreamChunk> {
  const base = opts.baseUrl.replace(/\/$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        stream: true,
        temperature: 0.6,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) {
      yield { type: 'done' };
      return;
    }
    yield { type: 'error', error: SILICONFLOW_NETWORK_ERROR };
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    yield { type: 'error', error: mapSiliconFlowHttpError(response.status, text) };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: '硅基流动返回为空，请稍后重试' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const payload = parseSseDataLine(line);
        if (!payload) continue;
        try {
          const data = JSON.parse(payload) as {
            choices?: Array<{
              delta?: { content?: string; reasoning_content?: string };
            }>;
          };
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            yield { type: 'content', content };
          }
        } catch {
          /* malformed SSE chunk */
        }
      }
    }

    const tailPayload = buffer.trim() ? parseSseDataLine(buffer) : null;
    if (tailPayload) {
      try {
        const data = JSON.parse(tailPayload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.delta?.content;
        if (content) yield { type: 'content', content };
      } catch {
        /* ignore */
      }
    }

    yield { type: 'done' };
  } catch (err) {
    if (opts.signal?.aborted) {
      yield { type: 'done' };
    } else {
      yield { type: 'error', error: String(err) };
    }
  } finally {
    reader.releaseLock();
  }
}

export async function openAiChatComplete(
  messages: Array<{ role: string; content: string }>,
  opts: {
    model: string;
    baseUrl: string;
    apiKey: string;
    signal?: AbortSignal;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  const base = opts.baseUrl.replace(/\/$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        stream: false,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 256,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    throw new Error(SILICONFLOW_NETWORK_ERROR);
  }

  if (!response.ok) {
    throw new Error(mapSiliconFlowHttpError(response.status, await response.text()));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
