import { getQueryEmbedding } from '../embedding';
import type { RetrievalMode, RerankMode } from '../../types/settings';
import { vectorSearch, type VectorSearchResult } from './vector-search';
import { keywordSearch, type KeywordSearchResult } from './keyword-search';
import { rerank, type RerankedResult } from './reranker';
import { lexicalRelevanceBoost } from './relevance-bonus';
import { llmRerank, type LlmCompleteFn } from './llm-rerank';

export type { VectorSearchResult } from './vector-search';
export type { KeywordSearchResult } from './keyword-search';
export type { RerankedResult } from './reranker';

export interface RetrievalResult {
  chunks: RerankedResult[];
  mode: RetrievalMode;
  totalCandidates: number;
  /** 向量检索池中最高相似度（未跑向量腿时为 null） */
  maxVectorSimilarity: number | null;
  /** 关键词检索池中最高得分（未跑关键词腿时为 null） */
  maxKeywordScore: number | null;
  vectorCandidateCount: number;
  keywordCandidateCount: number;
}

function pickWithDocumentCap(rows: RerankedResult[], maxResults: number, maxPerDocument: number): RerankedResult[] {
  const selected: RerankedResult[] = [];
  const documentCounts = new Map<string, number>();
  for (const row of rows) {
    if (selected.length >= maxResults) break;
    const docCount = documentCounts.get(row.document_id) || 0;
    if (docCount < maxPerDocument) {
      selected.push(row);
      documentCounts.set(row.document_id, docCount + 1);
    }
  }
  if (selected.length < maxResults) {
    for (const row of rows) {
      if (selected.length >= maxResults) break;
      if (!selected.some((s) => s.chunk_id === row.chunk_id)) {
        selected.push(row);
      }
    }
  }
  return selected.slice(0, maxResults);
}

async function maybeLlmRerank(
  chunks: RerankedResult[],
  query: string,
  maxResults: number,
  rerankMode: RerankMode,
  llmComplete?: LlmCompleteFn,
): Promise<RerankedResult[]> {
  if (rerankMode !== 'llm' || !llmComplete || chunks.length <= 1) {
    return chunks.slice(0, maxResults);
  }
  const ordered = await llmRerank(chunks, query, llmComplete);
  return ordered.slice(0, maxResults);
}

export async function retrieve(
  query: string,
  kbId: string,
  embeddingModel: string,
  ollamaUrl: string | null | undefined,
  options: {
    mode?: RetrievalMode;
    maxResults?: number;
    vectorWeight?: number;
    keywordWeight?: number;
    rerankMode?: RerankMode;
    /** LLM listwise 重排；仅 rerankMode=llm 时使用 */
    llmComplete?: LlmCompleteFn;
  } = {},
): Promise<RetrievalResult> {
  const mode = options.mode ?? 'hybrid';
  const maxResults = options.maxResults ?? 6;
  const rerankMode = options.rerankMode ?? 'rrf';
  const wantLlm = rerankMode === 'llm' && !!options.llmComplete;
  /** LLM 重排前多取一些候选 */
  const selectCount = wantLlm ? Math.min(30, Math.max(maxResults * 3, maxResults)) : maxResults;
  const basePool = Math.min(500, Math.max(64, maxResults * 12));
  const vectorPool =
    mode === 'semantic'
      ? Math.min(500, Math.max(120, maxResults * 22))
      : basePool;

  let vectorResults: VectorSearchResult[] = [];
  let keywordResults: KeywordSearchResult[] = [];

  if (mode === 'hybrid' || mode === 'semantic') {
    const { embedding } = await getQueryEmbedding(query, embeddingModel, ollamaUrl);
    vectorResults = await vectorSearch(kbId, embedding, vectorPool);
  }

  if (mode === 'hybrid' || mode === 'keyword') {
    keywordResults = await keywordSearch(kbId, query, basePool);
  }

  const maxVectorSimilarity =
    vectorResults.length > 0 ? Math.max(...vectorResults.map((x) => x.score)) : null;
  const maxKeywordScore =
    keywordResults.length > 0 ? Math.max(...keywordResults.map((x) => x.score)) : null;
  const vectorCandidateCount = vectorResults.length;
  const keywordCandidateCount = keywordResults.length;

  const evidenceTail = {
    maxVectorSimilarity,
    maxKeywordScore,
    vectorCandidateCount,
    keywordCandidateCount,
  };

  if (mode === 'semantic') {
    const raw = vectorResults.map((r) => r.score);
    const minS = raw.length > 0 ? Math.min(...raw) : 0;
    const maxS = raw.length > 0 ? Math.max(...raw) : 1;
    const spread = maxS > minS;

    const rows = vectorResults.map((r) => {
      const normV = spread ? (r.score - minS) / (maxS - minS) : 1;
      const bonus = lexicalRelevanceBoost(query, r.file_name, r.heading_path, r.content);
      return {
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        content: r.content,
        heading_path: r.heading_path,
        file_name: r.file_name,
        chunk_type: r.metadata.chunk_type || 'paragraph',
        vector_score: r.score,
        keyword_score: 0,
        final_score: normV + bonus,
      };
    });
    rows.sort((a, b) => b.final_score - a.final_score);

    const capped = pickWithDocumentCap(rows, selectCount, Math.max(2, Math.ceil(selectCount * 0.55)));
    const chunks = await maybeLlmRerank(capped, query, maxResults, rerankMode, options.llmComplete);
    return {
      chunks,
      mode,
      totalCandidates: vectorResults.length,
      ...evidenceTail,
    };
  }

  if (mode === 'keyword') {
    const rows = keywordResults.map((r) => {
      const bonus = lexicalRelevanceBoost(query, r.file_name, r.heading_path, r.content);
      return {
        chunk_id: r.chunk_id,
        document_id: r.document_id,
        content: r.content,
        heading_path: r.heading_path,
        file_name: r.file_name,
        chunk_type: r.chunk_type,
        vector_score: 0,
        keyword_score: r.score,
        final_score: r.score + bonus,
      };
    });
    rows.sort((a, b) => b.final_score - a.final_score);
    const capped = rows.slice(0, selectCount);
    const chunks = await maybeLlmRerank(capped, query, maxResults, rerankMode, options.llmComplete);
    return {
      chunks,
      mode,
      totalCandidates: keywordResults.length,
      ...evidenceTail,
    };
  }

  const reranked = rerank(vectorResults, keywordResults, query, {
    vectorWeight: options.vectorWeight,
    keywordWeight: options.keywordWeight,
    maxResults: selectCount,
  });
  const chunks = await maybeLlmRerank(reranked, query, maxResults, rerankMode, options.llmComplete);

  return {
    chunks,
    mode,
    totalCandidates: vectorResults.length + keywordResults.length,
    ...evidenceTail,
  };
}
