import type { VectorSearchResult } from './vector-search';
import type { KeywordSearchResult } from './keyword-search';
import { lexicalRelevanceBoost, queryTermsFromUserQuery } from './relevance-bonus';

export interface RerankedResult {
  chunk_id: string;
  document_id: string;
  content: string;
  heading_path: string;
  file_name: string;
  chunk_type: string;
  vector_score: number;
  keyword_score: number;
  final_score: number;
}

const DEFAULT_RRF_K = 60;

function weightedRrf(
  rankedIds: string[],
  weight: number,
  rr: number,
  into: Map<string, number>,
  parts: Map<string, number>,
) {
  rankedIds.forEach((id, i) => {
    const add = weight * (1 / (rr + i + 1));
    into.set(id, (into.get(id) ?? 0) + add);
    parts.set(id, (parts.get(id) ?? 0) + add);
  });
}

export function rerank(
  vectorResults: VectorSearchResult[],
  keywordResults: KeywordSearchResult[],
  query: string,
  options: {
    vectorWeight?: number;
    keywordWeight?: number;
    titleMatchBonus?: number;
    maxResults?: number;
    rrfK?: number;
  } = {},
): RerankedResult[] {
  const alphaH = options.vectorWeight ?? 0.7;
  const betaH = options.keywordWeight ?? 0.3;
  const gammaH = options.titleMatchBonus ?? 0.12;
  const maxResults = options.maxResults ?? 6;
  const rr = options.rrfK ?? DEFAULT_RRF_K;

  const sumW = alphaH + betaH;
  const alpha = sumW > 0 ? alphaH / sumW : 0.5;
  const beta = sumW > 0 ? betaH / sumW : 0.5;

  const byChunk = new Map<string, VectorSearchResult>();
  for (const r of vectorResults) {
    if (r.chunk_id) byChunk.set(r.chunk_id, r);
  }
  const byKw = new Map<string, KeywordSearchResult>();
  for (const r of keywordResults) {
    if (r.chunk_id) byKw.set(r.chunk_id, r);
  }

  const vOrder = [...vectorResults]
    .filter((r) => r.chunk_id)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.chunk_id);
  const kOrder = [...keywordResults]
    .filter((r) => r.chunk_id)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.chunk_id);

  const rrfTotal = new Map<string, number>();
  const vPart = new Map<string, number>();
  const kPart = new Map<string, number>();
  weightedRrf(vOrder, alpha, rr, rrfTotal, vPart);
  weightedRrf(kOrder, beta, rr, rrfTotal, kPart);

  const merged = new Map<string, RerankedResult>();

  const upsertBase = (chunkId: string) => {
    const v = byChunk.get(chunkId);
    const kw = byKw.get(chunkId);
    const row: RerankedResult = {
      chunk_id: chunkId,
      document_id: v?.document_id ?? kw?.document_id ?? '',
      content: v?.content ?? kw?.content ?? '',
      heading_path: v?.heading_path ?? kw?.heading_path ?? '',
      file_name: v?.file_name ?? kw?.file_name ?? '',
      chunk_type: v?.metadata.chunk_type || kw?.chunk_type || 'paragraph',
      vector_score: vPart.get(chunkId) ?? 0,
      keyword_score: kPart.get(chunkId) ?? 0,
      final_score: rrfTotal.get(chunkId) ?? 0,
    };
    merged.set(chunkId, row);
  };

  for (const id of rrfTotal.keys()) {
    upsertBase(id);
  }

  const queryTerms = queryTermsFromUserQuery(query);
  if (queryTerms.size > 0) {
    for (const result of merged.values()) {
      if (!result.heading_path) continue;
      const headingTerms = result.heading_path
        .toLowerCase()
        .split(/[/\\>]/u)
        .map((t) => t.trim())
        .filter(Boolean);
      const matchCount = headingTerms.filter((t) => queryTerms.has(t)).length;
      result.final_score += gammaH * (matchCount / queryTerms.size);
    }
  }

  for (const result of merged.values()) {
    result.final_score += lexicalRelevanceBoost(
      query,
      result.file_name,
      result.heading_path,
      result.content,
    );
  }

  const sorted = Array.from(merged.values()).sort((a, b) => b.final_score - a.final_score);
  const selected: RerankedResult[] = [];
  const documentCounts = new Map<string, number>();
  const maxPerDocument = Math.max(2, Math.ceil(maxResults * 0.55));

  for (const result of sorted) {
    if (selected.length >= maxResults) break;
    const docCount = documentCounts.get(result.document_id) || 0;
    if (docCount < maxPerDocument) {
      selected.push(result);
      documentCounts.set(result.document_id, docCount + 1);
    }
  }

  if (selected.length < maxResults) {
    for (const result of sorted) {
      if (selected.length >= maxResults) break;
      if (!selected.some((s) => s.chunk_id === result.chunk_id)) {
        selected.push(result);
      }
    }
  }

  return selected.slice(0, maxResults);
}
