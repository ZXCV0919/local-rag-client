import { formatTextForDocumentEmbedding, getEmbeddings } from './index';

export interface BatchEmbeddingProgress {
  completed: number;
  total: number;
  failedChunks: string[];
}

let activeQueue: EmbeddingBatchQueue | null = null;

export function cancelActiveEmbedding(): void {
  activeQueue?.cancel();
}

export class EmbeddingBatchQueue {
  readonly batchSize: number;
  private readonly maxRetries: number;
  private abortController: AbortController | null = null;
  lastAborted = false;

  constructor(batchSize = 5, maxRetries = 3) {
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;
  }

  cancel(): void {
    this.abortController?.abort();
  }

  async processBatch(
    chunks: Array<{ id: string; content: string }>,
    model: string,
    ollamaUrl: string | null | undefined,
    onProgress?: (progress: BatchEmbeddingProgress) => void,
    onBatchEmbedded?: (batch: { ids: string[]; embeddings: number[][] }) => Promise<void>,
  ): Promise<Map<string, number[]>> {
    this.abortController = new AbortController();
    this.lastAborted = false;
    activeQueue = this;
    const result = new Map<string, number[]>();
    const failedChunks: string[] = [];
    const total = chunks.length;

    try {
      for (let i = 0; i < chunks.length; i += this.batchSize) {
        if (this.abortController.signal.aborted) break;

        const batch = chunks.slice(i, i + this.batchSize);
        const texts = batch.map((c) => formatTextForDocumentEmbedding(c.content, model));
        const ids = batch.map((c) => c.id);

        let embeddings: number[][] | null = null;
        for (let retry = 0; retry < this.maxRetries; retry++) {
          try {
            embeddings = await getEmbeddings(texts, model, ollamaUrl);
            if (embeddings.length !== texts.length) {
              throw new Error('嵌入结果数量与文本批次不一致');
            }
            break;
          } catch {
            if (retry === this.maxRetries - 1) {
              failedChunks.push(...ids);
              break;
            }
            await new Promise((r) => setTimeout(r, Math.pow(2, retry) * 1000));
          }
        }

        if (embeddings) {
          for (let j = 0; j < ids.length; j++) {
            result.set(ids[j], embeddings[j]);
          }
          if (onBatchEmbedded) {
            await onBatchEmbedded({ ids, embeddings });
          }
        }

        const completed = Math.min(i + batch.length, total);
        onProgress?.({ completed, total, failedChunks: [...failedChunks] });
      }
    } finally {
      this.lastAborted = this.abortController?.signal.aborted ?? false;
      activeQueue = null;
    }

    return result;
  }
}
