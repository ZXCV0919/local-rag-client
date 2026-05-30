export const SILICONFLOW_DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1';

export const SILICONFLOW_CHAT_PRESETS: { label: string; model: string; hint?: string }[] = [
  { label: 'Qwen2.5 72B（质量）', model: 'Qwen/Qwen2.5-72B-Instruct', hint: '中文 RAG 推荐' },
  { label: 'Qwen2.5 32B（均衡）', model: 'Qwen/Qwen2.5-32B-Instruct' },
  { label: 'DeepSeek V3', model: 'deepseek-ai/DeepSeek-V3' },
  { label: 'DeepSeek V2.5', model: 'deepseek-ai/DeepSeek-V2.5' },
];

export function maskApiKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return t ? '••••••••' : '';
  return `${t.slice(0, 4)}${'•'.repeat(Math.min(12, t.length - 8))}${t.slice(-4)}`;
}
