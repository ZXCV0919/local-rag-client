/// <reference lib="webworker" />
/**
 * md/txt only. Never import parser barrel, pdfjs, mammoth, or docx —
 * those touch DOM (`document`) and crash in a Worker.
 */
import { MarkdownParser } from '../parser/markdown';
import { TxtParser } from '../parser/txt';
import { chunkDocument, chunkerConfigFromStrategy } from '../chunker';
import type { ParseChunkRequest, ParseChunkResponse } from './parse-chunk-types';

const mdParser = new MarkdownParser();
const txtParser = new TxtParser();

self.onmessage = async (event: MessageEvent<ParseChunkRequest>) => {
  const msg = event.data;
  if (!msg || msg.type !== 'parse-chunk') return;

  const post = (data: ParseChunkResponse) => {
    postMessage(data);
  };

  try {
    if (msg.fileType !== 'md' && msg.fileType !== 'txt') {
      throw new Error(`Worker 仅支持 md/txt，收到 ${msg.fileType}`);
    }
    post({ type: 'progress', requestId: msg.requestId, step: 'parsing' });
    const parsed =
      msg.fileType === 'md'
        ? await mdParser.parse(msg.buffer, msg.fileName)
        : await txtParser.parse(msg.buffer, msg.fileName);
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
