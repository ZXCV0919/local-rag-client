import type { RerankedResult } from '../retrieval/reranker';
import { estimateTokenCount } from '../../utils/token-counter';

export interface ContextWindowConfig {
  maxContextTokens: number;
  systemPromptRatio: number;
  referenceRatio: number;
  historyRatio: number;
  queryRatio: number;
  maxHistoryRounds: number;
}

export const DEFAULT_CONTEXT_CONFIG: ContextWindowConfig = {
  maxContextTokens: 8192,
  systemPromptRatio: 0.1,
  referenceRatio: 0.6,
  historyRatio: 0.2,
  queryRatio: 0.1,
  maxHistoryRounds: 6,
};

export function allocateContextBudget(config: ContextWindowConfig): {
  systemBudget: number;
  referenceBudget: number;
  historyBudget: number;
  queryBudget: number;
} {
  const total = config.maxContextTokens;
  return {
    systemBudget: Math.floor(total * config.systemPromptRatio),
    referenceBudget: Math.floor(total * config.referenceRatio),
    historyBudget: Math.floor(total * config.historyRatio),
    queryBudget: Math.floor(total * config.queryRatio),
  };
}

/** Keep only the last `maxRounds` user-turns (each user message opens a round). */
export function sliceHistoryByRounds<T extends { role: string }>(messages: T[], maxRounds: number): T[] {
  if (messages.length === 0 || maxRounds <= 0) return [];

  let userSeen = 0;
  let cut = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userSeen++;
      if (userSeen > maxRounds) {
        cut = i + 1;
        break;
      }
    }
    if (i === 0) cut = 0;
  }

  return messages.slice(cut);
}

export function truncateReferences(references: RerankedResult[], maxTokens: number): RerankedResult[] {
  const result: RerankedResult[] = [];
  let usedTokens = 0;

  for (const ref of references) {
    const tokenCount = estimateTokenCount(ref.content);
    if (usedTokens + tokenCount > maxTokens) {
      if (result.length === 0 || usedTokens < maxTokens * 0.8) {
        const remaining = maxTokens - usedTokens;
        const approxChars = Math.max(80, Math.floor(Math.max(remaining, 1) * 3));
        result.push({
          ...ref,
          content: ref.content.slice(0, approxChars) + '\n...(内容已截断)',
        });
      }
      break;
    }
    result.push(ref);
    usedTokens += tokenCount;
  }

  return result;
}
