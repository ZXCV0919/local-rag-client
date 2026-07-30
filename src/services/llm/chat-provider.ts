import type { ChatProvider } from '../../types/settings';
import type { StreamChunk } from './stream-handler';
import { streamChat as streamOllamaChat } from './stream-handler';
import {
  siliconflowChatCompleteViaTauri,
  streamSiliconflowViaTauri,
} from './siliconflow-tauri';

export interface ChatRequestConfig {
  provider: ChatProvider;
  model: string;
  ollamaUrl: string;
  /** @deprecated Key stays in Rust; kept optional for call-site compatibility */
  siliconflowApiKey?: string;
  siliconflowBaseUrl: string;
  signal?: AbortSignal;
}

async function ollamaChatComplete(
  messages: Array<{ role: string; content: string }>,
  model: string,
  ollamaUrl: string,
  signal?: AbortSignal,
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const base = ollamaUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0,
        num_predict: options?.maxTokens ?? 256,
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Chat request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? '';
}

export async function* streamChatUnified(
  messages: Array<{ role: string; content: string }>,
  config: ChatRequestConfig,
): AsyncGenerator<StreamChunk> {
  if (config.provider === 'siliconflow') {
    yield* streamSiliconflowViaTauri(messages, {
      model: config.model,
      baseUrl: config.siliconflowBaseUrl,
      signal: config.signal,
    });
    return;
  }
  yield* streamOllamaChat(messages, config.model, config.ollamaUrl, config.signal);
}

export async function chatCompleteUnified(
  messages: Array<{ role: string; content: string }>,
  config: ChatRequestConfig,
): Promise<string> {
  if (config.provider === 'siliconflow') {
    return siliconflowChatCompleteViaTauri(messages, {
      model: config.model,
      baseUrl: config.siliconflowBaseUrl,
      temperature: 0,
      maxTokens: 160,
    });
  }
  return ollamaChatComplete(
    messages,
    config.model,
    config.ollamaUrl,
    config.signal,
    { temperature: 0, maxTokens: 160 },
  );
}
