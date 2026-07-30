import type { RerankedResult } from '../retrieval/reranker';
import { estimateTokenCount } from '../../utils/token-counter';

export interface PromptContext {
  systemPrompt: string;
  references: RerankedResult[];
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userQuery: string;
  historyMaxTokens: number;
}

export function buildPrompt(context: PromptContext): Array<{ role: string; content: string }> {
  const { systemPrompt, references, conversationHistory, userQuery, historyMaxTokens } = context;

  const referenceBlock = buildReferenceBlock(references);
  const systemBlock = buildSystemBlock(systemPrompt, referenceBlock);

  const messages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemBlock }];

  const truncatedHistory = truncateHistory(conversationHistory, historyMaxTokens);

  for (const msg of truncatedHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: userQuery });

  return messages;
}

function buildSystemBlock(systemPrompt: string, referenceBlock: string): string {
  return `${systemPrompt}\n\n${referenceBlock}`;
}

function buildReferenceBlock(references: RerankedResult[]): string {
  if (references.length === 0) {
    return '## 参考资料\n暂无相关参考资料。';
  }

  const refTexts = references.map((ref, i) => {
    return `[${ref.file_name}#${i + 1}]\n${ref.content}`;
  });

  return `## 参考资料\n${refTexts.join('\n\n')}`;
}

function truncateHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let tokenCount = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const msgTokens = estimateTokenCount(msg.content);
    if (tokenCount + msgTokens > maxTokens) break;
    result.unshift(msg);
    tokenCount += msgTokens;
  }

  return result;
}
