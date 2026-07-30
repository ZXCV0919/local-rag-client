import { tauriCommand } from '../../hooks/useDatabase';

export interface KeywordSearchResult {
  chunk_id: string;
  document_id: string;
  knowledge_base_id: string;
  content: string;
  heading_path: string;
  chunk_type: string;
  score: number;
  file_name: string;
}

export async function keywordSearch(
  kbId: string,
  query: string,
  limit = 20,
): Promise<KeywordSearchResult[]> {
  return tauriCommand<KeywordSearchResult[]>('search_keyword', {
    kbId,
    query,
    limit,
  });
}
