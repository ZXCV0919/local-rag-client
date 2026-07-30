import type { RetrievalMode } from './settings';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Conversation {
  id: string;
  knowledge_base_id: string;
  title: string;
  llm_model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  referenced_chunks: string[];
  token_count: number;
  created_at: string;
}

export interface ChatRequest {
  conversation_id: string;
  message: string;
  retrieval_mode: RetrievalMode;
}
