export type OllamaStatus = 'connected' | 'disconnected' | 'starting';
export type ModelType = 'embedding' | 'chat';
export type ModelStatus = 'available' | 'downloading' | 'error';

export interface OllamaModel {
  id: string;
  model_type: ModelType;
  size: number;
  status: ModelStatus;
  last_checked: string;
}

export interface OllamaInfo {
  status: OllamaStatus;
  url: string;
  models: OllamaModel[];
}

export interface ModelDownloadProgress {
  model_name: string;
  status: string;
  completed: number;
  total: number;
}
