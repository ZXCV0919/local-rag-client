import { readFile } from '@tauri-apps/plugin-fs';
import { tauriCommand } from '../../hooks/useDatabase';
import { computeContentHash } from '../../utils/hash';
import { getSupportedType } from '../parser';
import { EmbeddingBatchQueue } from '../embedding/batch-queue';
import type { Document, ImportProgress } from '../../types/document';
import type { KnowledgeBase } from '../../types/knowledge-base';
import type { ChunkRow } from '../../types/chunk';
import { DEFAULT_SETTINGS } from '../../types/settings';
import { mergeSectionsForPreview, saveDocumentSourceCache } from '../document/source-preview';
import { parseAndChunkDocument } from './parse-and-chunk';

export type ProgressHandler = (p: ImportProgress) => void;

const STEP_TOTAL = 6;

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function readOllamaUrl(): Promise<string> {
  const raw = await tauriCommand<string | null>('get_setting', { key: 'ollama_url' });
  if (raw == null || raw === '') return DEFAULT_SETTINGS.ollama_url;
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw;
  }
}

async function indexDocumentAfterChunks(
  kb: KnowledgeBase,
  docId: string,
  fileName: string,
  created: ChunkRow[],
  report: (partial: {
    status: ImportProgress['status'];
    current_step: string;
    completed: number;
    total?: number;
    error_message?: string;
    embedding?: ImportProgress['embedding'];
  }) => void,
): Promise<void> {
  report({
    status: 'processing',
    current_step: 'embedding',
    completed: 3,
    total: STEP_TOTAL,
    embedding: {
      completed: 0,
      total: created.length,
      failedChunks: 0,
    },
  });

  if (created.length === 0) {
    await tauriCommand<Document>('update_document_status', {
      id: docId,
      status: 'ready',
      errorMessage: null,
    });
    report({
      status: 'processing',
      current_step: 'complete',
      completed: STEP_TOTAL,
      total: STEP_TOTAL,
    });
    return;
  }

  const ollamaUrl = await readOllamaUrl();
  const embedModel = kb.embedding_model;
  const chunksForQueue = created.map((c) => ({ id: c.id, content: c.content }));
  const queue = new EmbeddingBatchQueue(5, 3);

  const embMap = await queue.processBatch(
    chunksForQueue,
    embedModel,
    ollamaUrl,
    (p) => {
      report({
        status: 'processing',
        current_step: 'embedding',
        completed: 4,
        total: STEP_TOTAL,
        embedding: {
          completed: p.completed,
          total: p.total,
          failedChunks: p.failedChunks.length,
        },
      });
    },
    async ({ ids, embeddings }) => {
      const documents = ids.map((id) => {
        const c = created.find((x) => x.id === id)!;
        return c.content;
      });
      const metadatas = ids.map((id) => {
        const c = created.find((x) => x.id === id)!;
        return {
          document_id: docId,
          knowledge_base_id: kb.id,
          chunk_index: String(c.chunk_index),
          heading_path: c.heading_path ?? '',
          chunk_type: c.chunk_type ?? 'paragraph',
          file_name: fileName,
        };
      });
      await tauriCommand('chromadb_add_documents', {
        knowledgeBaseId: kb.id,
        ids,
        documents,
        embeddings,
        metadatas,
      });
      const pairs = ids.map((chunkId) => ({ chunkId, embeddingId: chunkId }));
      await tauriCommand('set_chunk_embedding_ids', { ids: pairs });
    },
  );

  if (queue.lastAborted) {
    await tauriCommand<Document>('update_document_status', {
      id: docId,
      status: 'error',
      errorMessage: '向量化已取消',
    });
    report({
      status: 'error',
      current_step: 'error',
      completed: 0,
      total: STEP_TOTAL,
      error_message: '向量化已取消',
    });
    throw new Error('向量化已取消');
  }

  const failedIds = chunksForQueue.filter((c) => !embMap.has(c.id)).map((c) => c.id);
  if (failedIds.length === created.length) {
    const msg = '全部分块向量化失败';
    await tauriCommand<Document>('update_document_status', {
      id: docId,
      status: 'error',
      errorMessage: msg,
    });
    report({
      status: 'error',
      current_step: 'error',
      completed: 0,
      total: STEP_TOTAL,
      error_message: msg,
    });
    throw new Error(msg);
  }

  const partialMsg =
    failedIds.length > 0 ? `部分分块向量化失败（${failedIds.length}/${created.length}）` : null;

  await tauriCommand<Document>('update_document_status', {
    id: docId,
    status: 'ready',
    errorMessage: partialMsg,
  });

  report({
    status: 'processing',
    current_step: 'complete',
    completed: STEP_TOTAL,
    total: STEP_TOTAL,
    embedding: {
      completed: created.length - failedIds.length,
      total: created.length,
      failedChunks: failedIds.length,
    },
    ...(partialMsg ? { error_message: partialMsg } : {}),
  });
}

