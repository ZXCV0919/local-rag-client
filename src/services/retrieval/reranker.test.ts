import { describe, expect, it } from 'vitest';
import { rerank } from './reranker';
import type { VectorSearchResult } from './vector-search';
import type { KeywordSearchResult } from './keyword-search';

function vec(
  chunkId: string,
  documentId: string,
  score: number,
  extras?: Partial<VectorSearchResult>,
): VectorSearchResult {
  return {
    chunk_id: chunkId,
    document_id: documentId,
    content: `content-${chunkId}`,
    heading_path: '',
    file_name: `${documentId}.md`,
    score,
    metadata: { chunk_type: 'paragraph' },
    ...extras,
  };
}

function kw(
  chunkId: string,
  documentId: string,
  score: number,
  extras?: Partial<KeywordSearchResult>,
): KeywordSearchResult {
  return {
    chunk_id: chunkId,
    document_id: documentId,
    knowledge_base_id: 'kb',
    content: `content-${chunkId}`,
    heading_path: '',
    chunk_type: 'paragraph',
    score,
    file_name: `${documentId}.md`,
    ...extras,
  };
}

describe('rerank', () => {
  it('returns vector-only results when keyword lane is empty', () => {
    const out = rerank([vec('v1', 'd1', 0.9), vec('v2', 'd1', 0.8)], [], '无关查询', {
      maxResults: 2,
      titleMatchBonus: 0,
    });
    expect(out.map((r) => r.chunk_id)).toEqual(['v1', 'v2']);
    expect(out[0]!.keyword_score).toBe(0);
  });

  it('returns keyword-only results when vector lane is empty', () => {
    const out = rerank([], [kw('k1', 'd1', 12), kw('k2', 'd2', 5)], '无关查询', {
      maxResults: 2,
      titleMatchBonus: 0,
    });
    expect(out.map((r) => r.chunk_id)).toEqual(['k1', 'k2']);
    expect(out[0]!.vector_score).toBe(0);
  });

  it('prefers chunks that appear in both lanes when weights are balanced', () => {
    const out = rerank(
      [vec('both', 'd1', 0.7), vec('v-only', 'd2', 0.95)],
      [kw('both', 'd1', 10), kw('k-only', 'd3', 9)],
      '无关查询',
      { vectorWeight: 0.5, keywordWeight: 0.5, titleMatchBonus: 0, maxResults: 3 },
    );
    expect(out[0]!.chunk_id).toBe('both');
  });

  it('caps how many chunks a single document can take before filling remaining slots', () => {
    const vectorHeavy = Array.from({ length: 8 }, (_, i) =>
      vec(`a${i}`, 'docA', 1 - i * 0.01),
    );
    const other = [vec('b0', 'docB', 0.5)];
    const out = rerank([...vectorHeavy, ...other], [], '无关查询', {
      maxResults: 6,
      titleMatchBonus: 0,
    });
    const fromA = out.filter((r) => r.document_id === 'docA').length;
    const fromB = out.filter((r) => r.document_id === 'docB').length;
    // First pass caps per-doc; remaining slots may refill from docA. Critical: weaker docB still appears.
    expect(fromB).toBe(1);
    expect(fromA).toBe(5);
    expect(out).toHaveLength(6);
    expect(out.some((r) => r.chunk_id === 'b0')).toBe(true);
  });
});
