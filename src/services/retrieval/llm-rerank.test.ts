import { describe, expect, it, vi } from 'vitest';
import { llmRerank } from './llm-rerank';
import type { RerankedResult } from './reranker';

function row(id: string, score: number): RerankedResult {
  return {
    chunk_id: id,
    document_id: 'd',
    content: `content-${id}`,
    heading_path: '',
    file_name: 'f.md',
    chunk_type: 'paragraph',
    vector_score: score,
    keyword_score: 0,
    final_score: score,
  };
}

describe('llmRerank', () => {
  it('reorders by LLM JSON id list', async () => {
    const candidates = [row('a', 0.9), row('b', 0.8), row('c', 0.7)];
    const complete = vi.fn(async () => JSON.stringify(['c', 'a', 'b']));
    const out = await llmRerank(candidates, 'q', complete);
    expect(out.map((x) => x.chunk_id)).toEqual(['c', 'a', 'b']);
  });

  it('falls back to original order on invalid JSON', async () => {
    const candidates = [row('a', 0.9), row('b', 0.8)];
    const out = await llmRerank(candidates, 'q', async () => 'not-json');
    expect(out.map((x) => x.chunk_id)).toEqual(['a', 'b']);
  });

  it('ignores unknown ids and appends missing ones', async () => {
    const candidates = [row('a', 0.9), row('b', 0.8), row('c', 0.7)];
    const out = await llmRerank(candidates, 'q', async () => JSON.stringify(['b', 'ghost']));
    expect(out.map((x) => x.chunk_id)).toEqual(['b', 'a', 'c']);
  });

  it('returns single candidate without calling LLM', async () => {
    const complete = vi.fn(async () => '[]');
    const out = await llmRerank([row('a', 1)], 'q', complete);
    expect(out).toHaveLength(1);
    expect(complete).not.toHaveBeenCalled();
  });
});
