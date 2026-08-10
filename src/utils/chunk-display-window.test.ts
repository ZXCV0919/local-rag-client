import { describe, expect, it } from 'vitest';
import { sliceContextWindow } from './chunk-display';

describe('sliceContextWindow', () => {
  it('returns empty window for empty fullText', () => {
    const w = sliceContextWindow('', { start: 0, end: 1 });
    expect(w).toEqual({
      windowStart: 0,
      windowEnd: 0,
      text: '',
      highlight: null,
      hasPrefix: false,
      hasSuffix: false,
    });
  });

  it('when range is null, returns empty text and no highlight (caller shows chunk fallback)', () => {
    const w = sliceContextWindow('hello world', null);
    expect(w.text).toBe('');
    expect(w.highlight).toBeNull();
    expect(w.hasPrefix).toBe(false);
    expect(w.hasSuffix).toBe(false);
  });

  it('windows around a mid-string match with default context', () => {
    const full = 'A'.repeat(1000) + 'TARGET' + 'B'.repeat(1000);
    const start = 1000;
    const end = 1006;
    const w = sliceContextWindow(full, { start, end }, 50);
    expect(w.hasPrefix).toBe(true);
    expect(w.hasSuffix).toBe(true);
    expect(w.text.includes('TARGET')).toBe(true);
    expect(w.highlight).toEqual({
      start: start - w.windowStart,
      end: end - w.windowStart,
    });
    expect(w.text.slice(w.highlight!.start, w.highlight!.end)).toBe('TARGET');
  });

  it('clamps at start of document', () => {
    const full = 'HEAD' + 'x'.repeat(200);
    const w = sliceContextWindow(full, { start: 0, end: 4 }, 50);
    expect(w.windowStart).toBe(0);
    expect(w.hasPrefix).toBe(false);
    expect(w.text.startsWith('HEAD')).toBe(true);
  });

  it('clamps at end of document', () => {
    const full = 'x'.repeat(200) + 'TAIL';
    const start = full.length - 4;
    const w = sliceContextWindow(full, { start, end: full.length }, 50);
    expect(w.windowEnd).toBe(full.length);
    expect(w.hasSuffix).toBe(false);
    expect(w.text.endsWith('TAIL')).toBe(true);
  });

  it('expands windowStart backward to previous newline when possible', () => {
    const full = 'aaa\nbbbTARGETccc\nddd';
    const start = full.indexOf('TARGET');
    const end = start + 6;
    const w = sliceContextWindow(full, { start, end }, 2);
    // With tiny context, newline snap should still prefer starting at 'bbb...'
    expect(w.text.startsWith('bbb') || w.windowStart === full.lastIndexOf('\n', start) + 1).toBe(true);
  });
});
