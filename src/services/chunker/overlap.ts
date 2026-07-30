import { extractTailWithinTokenLimit } from '../../utils/token-counter';

export function prependOverlap(chunkContent: string, overlapContent: string): string {
  const o = overlapContent.trim();
  if (!o) return chunkContent;
  return `${o}\n\n…\n\n${chunkContent}`;
}

export function overlapSuffix(previousChunkContent: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return '';
  return extractTailWithinTokenLimit(previousChunkContent, overlapTokens);
}
