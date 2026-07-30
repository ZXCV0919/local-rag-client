export function estimateTokenCount(text: string): number {
  let tokenCount = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/[\u4e00-\u9fff]/.test(char)) {
      tokenCount += 1;
    } else if (/\s/.test(char)) {
      continue;
    } else {
      tokenCount += 0.25;
    }
  }
  return Math.ceil(tokenCount);
}

export function truncateToTokenLimit(text: string, maxTokens: number): string {
  let tokens = 0;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (/[\u4e00-\u9fff]/.test(char)) {
      tokens += 1;
    } else if (!/\s/.test(char)) {
      tokens += 0.25;
    }
    if (tokens > maxTokens) break;
    result += char;
  }
  return result;
}

/** suffix of `text` with estimated token count ≤ maxTokens */
export function extractTailWithinTokenLimit(text: string, maxTokens: number): string {
  if (maxTokens <= 0 || !text.trim()) return '';
  let low = 0;
  let high = text.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const slice = text.slice(text.length - mid);
    const tok = estimateTokenCount(slice);
    if (tok <= maxTokens) {
      best = slice;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best.trim() ? best : '';
}
