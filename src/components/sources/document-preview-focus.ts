export const PREVIEW_MAX_CHUNKS = 40;
export const PREVIEW_MAX_CHARS = 24_000;

export function buildPreviewChunks(
  chunks: { id: string; content: string }[],
  maxChunks: number = PREVIEW_MAX_CHUNKS,
  maxChars: number = PREVIEW_MAX_CHARS,
): { visible: { id: string; content: string }[]; truncated: boolean } {
  const slice = chunks.slice(0, maxChunks);
  const visible: { id: string; content: string }[] = [];
  let used = 0;
  let truncated = chunks.length > maxChunks;

  for (const chunk of slice) {
    const nextLen = used === 0 ? chunk.content.length : used + 2 + chunk.content.length;
    if (visible.length > 0 && nextLen > maxChars) {
      truncated = true;
      break;
    }
    visible.push(chunk);
    used = nextLen;
  }

  return { visible, truncated };
}

export function isFocusInPreview(
  visibleIds: string[],
  focusChunkId: string | null | undefined,
): boolean {
  if (!focusChunkId) return false;
  return visibleIds.includes(focusChunkId);
}
