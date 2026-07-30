import { tauriCommand } from '../../hooks/useDatabase';

export interface VectorSearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  heading_path: string;
  file_name: string;
  score: number;
  metadata: Record<string, string>;
}

export interface ChromaQueryPayload {
  ids: string[];
  documents: string[];
  metadatas: unknown[];
  distances: number[];
}

function metadataRecord(meta: unknown): Record<string, string> {
  if (meta == null || typeof meta !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/** Heuristic: cosine-style distance usually in [0, ~2]; L2 / other metrics often > 1 for top hits. */
function distancesToSimilarities(distances: number[]): number[] {
  if (distances.length === 0) return [];
  const finite = distances.filter((d) => Number.isFinite(d));
  const maxD = finite.length > 0 ? Math.max(...finite.map((d) => Math.abs(d))) : 0;
  if (maxD <= 1.05) {
    return distances.map((d) => (Number.isFinite(d) ? 1 - d : 0));
  }
  return distances.map((d) => (Number.isFinite(d) ? 1 / (1 + Math.abs(d)) : 0));
}

export async function vectorSearch(
  knowledgeBaseId: string,
  queryEmbedding: number[],
  nResults = 20,
): Promise<VectorSearchResult[]> {
  const raw = await tauriCommand<ChromaQueryPayload>('chromadb_query', {
    knowledgeBaseId,
    queryEmbedding,
    nResults,
  });

  const n = raw.ids?.length ?? 0;
  const sims = distancesToSimilarities(
    Array.from({ length: n }, (_, i) => raw.distances[i] ?? 0),
  );
  const results: VectorSearchResult[] = [];
  for (let i = 0; i < n; i++) {
    const meta = metadataRecord(raw.metadatas[i]);
    results.push({
      chunk_id: raw.ids[i] ?? '',
      document_id: meta.document_id ?? '',
      content: raw.documents[i] ?? '',
      heading_path: meta.heading_path ?? '',
      file_name: meta.file_name ?? '',
      score: sims[i] ?? 0,
      metadata: meta,
    });
  }
  return results;
}
