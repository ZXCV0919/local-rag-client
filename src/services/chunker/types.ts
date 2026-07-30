import type { ChunkType } from '../../types/chunk';
import type { ChunkingStrategy } from '../../types/knowledge-base';

export interface ChunkResult {
  content: string;
  chunk_index: number;
  heading_path: string;
  chunk_type: ChunkType;
  char_start: number;
  char_end: number;
  token_count: number;
  metadata: Record<string, unknown>;
}

export interface ChunkerConfig {
  max_chunk_size: number;
  min_chunk_size: number;
  overlap: number;
  heading_as_context: boolean;
}

export function chunkerConfigFromStrategy(s: ChunkingStrategy): ChunkerConfig {
  return { ...s };
}

/** N-1 chunks before index/merge/char offsets */
export interface WorkingChunk {
  content: string;
  heading_path: string;
  chunk_type: ChunkType;
  metadata: Record<string, unknown>;
}

export type PartialChunk = Omit<ChunkResult, 'chunk_index' | 'char_start' | 'char_end'>;
