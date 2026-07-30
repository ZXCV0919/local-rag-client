import { invoke } from '@tauri-apps/api/core';

/** Nomic 在训练时使用非对称前缀；分块入库需用 `search_document:`，检索查询需用 `search_query:`，否则语义相关度会明显偏弱。 */
function useNomicRetrievalPrefixes(model: string): boolean {
  return model.toLowerCase().includes('nomic-embed');
}

export function formatTextForDocumentEmbedding(text: string, model: string): string {
  const t = text.trim();
  if (!t) return text;
  if (!useNomicRetrievalPrefixes(model)) return text;
  return `search_document: ${t}`;
}

export function formatTextForQueryEmbedding(text: string, model: string): string {
  const t = text.trim();
  if (!t) return text;
  if (!useNomicRetrievalPrefixes(model)) return text;
  return `search_query: ${t}`;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export async function getEmbeddings(
  texts: string[],
  model: string,
  ollamaUrl?: string | null,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return invoke<number[][]>('ollama_embed_batch', {
    model,
    texts,
    ollamaUrl: ollamaUrl ?? null,
  });
}

export async function getEmbedding(
  text: string,
  model = 'nomic-embed-text',
  ollamaUrl?: string | null,
): Promise<EmbeddingResult> {
  const embeddings = await getEmbeddings([text], model, ollamaUrl);
  const embedding = embeddings[0] ?? [];
  return { embedding, model };
}

/** 检索用查询向量（对 Nomic 自动加 `search_query:`）。 */
export async function getQueryEmbedding(
  text: string,
  model = 'nomic-embed-text',
  ollamaUrl?: string | null,
): Promise<EmbeddingResult> {
  const prepared = formatTextForQueryEmbedding(text, model);
  const embeddings = await getEmbeddings([prepared], model, ollamaUrl);
  const embedding = embeddings[0] ?? [];
  return { embedding, model };
}
