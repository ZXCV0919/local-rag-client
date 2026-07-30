import { useState, useEffect, useCallback } from 'react';
import { tauriCommand } from './useDatabase';

export interface OllamaModelTag {
  name: string;
  model_type: string;
  size: number;
  parameter_size: string;
}

export interface OllamaStatusPayload {
  connected: boolean;
  url: string;
  model_count: number;
  models: OllamaModelTag[];
}

export function useOllama() {
  const [status, setStatus] = useState<OllamaStatusPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tauriCommand<OllamaStatusPayload>('check_ollama_status');
      setStatus(result);
    } catch {
      setStatus({
        connected: false,
        url: '',
        model_count: 0,
        models: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  return { status, loading, checkStatus };
}
