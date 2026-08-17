import type { ChunkingStrategy } from './knowledge-base';
import { FALLBACK_CHUNKING_STRATEGY } from './knowledge-base';

export type RetrievalMode = 'hybrid' | 'semantic' | 'keyword';

/** 重排：默认加权 RRF；可选 LLM listwise（更慢，失败回退 RRF） */
export type RerankMode = 'rrf' | 'llm';

/** 界面明暗：与系统设置一致，或强制浅色 / 深色 */
export type ColorSchemePreference = 'system' | 'light' | 'dark';

export type ChatProvider = 'ollama' | 'siliconflow';

export interface AppSettings {
  ollama_url: string;
  default_embedding_model: string;
  default_chat_model: string;
  retrieval_mode: RetrievalMode;
  /** 第二阶段重排策略 */
  rerank_mode: RerankMode;
  vector_weight: number;
  keyword_weight: number;
  max_results: number;
  data_directory: string;
  /** 主题主色（按钮等），如 #0f766e */
  accent_color: string;
  /** 配色方案：跟随系统 / 浅色 / 深色 */
  color_scheme: ColorSchemePreference;
  /** 流式回答结束后是否进行一次「是否基于引用」的自检（额外一次短推理） */
  answer_self_check: boolean;
  /** 新建知识库时使用的默认分块策略（仅存 settings 表 JSON） */
  default_chunking_strategy: ChunkingStrategy;
  /** 对话生成提供方：本地 Ollama 或硅基流动云端 */
  chat_provider: ChatProvider;
  /** 硅基流动 API Key（UI 脱敏展示） */
  siliconflow_api_key: string;
  /** 硅基流动 API Base URL */
  siliconflow_base_url: string;
  /** 硅基流动对话模型 id */
  siliconflow_chat_model: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollama_url: 'http://localhost:11434',
  default_embedding_model: 'nomic-embed-text',
  default_chat_model: 'qwen2.5:7b',
  retrieval_mode: 'hybrid',
  rerank_mode: 'rrf',
  vector_weight: 0.7,
  keyword_weight: 0.3,
  max_results: 6,
  data_directory: '',
  accent_color: '#0f766e',
  color_scheme: 'system',
  answer_self_check: true,
  default_chunking_strategy: { ...FALLBACK_CHUNKING_STRATEGY },
  chat_provider: 'ollama',
  siliconflow_api_key: '',
  siliconflow_base_url: 'https://api.siliconflow.cn/v1',
  siliconflow_chat_model: 'Qwen/Qwen2.5-72B-Instruct',
};
