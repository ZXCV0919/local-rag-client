import type { FileType } from '../parser/types';
import type { ChunkingStrategy } from '../../types/knowledge-base';
import type { ChunkResult } from '../chunker/types';
import type { ParserResult } from '../parser/types';

export type ParseChunkRequest = {
  type: 'parse-chunk';
  requestId: string;
  fileName: string;
  fileType: FileType;
  buffer: ArrayBuffer;
  chunking: ChunkingStrategy;
};

export type ParseChunkResponse =
  | { type: 'progress'; requestId: string; step: 'parsing' | 'chunking' }
  | {
      type: 'done';
      requestId: string;
      parsed: ParserResult;
      chunks: ChunkResult[];
    }
  | { type: 'error'; requestId: string; message: string };
