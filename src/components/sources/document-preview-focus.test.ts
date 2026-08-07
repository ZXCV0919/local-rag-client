import { describe, expect, it } from 'vitest';
import {
  PREVIEW_MAX_CHUNKS,
  buildPreviewChunks,
  isFocusInPreview,
} from './document-preview-focus';

describe('buildPreviewChunks', () => {
  it('keeps order and marks truncated when over max chunks', () => {
    const chunks = Array.from({ length: PREVIEW_MAX_CHUNKS + 2 }, (_, i) => ({
      id: `c${i}`,
      content: `text-${i}`,
    }));
    const { visible, truncated } = buildPreviewChunks(chunks);
    expect(visible).toHaveLength(PREVIEW_MAX_CHUNKS);
    expect(visible[0]?.id).toBe('c0');
    expect(truncated).toBe(true);
  });

  it('marks truncated when char budget exceeded', () => {
    const { visible, truncated } = buildPreviewChunks(
      [
        { id: 'a', content: 'aaaa' },
        { id: 'b', content: 'bbbb' },
      ],
      40,
      5,
    );
    expect(visible.map((c) => c.id)).toEqual(['a']);
    expect(truncated).toBe(true);
  });
});

describe('isFocusInPreview', () => {
  it('returns true when focus id is visible', () => {
    expect(isFocusInPreview(['a', 'b'], 'b')).toBe(true);
  });

  it('returns false when missing or empty focus', () => {
    expect(isFocusInPreview(['a'], 'z')).toBe(false);
    expect(isFocusInPreview(['a'], null)).toBe(false);
  });
});
