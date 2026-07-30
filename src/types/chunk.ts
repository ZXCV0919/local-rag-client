export type ChunkType = 'heading' | 'paragraph' | 'code' | 'table' | 'mixed';

export interface Chunk {
  id: string;
  document_id: string;
  knowledge_base_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  char_start: number;
  char_end: number;
  heading_path: string;
  chunk_type: ChunkType;
  embedding_id: string;
  metadata: Record<string, unknown>;
}

/** API / SQLite row (metadata stored as JSON string) */
export interface ChunkRow {
  id: string;
  document_id: string;
  knowledge_base_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  char_start: number;
  char_end: number;
  heading_path: string;
  chunk_type: ChunkType;
  embedding_id: string;
  metadata: string;
}

export function chunkFromRow(row: ChunkRow): Chunk {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    document_id: row.document_id,
    knowledge_base_id: row.knowledge_base_id,
    chunk_index: row.chunk_index,
    content: row.content,
    token_count: row.token_count,
    char_start: row.char_start,
    char_end: row.char_end,
    heading_path: row.heading_path,
    chunk_type: row.chunk_type,
    embedding_id: row.embedding_id,
    metadata,
  };
}

export interface DocContent {
  title: string;
  file_type: string;
  sections: DocSection[];
}

export interface DocSection {
  heading: string;
  heading_path: string;
  heading_level: number;
  content: string;
  content_type: 'text' | 'code' | 'table' | 'list';
}
