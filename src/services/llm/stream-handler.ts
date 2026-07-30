export interface StreamChunk {
  type: 'content' | 'done' | 'error';
  content?: string;
  error?: string;
}

export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  model: string,
  ollamaUrl: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const base = ollamaUrl.replace(/\/$/, '');
  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    yield {
      type: 'error',
      error: `Chat request failed: ${response.status} ${response.statusText}`,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: 'error', error: 'No response body' };
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
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };
          if (data.message?.content) {
            yield { type: 'content', content: data.message.content };
          }
          if (data.done) {
            yield { type: 'done' };
          }
        } catch {
          /* NDJSON fragment or noise */
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      try {
        const data = JSON.parse(tail) as { message?: { content?: string }; done?: boolean };
        if (data.message?.content) yield { type: 'content', content: data.message.content };
        if (data.done) yield { type: 'done' };
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      yield { type: 'done' };
    } else {
      yield { type: 'error', error: String(err) };
    }
  } finally {
    reader.releaseLock();
  }
}