export async function importAndChunkDocument(
  kb: KnowledgeBase,
  filePath: string,
  fileName: string,
  fileSize: number,
  onProgress: ProgressHandler,
): Promise<Document> {
  const fileType = getSupportedType(fileName);
  if (!fileType) {
    throw new Error('不支持的文件类型');
  }

  const raw = await readFile(filePath);
  const buffer = toArrayBuffer(raw);
  const contentHash = await computeContentHash(buffer);

  const dup = await tauriCommand<Document | null>('find_document_by_hash', {
    kbId: kb.id,
    contentHash,
  });
  if (dup) {
    throw new Error('该内容已在此知识库中存在（相同内容哈希）');
  }

  const doc = await tauriCommand<Document>('import_document', {
    kbId: kb.id,
    filePath,
    fileName,
    fileType,
    fileSize,
    contentHash,
  });
  const docId = doc.id;

  const report = (partial: {
    status: ImportProgress['status'];
    current_step: string;
    completed: number;
    total?: number;
    error_message?: string;
    embedding?: ImportProgress['embedding'];
  }) => {
    onProgress({
      document_id: docId,
      status: partial.status,
      current_step: partial.current_step,
      completed: partial.completed,
      total: partial.total ?? STEP_TOTAL,
      error_message: partial.error_message,
      embedding: partial.embedding,
    });
  };

  try {
    report({
      status: 'processing',
      current_step: 'parsing',
      completed: 1,
    });

    const { parsed, chunks } = await parseAndChunkDocument(
      buffer,
      fileName,
      fileType,
      kb.chunking_strategy,
      (step) => {
        report({
          status: 'processing',
          current_step: step === 'parsing' ? 'parsing' : 'chunking',
          completed: step === 'parsing' ? 1 : 2,
        });
      },
    );

    const previewContent = {
      ...parsed.content,
      sections: mergeSectionsForPreview(parsed.content.sections),
    };
    await saveDocumentSourceCache(docId, contentHash, previewContent);

    report({
      status: 'processing',
      current_step: 'saving_chunks',
      completed: 3,
    });

    const created = await tauriCommand<ChunkRow[]>('create_document_chunks', {
      payload: {
        documentId: docId,
        knowledgeBaseId: kb.id,
        chunks: chunks.map((c) => ({
          chunkIndex: c.chunk_index,
          content: c.content,
          tokenCount: c.token_count,
          charStart: c.char_start,
          charEnd: c.char_end,
          headingPath: c.heading_path,
          chunkType: c.chunk_type,
          metadata: c.metadata,
        })),
      },
    });

    await indexDocumentAfterChunks(kb, docId, fileName, created, report);

    return await tauriCommand<Document>('get_document', { id: docId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === '向量化已取消') {
      throw e;
    }
    await tauriCommand<Document>('update_document_status', {
      id: docId,
      status: 'error',
      errorMessage: msg,
    });
    report({
      status: 'error',
      current_step: 'error',
      completed: 0,
      error_message: msg,
    });
    throw e;
  }
}

export async function reprocessDocument(
  kb: KnowledgeBase,
  doc: Document,
  onProgress: ProgressHandler,
): Promise<Document> {
  const fileType = getSupportedType(doc.file_name);
  if (!fileType) {
    throw new Error('不支持的文件类型');
  }

  const raw = await readFile(doc.file_path);
  const buffer = toArrayBuffer(raw);
  const docId = doc.id;

  const report = (partial: {
    status: ImportProgress['status'];
    current_step: string;
    completed: number;
    total?: number;
    error_message?: string;
    embedding?: ImportProgress['embedding'];
  }) => {
    onProgress({
      document_id: docId,
      status: partial.status,
      current_step: partial.current_step,
      completed: partial.completed,
      total: partial.total ?? STEP_TOTAL,
      error_message: partial.error_message,
      embedding: partial.embedding,
    });
  };

  await tauriCommand<Document>('update_document_status', {
    id: docId,
    status: 'processing',
    errorMessage: null,
  });

  try {
    report({
      status: 'processing',
      current_step: 'parsing',
      completed: 1,
    });

    const { parsed, chunks } = await parseAndChunkDocument(
      buffer,
      doc.file_name,
      fileType,
      kb.chunking_strategy,
      (step) => {
        report({
          status: 'processing',
          current_step: step === 'parsing' ? 'parsing' : 'chunking',
          completed: step === 'parsing' ? 1 : 2,
        });
      },
    );

    const previewContent = {
      ...parsed.content,
      sections: mergeSectionsForPreview(parsed.content.sections),
    };
    await saveDocumentSourceCache(docId, doc.content_hash, previewContent);

    report({
      status: 'processing',
      current_step: 'saving_chunks',
      completed: 3,
    });

    const prevChunks = await tauriCommand<{ embedding_id: string }[]>('list_document_chunks', {
      documentId: docId,
    });
    const oldEmbIds = prevChunks.map((c) => c.embedding_id).filter((e) => e.length > 0);
    if (oldEmbIds.length > 0) {
      try {
        await tauriCommand('chromadb_delete_documents', {
          knowledgeBaseId: kb.id,
          ids: oldEmbIds,
        });
      } catch {
        /* Chroma 不可用时仍继续 */
      }
    }

    const created = await tauriCommand<ChunkRow[]>('create_document_chunks', {
      payload: {
        documentId: docId,
        knowledgeBaseId: kb.id,
        chunks: chunks.map((c) => ({
          chunkIndex: c.chunk_index,
          content: c.content,
          tokenCount: c.token_count,
          charStart: c.char_start,
          charEnd: c.char_end,
          headingPath: c.heading_path,
          chunkType: c.chunk_type,
          metadata: c.metadata,
        })),
      },
    });

    await indexDocumentAfterChunks(kb, docId, doc.file_name, created, report);

    return await tauriCommand<Document>('get_document', { id: docId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === '向量化已取消') {
      throw e;
    }
    await tauriCommand<Document>('update_document_status', {
      id: docId,
      status: 'error',
      errorMessage: msg,
    });
    report({
      status: 'error',
      current_step: 'error',
      completed: 0,
      error_message: msg,
    });
    throw e;
  }
}
