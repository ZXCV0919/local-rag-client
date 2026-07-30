import type { FileType } from '../parser/types';
import type { ChunkingStrategy } from '../../types/knowledge-base';
import type { ChunkResult } from '../chunker/types';
import type { ParserResult } from '../parser/types';
import { parseDocument } from '../parser';
import { chunkDocument, chunkerConfigFromStrategy } from '../chunker';
import type { ParseChunkRequest, ParseChunkResponse } from './parse-chunk.worker';
import ParseChunkWorker from './parse-chunk.worker?worker';

export type ParseChunkProgressStep = 'parsing' | 'chunking';

/**
 * Parse + chunk off the UI thread for md/txt/docx.
 * PDF stays on the main thread (pdf.js already uses its own worker; nested workers are brittle).
 */
export async function parseAndChunkDocument(
  buffer: ArrayBuffer,
  fileName: string,
  fileType: FileType,
  chunking: ChunkingStrategy,
  onStep?: (step: ParseChunkProgressStep) => void,
): Promise<{ parsed: ParserResult; chunks: ChunkResult[] }> {
  if (fileType === 'pdf') {
    onStep?.('parsing');
    const parsed = await parseDocument(buffer, fileName, fileType);
    onStep?.('chunking');
    const chunks = chunkDocument(parsed.content, chunkerConfigFromStrategy(chunking));
    return { parsed, chunks };
  }

  return new Promise((resolve, reject) => {
    const worker = new ParseChunkWorker();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<ParseChunkResponse>) => {
      const data = event.data;
      if (!data || data.requestId !== requestId) return;
      if (data.type === 'progress') {
        onStep?.(data.step);
        return;
      }
      if (data.type === 'done') {
        cleanup();
        resolve({ parsed: data.parsed, chunks: data.chunks });
        return;
      }
      if (data.type === 'error') {
        cleanup();
        reject(new Error(data.message));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err.message || err)));
    };

    const copy = buffer.slice(0);
    const msg: ParseChunkRequest = {
      type: 'parse-chunk',
      requestId,
      fileName,
      fileType,
      buffer: copy,
      chunking,
    };
    worker.postMessage(msg, [copy]);
  });
}
