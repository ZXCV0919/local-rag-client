/**
 * Offline retrieval eval (no Ollama / Chroma / Tauri).
 * Mode: bag-of-words cosine (mock vector) + term overlap (mock keyword)
 * then real `rerank` + `shouldDeclineAnswerDueToWeakEvidence`.
 *
 * Run: npm run eval:retrieval
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarkdownParser } from '../src/services/parser/markdown';
import { chunkDocument } from '../src/services/chunker';
import { FALLBACK_CHUNKING_STRATEGY } from '../src/types/knowledge-base';
import { chunkerConfigFromStrategy } from '../src/services/chunker/types';
import { rerank, type RerankedResult } from '../src/services/retrieval/reranker';
import type { VectorSearchResult } from '../src/services/retrieval/vector-search';
import type { KeywordSearchResult } from '../src/services/retrieval/keyword-search';
import { shouldDeclineAnswerDueToWeakEvidence } from '../src/services/retrieval/relevance-gate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname);
const FIXTURES = join(ROOT, 'fixtures', 'mini-kb');
const GOLDEN_PATH = join(ROOT, 'golden.json');
const RESULTS_PATH = join(ROOT, 'RESULTS.md');
const K = 5;

interface GoldenCase {
  id: string;
  query: string;
  must_contain: string | null;
  expect_decline: boolean;
}

interface GoldenFile {
  version: number;
  mode_note: string;
  cases: GoldenCase[];
}

interface IndexedChunk {
  chunk_id: string;
  document_id: string;
  file_name: string;
  content: string;
  heading_path: string;
  tokens: Map<string, number>;
}

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const ascii = lower.match(/[a-z0-9][a-z0-9._:-]*/g) ?? [];
  const cjkRuns = lower.match(/[\u4e00-\u9fff]+/g) ?? [];
  const cjkTokens: string[] = [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      cjkTokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      cjkTokens.push(run.slice(i, i + 2));
    }
  }
  return [...ascii, ...cjkTokens];
}

function toBag(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  if (na === 0 || nb === 0) return 0;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (vb) dot += va * vb;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function keywordScore(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0) return 0;
  const lower = content.toLowerCase();
  let hits = 0;
  for (const t of queryTokens) {
    if (lower.includes(t)) hits += 1;
  }
  return hits / queryTokens.length;
}

async function buildIndex(): Promise<IndexedChunk[]> {
  const parser = new MarkdownParser();
  const config = chunkerConfigFromStrategy(FALLBACK_CHUNKING_STRATEGY);
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.md'));
  const indexed: IndexedChunk[] = [];

  for (const file of files) {
    const buf = readFileSync(join(FIXTURES, file));
    const parsed = await parser.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), file);
    const chunks = chunkDocument(parsed.content, config);
    const docId = file.replace(/\.md$/, '');
    chunks.forEach((c, i) => {
      indexed.push({
        chunk_id: `${docId}#${i}`,
        document_id: docId,
        file_name: file,
        content: c.content,
        heading_path: c.heading_path,
        tokens: toBag(tokenize(c.content)),
      });
    });
  }
  return indexed;
}

