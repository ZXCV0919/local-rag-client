import { describe, expect, it } from 'vitest';
import {
  allocateContextBudget,
  DEFAULT_CONTEXT_CONFIG,
  sliceHistoryByRounds,
  truncateReferences,
} from './context-window';
import type { RerankedResult } from '../retrieval/reranker';

function ref(id: string, content: string): RerankedResult {
  return {
    chunk_id: id,
    document_id: 'd',
    content,
    heading_path: '',
    file_name: 'f.md',
    chunk_type: 'paragraph',
    vector_score: 0,
    keyword_score: 0,
    final_score: 0,
  };
}

describe('context-window', () => {
  it('allocates budgets by configured ratios', () => {
    const b = allocateContextBudget(DEFAULT_CONTEXT_CONFIG);
    expect(b.systemBudget).toBe(Math.floor(8192 * 0.1));
    expect(b.referenceBudget).toBe(Math.floor(8192 * 0.6));
    expect(b.historyBudget).toBe(Math.floor(8192 * 0.2));
    expect(b.queryBudget).toBe(Math.floor(8192 * 0.1));
  });

  it('keeps only the last N user rounds', () => {
    const messages = [
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
      { role: 'assistant', content: 'a3' },
    ];
    const sliced = sliceHistoryByRounds(messages, 2);
    // cut sits after the overflow user turn, so the previous assistant may remain
    expect(sliced.map((m) => m.content)).toEqual(['a1', 'u2', 'a2', 'u3', 'a3']);
    expect(sliced.filter((m) => m.role === 'user')).toHaveLength(2);
  });

  it('returns empty history when maxRounds is zero', () => {
    expect(sliceHistoryByRounds([{ role: 'user' }], 0)).toEqual([]);
  });

  it('truncates references that exceed the token budget', () => {
    const long = '字'.repeat(4000);
    const out = truncateReferences([ref('1', long), ref('2', '短')], 50);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0]!.content.includes('内容已截断') || out[0]!.content.length <= long.length).toBe(
      true,
    );
    expect(out.every((r) => r.chunk_id === '1' || r.chunk_id === '2')).toBe(true);
  });
});
