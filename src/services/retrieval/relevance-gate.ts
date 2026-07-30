import type { RetrievalMode } from '../../types/settings';
import type { RerankedResult } from './reranker';

/** 语义模式：池内最佳向量相似度低于此值则拒答 */
export const CHAT_MIN_VECTOR_SIMILARITY_SEMANTIC = 0.4;
/**
 * 智能混合且关键词零命中时：向量侧须达到该门槛才调用模型（减轻「库外话题但仍有一层弱向量命中」的胡编）
 */
export const CHAT_MIN_VECTOR_SIMILARITY_HYBRID_NO_KW = 0.46;

/** 供门禁判断用的检索摘要字段（避免与 retrieval/index 循环依赖） */
export interface RetrievalEvidenceSummary {
  chunks: RerankedResult[];
  mode: RetrievalMode;
  maxVectorSimilarity: number | null;
  keywordCandidateCount: number;
}

/**
 * 是否应在对话中跳过模型生成，仅告知用户库内无可靠依据。
 * - 无任何检索结果；
 * - 语义模式：向量池最佳相似度低于阈值；
 * - 智能混合：向量侧明显偏弱且关键词通道无任何候选（常见于库内无匹配词）。
 */
export function shouldDeclineAnswerDueToWeakEvidence(r: RetrievalEvidenceSummary): boolean {
  if (r.chunks.length === 0) return true;

  const vecTop = r.maxVectorSimilarity;
  const kwCount = r.keywordCandidateCount;

  if (r.mode === 'semantic') {
    const best = vecTop ?? 0;
    return best < CHAT_MIN_VECTOR_SIMILARITY_SEMANTIC;
  }

  if (r.mode === 'keyword') {
    return false;
  }

  const vecWeak = (vecTop ?? 0) < CHAT_MIN_VECTOR_SIMILARITY_HYBRID_NO_KW;
  const noKeywordLane = kwCount === 0;
  return vecWeak && noKeywordLane;
}

const HINT =
  '\n\n建议您：① 换成文档里可能出现的术语再提问；② 确认相关文档已导入且状态为「就绪」；③ 尝试切换检索模式（语义 / 关键词 / 智能）后重试。';

export function noKnowledgeReplyForMode(mode: RetrievalMode): string {
  if (mode === 'semantic') {
    return `我已在当前知识库中检索：**语义上与问题匹配的文档片段置信度过低**，无法基于库内资料可靠作答。为避免编造信息，本次已跳过模型自由生成。${HINT}`;
  }
  if (mode === 'keyword') {
    return `我已在当前知识库中检索：**关键词未命中任何文档内容**，无法基于库内资料作答。为避免编造信息，本次已跳过模型自由生成。${HINT}`;
  }
  return `我已在当前知识库中检索：**未发现与您问题相匹配的可靠文档片段**（向量匹配偏弱，且关键词也未命中任何内容）。为避免编造信息，本次已跳过模型自由生成。${HINT}`;
}
