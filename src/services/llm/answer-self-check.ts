import type { RerankedResult } from '../retrieval/reranker';
import { chatCompleteUnified, type ChatRequestConfig } from './chat-provider';

const MAX_DIGEST_CHARS = 4500;
const MAX_ANSWER_CHARS = 3200;
const MAX_QUERY_CHARS = 800;

function buildReferenceDigest(refs: RerankedResult[]): string {
  const parts = refs.map((ref, i) => {
    const header = `[${ref.file_name}#${i + 1}]`;
    const body = ref.content.replace(/\s+/g, ' ').trim();
    return `${header}\n${body}`;
  });
  let joined = parts.join('\n\n');
  if (joined.length > MAX_DIGEST_CHARS) {
    joined = `${joined.slice(0, MAX_DIGEST_CHARS)}\n…`;
  }
  return joined;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface GroundednessVerdict {
  grounded: boolean;
  /** Short Chinese explanation when grounded is false */
  reason?: string;
}

/**
 * Second-pass lightweight check: asks the model whether the answer stays within retrieved refs.
 * Parses strict JSON; on failure defaults to grounded=true (fail-open).
 */
export async function evaluateAnswerGroundedness(params: {
  config: ChatRequestConfig;
  userQuery: string;
  references: RerankedResult[];
  assistantAnswer: string;
  signal?: AbortSignal;
}): Promise<GroundednessVerdict> {
  const { config, userQuery, references, assistantAnswer, signal } = params;

  const digest = buildReferenceDigest(references);
  const qTrim = userQuery.trim();
  const q = qTrim.length > MAX_QUERY_CHARS ? `${qTrim.slice(0, MAX_QUERY_CHARS)}…` : qTrim;
  const ans =
    assistantAnswer.trim().length > MAX_ANSWER_CHARS
      ? `${assistantAnswer.trim().slice(0, MAX_ANSWER_CHARS)}…`
      : assistantAnswer.trim();

  const checkerSystem = `你是答案质检助手，只做一件事：判断「助手回答」中的实质性内容能否由「参考资料」支持。
规则：
- 若回答包含参考资料未提及的具体事实、数字、结论或外部知识，判 grounded=false
- 若回答主要为「资料不足 / 无法回答」且未编造，判 grounded=true
- 合理归纳、复述资料内的内容，判 grounded=true
仅输出一行合法 JSON，不要其它文字：{"grounded":true} 或 {"grounded":false,"reason":"不超过40字的中文理由"}`;

  const checkerUser = `## 参考资料\n${digest}\n\n## 用户问题\n${q}\n\n## 助手回答\n${ans}`;

  let raw = '';
  try {
    raw = await chatCompleteUnified(
      [
        { role: 'system', content: checkerSystem },
        { role: 'user', content: checkerUser },
      ],
      { ...config, signal },
    );
  } catch {
    return { grounded: true };
  }

  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed.grounded !== 'boolean') {
    return { grounded: true };
  }

  const grounded = parsed.grounded;
  let reason: string | undefined;
  if (!grounded && typeof parsed.reason === 'string') {
    reason = parsed.reason.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  return { grounded, reason };
}
