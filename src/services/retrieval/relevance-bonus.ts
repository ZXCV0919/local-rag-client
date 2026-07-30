/**
 * 显式文本相关性加权：弥补纯向量在「主题关键词」上的漂移（例如搜 Linux 却先出 Makefile/HTTP）。
 */

type SegmenterLike = {
  segment: (input: string) => Iterable<{ segment: string; isWordLike?: boolean }>;
};

function getIntlSegmenter(): SegmenterLike | null {
  if (typeof Intl === 'undefined') return null;
  const Ctor = (Intl as unknown as { Segmenter?: new (loc?: string, opt?: { granularity: string }) => SegmenterLike })
    .Segmenter;
  if (typeof Ctor !== 'function') return null;
  try {
    return new Ctor(undefined, { granularity: 'word' });
  } catch {
    return null;
  }
}

/** 与检索排序共用的查询词集合（小写、已清洗）。 */
export function queryTermsFromUserQuery(query: string): Set<string> {
  const terms: string[] = [];
  const segmenter = getIntlSegmenter();
  if (segmenter) {
    try {
      for (const part of segmenter.segment(query.toLowerCase())) {
        if (part.isWordLike === false) continue;
        const t = part.segment.replace(/[^\p{L}\p{N}_]+/gu, '');
        if (t) terms.push(t);
      }
    } catch {
      /* continue */
    }
  }
  if (terms.length === 0) {
    for (const t of query.toLowerCase().split(/\s+/)) {
      const w = t.replace(/[^\p{L}\p{N}_]+/gu, '');
      if (w) terms.push(w);
    }
  }
  if (terms.length === 0) {
    for (const ch of query.toLowerCase()) {
      if (/[\p{L}\p{N}]/u.test(ch)) terms.push(ch);
    }
  }
  return new Set(terms);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    n += 1;
    i += needle.length;
  }
  return n;
}

/**
 * 加到 `final_score` 上的 bonus（文件名命中查询时明显压过无关向量片段）。
 */
export function lexicalRelevanceBoost(
  query: string,
  fileName: string,
  headingPath: string,
  content: string,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const fn = fileName.toLowerCase();
  const hd = headingPath.toLowerCase();
  const body = content.toLowerCase();

  let bonus = 0;

  if (fn.includes(q)) {
    bonus += 0.42;
  }
  if (hd.includes(q)) {
    bonus += 0.14;
  }
  if (body.includes(q)) {
    bonus += 0.06 + Math.min(0.14, 0.028 * countOccurrences(body, q));
  }

  const terms = queryTermsFromUserQuery(query);
  if (terms.size > 0) {
    let inFn = 0;
    let inHd = 0;
    let inBody = 0;
    for (const t of terms) {
      if (fn.includes(t)) inFn++;
      if (hd.includes(t)) inHd++;
      if (body.includes(t)) inBody++;
    }
    bonus += 0.22 * (inFn / terms.size);
    bonus += 0.1 * (inHd / terms.size);
    bonus += 0.04 * (inBody / terms.size);
  }

  return bonus;
}
