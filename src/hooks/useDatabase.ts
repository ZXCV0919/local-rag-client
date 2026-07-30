import { invoke } from '@tauri-apps/api/core';

function formatInvokeError(error: unknown): string {
  if (error == null) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>;
    const msg = o.message;
    const code = o.code;
    if (typeof msg === 'string' && typeof code === 'string' && code.length > 0) {
      return `[${code}] ${msg}`;
    }
    if (typeof msg === 'string') return msg;
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

export async function tauriCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(`Command '${command}' failed: ${formatInvokeError(error)}`);
  }
}