function retrieveOffline(
  index: IndexedChunk[],
  query: string,
  limit = 20,
): { vector: VectorSearchResult[]; keyword: KeywordSearchResult[]; maxVec: number; kwCount: number } {
  const qTokens = tokenize(query);
  const qBag = toBag(qTokens);

  const vector = index
    .map((c) => ({
      chunk_id: c.chunk_id,
      document_id: c.document_id,
      content: c.content,
      heading_path: c.heading_path,
      file_name: c.file_name,
      score: cosine(qBag, c.tokens),
      metadata: { chunk_type: 'paragraph' },
    }))
    .filter((r) => r.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const keyword = index
    .map((c) => {
      const score = keywordScore(qTokens, c.content);
      return {
        chunk_id: c.chunk_id,
        document_id: c.document_id,
        knowledge_base_id: 'eval',
        content: c.content,
        heading_path: c.heading_path,
        chunk_type: 'paragraph',
        score,
        file_name: c.file_name,
      } satisfies KeywordSearchResult;
    })
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const maxVec = vector.length ? vector[0]!.score : 0;
  return { vector, keyword, maxVec, kwCount: keyword.length };
}

function hitAtK(results: RerankedResult[], must: string | null, k: number): boolean {
  if (!must) return false;
  return results.slice(0, k).some((r) => r.content.includes(must));
}

function reciprocalRank(results: RerankedResult[], must: string | null): number {
  if (!must) return 0;
  const idx = results.findIndex((r) => r.content.includes(must));
  return idx >= 0 ? 1 / (idx + 1) : 0;
}

async function main() {
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as GoldenFile;
  const index = await buildIndex();
  console.log(`Indexed ${index.length} chunks from ${FIXTURES}`);

  let hit = 0;
  let hitDenom = 0;
  let mrrSum = 0;
  let declineTp = 0;
  let declineFp = 0;
  let declineFn = 0;
  let declineTn = 0;
  const rows: string[] = [];

  for (const c of golden.cases) {
    const { vector, keyword, maxVec, kwCount } = retrieveOffline(index, c.query);
    const ranked = rerank(vector, keyword, c.query, {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
      maxResults: K,
    });
    const declined = shouldDeclineAnswerDueToWeakEvidence({
      chunks: ranked,
      mode: 'hybrid',
      maxVectorSimilarity: maxVec || null,
      keywordCandidateCount: kwCount,
    });

    if (c.expect_decline) {
      if (declined) declineTp += 1;
      else declineFn += 1;
    } else {
      if (declined) declineFp += 1;
      else declineTn += 1;
      hitDenom += 1;
      const ok = hitAtK(ranked, c.must_contain, K);
      if (ok) hit += 1;
      mrrSum += reciprocalRank(ranked, c.must_contain);
    }

    const status = c.expect_decline
      ? declined
        ? 'DECLINE_OK'
        : 'DECLINE_MISS'
      : declined
        ? 'FALSE_DECLINE'
        : hitAtK(ranked, c.must_contain, K)
          ? 'HIT'
          : 'MISS';

    rows.push(
      `| ${c.id} | ${c.expect_decline ? 'yes' : 'no'} | ${status} | ${ranked[0]?.file_name ?? '—'} |`,
    );
    console.log(`${status.padEnd(14)} ${c.id}`);
  }

  const hitAt5 = hitDenom ? hit / hitDenom : 0;
  const mrr = hitDenom ? mrrSum / hitDenom : 0;
  const declinePrecision = declineTp + declineFp ? declineTp / (declineTp + declineFp) : 0;
  const declineRecall = declineTp + declineFn ? declineTp / (declineTp + declineFn) : 0;

  const md = `# Retrieval eval results (baseline)

**Mode:** ${golden.mode_note}

**Date:** ${new Date().toISOString().slice(0, 10)}

**Fixture chunks:** ${index.length}

| Metric | Value |
|--------|-------|
| Hit@${K} | ${(hitAt5 * 100).toFixed(1)}% (${hit}/${hitDenom}) |
| MRR | ${mrr.toFixed(3)} |
| Decline precision | ${(declinePrecision * 100).toFixed(1)}% |
| Decline recall | ${(declineRecall * 100).toFixed(1)}% |
| Cases | ${golden.cases.length} |

## Per-case

| id | expect_decline | status | top_file |
|----|----------------|--------|----------|
${rows.join('\n')}

## Notes

- This is an **offline mock-vector** harness for regression / interview demos, not a substitute for production Chroma+Ollama eval.
- Re-run with \`npm run eval:retrieval\` after changing \`rerank\` / \`relevance-gate\`.
`;

  writeFileSync(RESULTS_PATH, md, 'utf8');
  console.log('\n' + md);
  console.log(`Wrote ${RESULTS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
