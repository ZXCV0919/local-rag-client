/**
 * Live small-sample retrieval eval (needs local Ollama).
 * - Real nomic-embed-text embeddings over HTTP
 * - Keyword lane: term-overlap (same family as offline harness)
 * - Fusion: production `rerank` (weighted RRF)
 * - Optional second stage: production `llmRerank` via Ollama chat
 * - Gate: production `shouldDeclineAnswerDueToWeakEvidence`
 *
 * Does NOT require Tauri/Chroma — vectors are kept in-memory after embed.
 * This measures embedding+fusion+gate quality on the fixed mini-kb fixture.
 *
 * Run: npm run eval:retrieval:live
 * Env: OLLAMA_URL (default http://127.0.0.1:11434)
 *      EMBED_MODEL (default nomic-embed-text)
 *      CHAT_MODEL (default qwen2.5:7b) — used only for LLM rerank comparison
 *      SKIP_LLM_RERANK=1 — only run RRF baseline
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarkdownParser } from '../src/services/parser/markdown';
import { chunkDocument } from '../src/services/chunker';
import { FALLBACK_CHUNKING_STRATEGY } from '../src/types/knowledge-base';
import { chunkerConfigFromStrategy } from '../src/services/chunker/types';
import {
  formatTextForDocumentEmbedding,
  formatTextForQueryEmbedding,
} from '../src/services/embedding';
import { rerank, type RerankedResult } from '../src/services/retrieval/reranker';
import { llmRerank } from '../src/services/retrieval/llm-rerank';
import type { VectorSearchResult } from '../src/services/retrieval/vector-search';
import type { KeywordSearchResult } from '../src/services/retrieval/keyword-search';
import { shouldDeclineAnswerDueToWeakEvidence } from '../src/services/retrieval/relevance-gate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname);
const FIXTURES = join(ROOT, 'fixtures', 'mini-kb');
const GOLDEN_PATH = join(ROOT, 'golden.json');
const RESULTS_PATH = join(ROOT, 'LIVE_RESULTS.md');
const K = 5;

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const CHAT_MODEL = process.env.CHAT_MODEL || 'qwen2.5:7b';
const SKIP_LLM = process.env.SKIP_LLM_RERANK === '1';

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
  embedding: number[];
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

function cosineVec(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
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

async function ollamaEmbed(texts: string[], model: string): Promise<number[][]> {
  // Prefer /api/embed (batch); fall back to /api/embeddings per text.
  const embedResp = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
  });
  if (embedResp.ok) {
    const data = (await embedResp.json()) as { embeddings?: number[][] };
    if (data.embeddings && data.embeddings.length === texts.length) {
      return data.embeddings;
    }
  }

  const out: number[][] = [];
  for (const prompt of texts) {
    const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt }),
    });
    if (!r.ok) {
      throw new Error(`Ollama embed failed (${r.status}): ${await r.text()}`);
    }
    const data = (await r.json()) as { embedding?: number[] };
    out.push(data.embedding ?? []);
  }
  return out;
}

async function ollamaChatComplete(
  messages: Array<{ role: string; content: string }>,
  model: string,
): Promise<string> {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: { temperature: 0, num_predict: 256 },
    }),
  });
  if (!r.ok) {
    throw new Error(`Ollama chat failed (${r.status}): ${await r.text()}`);
  }
  const data = (await r.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? '';
}

async function assertOllama(): Promise<void> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    throw new Error(
      `无法连接 Ollama（${OLLAMA_URL}）。请先启动 Ollama 并拉取模型：\n` +
        `  ollama pull ${EMBED_MODEL}\n` +
        (SKIP_LLM ? '' : `  ollama pull ${CHAT_MODEL}\n`) +
        `原始错误: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

async function buildIndex(): Promise<IndexedChunk[]> {
  const parser = new MarkdownParser();
  const config = chunkerConfigFromStrategy(FALLBACK_CHUNKING_STRATEGY);
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.md'));
  const pending: Omit<IndexedChunk, 'embedding'>[] = [];

  for (const file of files) {
    const buf = readFileSync(join(FIXTURES, file));
    const parsed = await parser.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      file,
    );
    const chunks = chunkDocument(parsed.content, config);
    const docId = file.replace(/\.md$/, '');
    chunks.forEach((c, i) => {
      pending.push({
        chunk_id: `${docId}#${i}`,
        document_id: docId,
        file_name: file,
        content: c.content,
        heading_path: c.heading_path,
      });
    });
  }

  const prepared = pending.map((c) => formatTextForDocumentEmbedding(c.content, EMBED_MODEL));
  console.log(`Embedding ${prepared.length} chunks with ${EMBED_MODEL}…`);
  const vectors = await ollamaEmbed(prepared, EMBED_MODEL);
  return pending.map((c, i) => ({ ...c, embedding: vectors[i] ?? [] }));
}

function retrieveLanes(index: IndexedChunk[], query: string, queryEmbedding: number[], limit = 20) {
  const qTokens = tokenize(query);
  const vector: VectorSearchResult[] = index
    .map((c) => ({
      chunk_id: c.chunk_id,
      document_id: c.document_id,
      content: c.content,
      heading_path: c.heading_path,
      file_name: c.file_name,
      score: cosineVec(queryEmbedding, c.embedding),
      metadata: { chunk_type: 'paragraph' },
    }))
    .filter((r) => r.score > 0.28)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const keyword: KeywordSearchResult[] = index
    .map((c) => {
      const score = keywordScore(qTokens, c.content);
      return {
        chunk_id: c.chunk_id,
        document_id: c.document_id,
        knowledge_base_id: 'eval-live',
        content: c.content,
        heading_path: c.heading_path,
        chunk_type: 'paragraph',
        score,
        file_name: c.file_name,
      } satisfies KeywordSearchResult;
    })
    .filter((r) => r.score > 0.25)
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

interface ModeStats {
  hit: number;
  hitDenom: number;
  mrrSum: number;
  declineTp: number;
  declineFp: number;
  declineFn: number;
  rows: string[];
}

function emptyStats(): ModeStats {
  return { hit: 0, hitDenom: 0, mrrSum: 0, declineTp: 0, declineFp: 0, declineFn: 0, rows: [] };
}

function recordCase(
  stats: ModeStats,
  c: GoldenCase,
  ranked: RerankedResult[],
  declined: boolean,
  label: string,
) {
  if (c.expect_decline) {
    if (declined) stats.declineTp += 1;
    else stats.declineFn += 1;
  } else {
    if (declined) stats.declineFp += 1;
    stats.hitDenom += 1;
    if (!declined) {
      if (hitAtK(ranked, c.must_contain, K)) stats.hit += 1;
      stats.mrrSum += reciprocalRank(ranked, c.must_contain);
    }
  }

  const status = c.expect_decline
    ? declined
      ? '拒答正确'
      : '拒答失败'
    : declined
      ? '误拒答'
      : hitAtK(ranked, c.must_contain, K)
        ? '命中'
        : '未命中';

  stats.rows.push(
    `| ${c.id} | ${c.expect_decline ? '是' : '否'} | ${status} | ${ranked[0]?.file_name ?? '—'} |`,
  );
  console.log(`[${label}] ${status.padEnd(8)} ${c.id}`);
}

function summarize(stats: ModeStats) {
  const hitAt5 = stats.hitDenom ? stats.hit / stats.hitDenom : 0;
  const mrr = stats.hitDenom ? stats.mrrSum / stats.hitDenom : 0;
  const declinePrecision =
    stats.declineTp + stats.declineFp
      ? stats.declineTp / (stats.declineTp + stats.declineFp)
      : 0;
  const declineRecall =
    stats.declineTp + stats.declineFn
      ? stats.declineTp / (stats.declineTp + stats.declineFn)
      : 0;
  return { hitAt5, mrr, declinePrecision, declineRecall };
}

async function main() {
  await assertOllama();
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as GoldenFile;
  const index = await buildIndex();
  console.log(`Indexed ${index.length} chunks with live embeddings`);

  const rrf = emptyStats();
  const llm = emptyStats();
  let llmErrors = 0;

  for (const c of golden.cases) {
    const qPrepared = formatTextForQueryEmbedding(c.query, EMBED_MODEL);
    const [qEmb] = await ollamaEmbed([qPrepared], EMBED_MODEL);
    const { vector, keyword, maxVec, kwCount } = retrieveLanes(index, c.query, qEmb ?? []);

    const candidatePool = Math.min(18, Math.max(K * 3, K));
    const rrfRanked = rerank(vector, keyword, c.query, {
      vectorWeight: 0.7,
      keywordWeight: 0.3,
      maxResults: candidatePool,
    });
    const rrfTop = rrfRanked.slice(0, K);
    const rrfDeclined = shouldDeclineAnswerDueToWeakEvidence({
      chunks: rrfTop,
      mode: 'hybrid',
      maxVectorSimilarity: maxVec || null,
      keywordCandidateCount: kwCount,
    });
    recordCase(rrf, c, rrfTop, rrfDeclined, 'RRF');

    if (!SKIP_LLM) {
      let llmTop = rrfTop;
      try {
        const ordered = await llmRerank(rrfRanked, c.query, (messages) =>
          ollamaChatComplete(messages, CHAT_MODEL),
        );
        llmTop = ordered.slice(0, K);
      } catch (e) {
        llmErrors += 1;
        console.warn(`LLM rerank failed for ${c.id}:`, e instanceof Error ? e.message : e);
        llmTop = rrfTop;
      }
      const llmDeclined = shouldDeclineAnswerDueToWeakEvidence({
        chunks: llmTop,
        mode: 'hybrid',
        maxVectorSimilarity: maxVec || null,
        keywordCandidateCount: kwCount,
      });
      recordCase(llm, c, llmTop, llmDeclined, 'LLM');
    }
  }

  const rrfS = summarize(rrf);
  const llmS = SKIP_LLM ? null : summarize(llm);
  const now = new Date().toISOString().slice(0, 10);

  const cmpTable = llmS
    ? `| 指标 | RRF（默认） | RRF → LLM 重排 |
|------|-------------|----------------|
| Hit@${K}（前${K}命中率） | ${(rrfS.hitAt5 * 100).toFixed(1)}% (${rrf.hit}/${rrf.hitDenom}) | ${(llmS.hitAt5 * 100).toFixed(1)}% (${llm.hit}/${llm.hitDenom}) |
| MRR（平均倒数排名） | ${rrfS.mrr.toFixed(3)} | ${llmS.mrr.toFixed(3)} |
| 拒答精确率 | ${(rrfS.declinePrecision * 100).toFixed(1)}% | ${(llmS.declinePrecision * 100).toFixed(1)}% |
| 拒答召回率 | ${(rrfS.declineRecall * 100).toFixed(1)}% | ${(llmS.declineRecall * 100).toFixed(1)}% |
`
    : `| 指标 | RRF（默认） |
|------|-------------|
| Hit@${K}（前${K}命中率） | ${(rrfS.hitAt5 * 100).toFixed(1)}% (${rrf.hit}/${rrf.hitDenom}) |
| MRR（平均倒数排名） | ${rrfS.mrr.toFixed(3)} |
| 拒答精确率 | ${(rrfS.declinePrecision * 100).toFixed(1)}% |
| 拒答召回率 | ${(rrfS.declineRecall * 100).toFixed(1)}% |
`;

  const md = `# 真实检索评测结果（小样本）

**评测方式：** 真 Ollama 嵌入（\`${EMBED_MODEL}\`）+ 关键词重叠 + 线上同款 \`rerank\` / 相关度门控${
    SKIP_LLM ? '' : `；可选 LLM 重排（\`${CHAT_MODEL}\`）`
  }

**日期：** ${now}

**Ollama 地址：** ${OLLAMA_URL}

**固定语料块数：** ${index.length}（\`evals/fixtures/mini-kb\` = 小样本知识库）

**题目数：** ${golden.cases.length}

## 对比表

${cmpTable}
${llmErrors ? `\nLLM 重排软失败（已回退到 RRF 顺序）：${llmErrors} 次\n` : ''}
## 面试怎么讲

- 这是**真嵌入向量**小样本评测，不经过 Tauri/Chroma；关键词腿用词项重叠，用来复现 hybrid 融合逻辑。
- 和 \`npm run eval:retrieval\`（假向量 / CI 回归）互补：假向量保证改代码不回归；本报告证明真嵌入空间上的 Hit@K。
- 产品默认走 RRF；LLM 列表重排更慢，设置里开关，失败则 fail-open（退回 RRF）。
- 小样本容易「打满分」导致 Hit@5 / MRR 两边一样；对比表的价值是：开 LLM 重排不会破坏命中，并方便谈延迟/成本。拒答题用远离产品语料的域外问题，避免假相关。

## 逐题 · RRF

| 题号 | 期望拒答 | 结果 | 排名第一的文件 |
|------|----------|------|----------------|
${rrf.rows.join('\n')}

${
  llmS
    ? `## 逐题 · LLM 重排

| 题号 | 期望拒答 | 结果 | 排名第一的文件 |
|------|----------|------|----------------|
${llm.rows.join('\n')}
`
    : ''
}

## 如何重跑

\`\`\`bash
# 需本机 Ollama，并已 pull 模型
ollama pull ${EMBED_MODEL}
${SKIP_LLM ? '' : `ollama pull ${CHAT_MODEL}\n`}npm run eval:retrieval:live

# 只跑 RRF（不跑 LLM 重排）
SKIP_LLM_RERANK=1 npm run eval:retrieval:live
\`\`\`
`;

  writeFileSync(RESULTS_PATH, md, 'utf8');
  console.log('\n' + md);
  console.log(`Wrote ${RESULTS_PATH}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
