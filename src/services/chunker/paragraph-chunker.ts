import { estimateTokenCount } from '../../utils/token-counter';
import type { PartialChunk, WorkingChunk } from './types';
import type { ChunkerConfig } from './types';

const SENTENCE_END = /[。！？!?]/;

function splitIntoSentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    buf += ch;
    if (SENTENCE_END.test(ch) || (ch === '\n' && buf.trim().length > 0)) {
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
    }
  }
  const rest = buf.trim();
  if (rest) out.push(rest);
  return out.length ? out : [text.trim()].filter(Boolean);
}

export function chunkByParagraph(chunk: WorkingChunk, config: ChunkerConfig): PartialChunk[] {
  const max = config.max_chunk_size;
  const sentences = splitIntoSentences(chunk.content.replace(/\n{3,}/g, '\n\n'));
  const parts: string[] = [];
  let buf = '';
  let bufTok = 0;

  const flush = () => {
    const t = buf.trim();
    if (t) parts.push(t);
    buf = '';
    bufTok = 0;
  };

  for (const s of sentences) {
    const st = estimateTokenCount(s);
    if (st > max) {
      flush();
      for (let i = 0; i < s.length; ) {
        let take = 1;
        let acc = '';
        while (i + take <= s.length) {
          const piece = s.slice(i, i + take);
          const pt = estimateTokenCount(piece);
          if (pt > max) break;
          acc = piece;
          take++;
        }
        if (acc) {
          parts.push(acc);
          i += acc.length;
        } else {
          parts.push(s[i]!);
          i += 1;
        }
      }
      continue;
    }

    const nextTok = bufTok + (buf ? estimateTokenCount('\n\n' + s) : st);
    if (buf && nextTok > max) {
      flush();
    }
    buf = buf ? `${buf}\n\n${s}` : s;
    bufTok = estimateTokenCount(buf);
  }
  flush();

  return parts.map((content, i) => ({
    content,
    heading_path: chunk.heading_path,
    chunk_type: (i === 0 ? chunk.chunk_type : 'mixed') as PartialChunk['chunk_type'],
    token_count: estimateTokenCount(content),
    metadata: { ...chunk.metadata, part: i },
  }));
}
