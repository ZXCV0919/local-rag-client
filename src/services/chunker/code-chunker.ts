import { estimateTokenCount } from '../../utils/token-counter';
import type { PartialChunk, WorkingChunk } from './types';
import type { ChunkerConfig } from './types';

export function chunkCode(chunk: WorkingChunk, config: ChunkerConfig): PartialChunk[] {
  const max = config.max_chunk_size;
  const t = estimateTokenCount(chunk.content);
  if (t <= max) {
    const c = chunk.content;
    return [
      {
        content: c,
        heading_path: chunk.heading_path,
        chunk_type: 'code',
        token_count: t,
        metadata: { ...chunk.metadata },
      },
    ];
  }

  const lines = chunk.content.split('\n');
  const out: PartialChunk[] = [];
  let buf = '';

  const flush = () => {
    const c = buf.replace(/\n+$/, '');
    if (!c) return;
    out.push({
      content: c,
      heading_path: chunk.heading_path,
      chunk_type: 'code',
      token_count: estimateTokenCount(c),
      metadata: { ...chunk.metadata, split: true },
    });
    buf = '';
  };

  for (const line of lines) {
    const candidate = buf ? `${buf}\n${line}` : line;
    if (estimateTokenCount(candidate) > max && buf) {
      flush();
    }
    buf = buf ? `${buf}\n${line}` : line;
  }
  flush();
  return out;
}
