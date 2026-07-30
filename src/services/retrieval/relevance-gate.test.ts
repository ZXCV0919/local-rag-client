import { describe, expect, it } from 'vitest';
import {
  CHAT_MIN_VECTOR_SIMILARITY_HYBRID_NO_KW,
  CHAT_MIN_VECTOR_SIMILARITY_SEMANTIC,
  shouldDeclineAnswerDueToWeakEvidence,
  type RetrievalEvidenceSummary,
} from './relevance-gate';
import type { RerankedResult } from './reranker';

function chunk(partial?: Partial<RerankedResult>): RerankedResult {
  return {
    chunk_id: 'c1',
    document_id: 'd1',
    content: 'hello',
    heading_path: '',
    file_name: 'a.md',
    chunk_type: 'paragraph',
    vector_score: 0.5,
    keyword_score: 0.5,
    final_score: 0.5,
    ...partial,
  };
}

function summary(partial: Partial<RetrievalEvidenceSummary>): RetrievalEvidenceSummary {
  return {
    chunks: [chunk()],
    mode: 'hybrid',
    maxVectorSimilarity: 0.8,
    keywordCandidateCount: 3,
    ...partial,
  };
}

describe('shouldDeclineAnswerDueToWeakEvidence', () => {
  it('declines when there are no chunks', () => {
    expect(shouldDeclineAnswerDueToWeakEvidence(summary({ chunks: [] }))).toBe(true);
  });

  it('declines in semantic mode when top vector similarity is below threshold', () => {
    expect(
      shouldDeclineAnswerDueToWeakEvidence(
        summary({
          mode: 'semantic',
          maxVectorSimilarity: CHAT_MIN_VECTOR_SIMILARITY_SEMANTIC - 0.01,
          keywordCandidateCount: 0,
        }),
      ),
    ).toBe(true);
  });

  it('allows semantic mode when similarity meets threshold', () => {
    expect(
      shouldDeclineAnswerDueToWeakEvidence(
        summary({
          mode: 'semantic',
          maxVectorSimilarity: CHAT_MIN_VECTOR_SIMILARITY_SEMANTIC,
        }),
      ),
    ).toBe(false);
  });

  it('declines in hybrid mode when vector is weak and keyword lane is empty', () => {
    expect(
      shouldDeclineAnswerDueToWeakEvidence(
        summary({
          mode: 'hybrid',
          maxVectorSimilarity: CHAT_MIN_VECTOR_SIMILARITY_HYBRID_NO_KW - 0.01,
          keywordCandidateCount: 0,
        }),
      ),
    ).toBe(true);
  });

  it('allows hybrid mode when keyword candidates exist even if vector is weak', () => {
    expect(
      shouldDeclineAnswerDueToWeakEvidence(
        summary({
          mode: 'hybrid',
          maxVectorSimilarity: 0.2,
          keywordCandidateCount: 1,
        }),
      ),
    ).toBe(false);
  });

  it('allows keyword mode whenever chunks are present', () => {
    expect(
      shouldDeclineAnswerDueToWeakEvidence(
        summary({
          mode: 'keyword',
          maxVectorSimilarity: null,
          keywordCandidateCount: 0,
        }),
      ),
    ).toBe(false);
  });
});
