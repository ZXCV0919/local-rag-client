export interface ChunkingStrategy {
  max_chunk_size: number;
  min_chunk_size: number;
  overlap: number;
  heading_as_context: boolean;
}

export const FALLBACK_CHUNKING_STRATEGY: ChunkingStrategy = {
  max_chunk_size: 800,
  min_chunk_size: 100,
  overlap: 50,
  heading_as_context: true,
};

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  chunking_strategy: ChunkingStrategy;
  document_count: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseRow {
  id: string;
  name: string;
  description: string;
  embedding_model: string;
  chunking_strategy: string;
  document_count: number;
  total_tokens: number;
  created_at: string;
  updated_at: string;
}

export function knowledgeBaseFromRow(row: KnowledgeBaseRow): KnowledgeBase {
  try {
    return {
      ...row,
      chunking_strategy: JSON.parse(row.chunking_strategy) as ChunkingStrategy,
    };
  } catch {
    return {
      ...row,
      chunking_strategy: FALLBACK_CHUNKING_STRATEGY,
    };
  }
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string;
  embedding_model?: string;
  chunking_strategy?: Partial<ChunkingStrategy>;
}
