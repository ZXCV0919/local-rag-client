/// <reference lib="webworker" />
import { parseDocument } from '../parser';
import { chunkDocument, chunkerConfigFromStrategy } from '../chunker';
import type { FileType } from '../parser/types';
import type { ChunkingStrategy } from '../../types/knowledge-base';
import type { ChunkResult } from '../chunker/types';
import type { ParserResult } from '../parser/types';

export type ParseChunkRequest = {
  type: 'parse-chunk';
  requestId: string;
  fileName: string;
  fileType: FileType;
  /** Transferable ArrayBuffer */
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

self.onmessage = async (event: MessageEvent<ParseChunkRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'parse-chunk') return;

  const post = (data: ParseChunkResponse) => {
    postMessage(data);
  };

  try {
    post({ type: 'progress', requestId: msg.requestId, step: 'parsing' });
    const parsed = await parseDocument(msg.buffer, msg.fileName, msg.fileType);
    post({ type: 'progress', requestId: msg.requestId, step: 'chunking' });
    const chunks = chunkDocument(parsed.content, chunkerConfigFromStrategy(msg.chunking));
    post({ type: 'done', requestId: msg.requestId, parsed, chunks });
  } catch (e) {
    post({
      type: 'error',
      requestId: msg.requestId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
};

export {};
