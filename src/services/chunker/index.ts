import type { DocContent } from '../../types/chunk';
import type { ChunkResult, ChunkerConfig } from './types';
import { chunkByHeading } from './heading-chunker';
import { chunkByParagraph } from './paragraph-chunker';
import { chunkCode } from './code-chunker';
import { estimateTokenCount } from '../../utils/token-counter';
import { overlapSuffix, prependOverlap } from './overlap';
import type { PartialChunk, WorkingChunk } from './types';

function workingToPartial(w: WorkingChunk): PartialChunk {
  return {
    content: w.content,
    heading_path: w.heading_path,
    chunk_type: w.chunk_type,
    token_count: estimateTokenCount(w.content),
    metadata: w.metadata,
  };
}

function expandIfNeeded(w: WorkingChunk, config: ChunkerConfig): PartialChunk[] {
  const tokenCount = estimateTokenCount(w.content);
  if (tokenCount > config.max_chunk_size) {
    if (w.chunk_type === 'code') {
      return chunkCode(w, config);
    }
    return chunkByParagraph(w, config);
  }
  return [workingToPartial(w)];
}

export function chunkDocument(content: DocContent, config: ChunkerConfig): ChunkResult[] {
  const preliminary = chunkByHeading(content.sections, config);
  let partials: PartialChunk[] = [];

  for (const w of preliminary) {
    partials.push(...expandIfNeeded(w, config));
  }

  const merged: PartialChunk[] = [];
  for (const p of partials) {
    const tok = p.token_count;
    if (
      tok < config.min_chunk_size &&
      merged.length > 0 &&
      merged[merged.length - 1]!.chunk_type !== 'code'
    ) {
      const prev = merged[merged.length - 1]!;
      prev.content = `${prev.content}\n\n${p.content}`;
      prev.token_count = estimateTokenCount(prev.content);
      prev.chunk_type = 'mixed';
    } else {
      merged.push({ ...p });
    }
  }

  let withOverlap: PartialChunk[] = merged.map((m) => ({ ...m }));
  if (config.overlap > 0) {
    for (let i = 1; i < withOverlap.length; i++) {
      const prev = withOverlap[i - 1]!;
      const cur = withOverlap[i]!;
      if (cur.chunk_type === 'code' && prev.chunk_type !== 'code') continue;
      const tail = overlapSuffix(prev.content, config.overlap);
      if (tail) {
        cur.content = prependOverlap(cur.content, tail);
        cur.token_count = estimateTokenCount(cur.content);
      }
    }
  }

  let charOffset = 0;
  return withOverlap.map((c, idx) => {
    const res: ChunkResult = {
      ...c,
      chunk_index: idx,
      char_start: charOffset,
      char_end: charOffset + c.content.length,
      token_count: estimateTokenCount(c.content),
    };
    charOffset += c.content.length;
    return res;
  });
}

export { chunkerConfigFromStrategy } from './types';
export type { ChunkResult, ChunkerConfig } from './types';
