export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';
export type FileType = 'pdf' | 'md' | 'txt' | 'docx';

export interface Document {
  id: string;
  knowledge_base_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: FileType;
  file_size: number;
  content_hash: string;
  chunk_count: number;
  status: DocumentStatus;
  error_message: string;
  imported_at: string;
  updated_at: string;
}

export interface EmbeddingSubProgress {
  completed: number;
  total: number;
  failedChunks: number;
}

export interface ImportProgress {
  document_id: string;
  status: DocumentStatus;
  current_step: string;
  completed: number;
  total: number;
  error_message?: string;
  /** 向量化子进度（current_step 为 embedding 时） */
  embedding?: EmbeddingSubProgress;
}
