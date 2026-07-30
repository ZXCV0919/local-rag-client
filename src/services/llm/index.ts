import { retrieve } from '../retrieval';
import {
  DEFAULT_SETTINGS,
  type ChatProvider,
  type RetrievalMode,
  type RerankMode,
} from '../../types/settings';
import { noKnowledgeReplyForMode, shouldDeclineAnswerDueToWeakEvidence } from '../retrieval/relevance-gate';
import { buildPrompt } from './prompt-builder';
import {
  allocateContextBudget,
  DEFAULT_CONTEXT_CONFIG,
  sliceHistoryByRounds,
  truncateReferences,
} from './context-window';
import { chatCompleteUnified, streamChatUnified, type ChatRequestConfig } from './chat-provider';
import type { StreamChunk as RawStreamChunk } from './stream-handler';
import { evaluateAnswerGroundedness } from './answer-self-check';
import type { RerankedResult } from '../retrieval/reranker';
import { truncateToTokenLimit } from '../../utils/token-counter';

export type ChatStreamChunk =
  | { type: 'status'; phase: 'retrieve' }
  | {
      type: 'meta';
      references: RerankedResult[];
      retrievalMode: RetrievalMode;
      totalCandidates: number;
    }
  | RawStreamChunk;

export interface ChatOptions {
  kbId: string;
  query: string;
  model?: string;
  embeddingModel?: string;
  ollamaUrl?: string;
  retrievalMode?: RetrievalMode;
  rerankMode?: RerankMode;
  vectorWeight?: number;
  keywordWeight?: number;
  maxResults?: number;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt?: string;
  signal?: AbortSignal;
  /** 主回答流结束后做一次 groundedness 自检（一次额外的短 chat 调用） */
  answerSelfCheck?: boolean;
  chatProvider?: ChatProvider;
  siliconflowApiKey?: string;
  siliconflowBaseUrl?: string;
  siliconflowChatModel?: string;
}

export const DEFAULT_SYSTEM_PROMPT = `你是一个知识库问答助手。你只能根据下方「参考资料」中的文本作答。

## 规则（违反即为错误）
- **不知道的不要说**：参考资料里没有或未提及的信息一律不写；不要用常识「补齐」或猜测填空。
- **不要编造**：不得捏造书名、章节名、数字、步骤或因果关系。
- 参考资料为空或明确不足以回答时：仅用一两句话说明无法根据当前资料回答，**禁止**输出菜谱、教程、常识长篇或任何看似有理但未出现在参考资料中的内容。
- 有参考资料时：严格据此作答；引用处标注 [文档名#序号]。
- 使用中文，语气简洁。`;

export async function* chat(options: ChatOptions): AsyncGenerator<ChatStreamChunk> {
  const {
    kbId,
    query,
    model = 'qwen2.5:7b',
    embeddingModel = 'nomic-embed-text',
    ollamaUrl = 'http://localhost:11434',
    retrievalMode = 'hybrid',
    rerankMode = DEFAULT_SETTINGS.rerank_mode,
    vectorWeight,
    keywordWeight,
    maxResults = 6,
    conversationHistory = [],
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    signal,
    answerSelfCheck = DEFAULT_SETTINGS.answer_self_check,
    chatProvider = DEFAULT_SETTINGS.chat_provider,
    siliconflowApiKey = DEFAULT_SETTINGS.siliconflow_api_key,
    siliconflowBaseUrl = DEFAULT_SETTINGS.siliconflow_base_url,
    siliconflowChatModel = DEFAULT_SETTINGS.siliconflow_chat_model,
  } = options;

  yield { type: 'status', phase: 'retrieve' };

  let references: RerankedResult[] = [];
  let totalCandidates = 0;

  const activeModel = chatProvider === 'siliconflow' ? siliconflowChatModel : model;

  const chatConfig: ChatRequestConfig = {
    provider: chatProvider,
    model: activeModel,
    ollamaUrl,
    siliconflowApiKey,
    siliconflowBaseUrl,
    signal,
  };

  try {
    const retrievalResult = await retrieve(query.trim(), kbId, embeddingModel, ollamaUrl || null, {
      mode: retrievalMode,
      maxResults,
      vectorWeight,
      keywordWeight,
      rerankMode,
      llmComplete:
        rerankMode === 'llm'
          ? (messages) => chatCompleteUnified(messages, chatConfig)
          : undefined,
    });
    references = retrievalResult.chunks;
    totalCandidates = retrievalResult.totalCandidates;

    const decline = shouldDeclineAnswerDueToWeakEvidence({
      chunks: retrievalResult.chunks,
      mode: retrievalResult.mode,
      maxVectorSimilarity: retrievalResult.maxVectorSimilarity,
      keywordCandidateCount: retrievalResult.keywordCandidateCount,
    });

    if (decline) {
      yield {
        type: 'meta',
        references: [],
        retrievalMode,
        totalCandidates,
      };
      yield { type: 'content', content: noKnowledgeReplyForMode(retrievalMode) };
      yield { type: 'done' };
      return;
    }
  } catch {
    yield {
      type: 'meta',
      references: [],
      retrievalMode,
      totalCandidates: 0,
    };
    yield {
      type: 'content',
      content: `检索知识库时出现错误，暂时无法基于资料作答。请检查 ${chatProvider === 'siliconflow' ? 'Ollama 嵌入服务 / ChromaDB' : 'Ollama / 嵌入模型 / ChromaDB'} 是否正常后重试。\n\n若问题持续，可尝试切换检索模式或减少单次检索范围。`,
    };
    yield { type: 'done' };
    return;
  }

  const budget = allocateContextBudget(DEFAULT_CONTEXT_CONFIG);
  const truncatedRefs = truncateReferences(references, budget.referenceBudget);

  const slicedHistory = sliceHistoryByRounds(conversationHistory, DEFAULT_CONTEXT_CONFIG.maxHistoryRounds);

  const queryBudget = Math.max(128, budget.queryBudget);
  const userQuery = truncateToTokenLimit(query.trim(), queryBudget);

  const messages = buildPrompt({
    systemPrompt,
    references: truncatedRefs,
    conversationHistory: slicedHistory,
    userQuery,
    historyMaxTokens: budget.historyBudget,
  });

  yield {
    type: 'meta',
    references: truncatedRefs,
    retrievalMode,
    totalCandidates,
  };

  let accumulated = '';
  for await (const chunk of streamChatUnified(messages, chatConfig)) {
    if (chunk.type === 'error') {
      yield chunk;
      return;
    }
    if (chunk.type === 'done') {
      continue;
    }
    if (chunk.type === 'content' && chunk.content) {
      accumulated += chunk.content;
      yield chunk;
    }
  }

  const minLenForSelfCheck = 24;
  if (
    answerSelfCheck &&
    accumulated.trim().length >= minLenForSelfCheck &&
    truncatedRefs.length > 0 &&
    !signal?.aborted
  ) {
    try {
      const verdict = await evaluateAnswerGroundedness({
        config: chatConfig,
        userQuery: query.trim(),
        references: truncatedRefs,
        assistantAnswer: accumulated,
        signal,
      });
      if (!verdict.grounded) {
        const note =
          verdict.reason?.trim() ||
          '模型自检认为部分内容可能未能由参考资料充分支持，请结合引用核对原文。';
        yield {
          type: 'content',
          content: `\n\n---\n**自检提示：** ${note}\n`,
        };
      }
    } catch {
      /* 自检失败时不阻断用户：fail-open */
    }
  }

  yield { type: 'done' };
}

export type { StreamChunk } from './stream-handler';
