import type { RerankedResult } from './reranker';

export type LlmCompleteFn = (
  messages: Array<{ role: string; content: string }>,
) => Promise<string>;

const SYSTEM = `你是检索重排助手。根据用户问题，对候选文档片段按相关性从高到低排序。
只输出 JSON 数组，元素为 chunk_id 字符串，不要输出其它文字。
必须包含且仅包含输入中出现过的 chunk_id，不要编造 id。`;

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('LLM rerank response is not JSON array');
  }
}

/**
 * Listwise LLM rerank. Fail-open: on any error or incomplete id set, return `candidates` unchanged.
 */
export async function llmRerank(
  candidates: RerankedResult[],
  query: string,
  complete: LlmCompleteFn,
): Promise<RerankedResult[]> {
  if (candidates.length <= 1) return candidates;

  const byId = new Map(candidates.map((c) => [c.chunk_id, c]));
  const payload = candidates.map((c, i) => ({
    chunk_id: c.chunk_id,
    rank_hint: i + 1,
    file_name: c.file_name,
    heading_path: c.heading_path,
    preview: c.content.slice(0, 280),
  }));

  try {
    const raw = await complete([
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: `问题：${query}\n\n候选：\n${JSON.stringify(payload)}`,
      },
    ]);
    const parsed = extractJsonArray(raw);
    if (!Array.isArray(parsed)) return candidates;

    const orderedIds = parsed.filter((x): x is string => typeof x === 'string');
    const seen = new Set<string>();
    const ordered: RerankedResult[] = [];
    for (const id of orderedIds) {
      if (seen.has(id)) continue;
      const row = byId.get(id);
      if (!row) continue;
      seen.add(id);
      ordered.push(row);
    }

    // Append any missing candidates in original order (partial LLM output)
    for (const c of candidates) {
      if (!seen.has(c.chunk_id)) ordered.push(c);
    }

    if (ordered.length === 0) return candidates;
    return ordered;
  } catch {
    return candidates;
  }
}
