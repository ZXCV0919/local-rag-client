import { describe, expect, it } from 'vitest';
import { overlapSuffix, prependOverlap } from './overlap';

describe('overlap helpers', () => {
  it('prependOverlap inserts overlap with ellipsis separator', () => {
    expect(prependOverlap('后半段', '前半段尾巴')).toBe('前半段尾巴\n\n…\n\n后半段');
  });

  it('prependOverlap ignores blank overlap', () => {
    expect(prependOverlap('正文', '   ')).toBe('正文');
  });

  it('overlapSuffix returns empty when token budget is zero', () => {
    expect(overlapSuffix('很长的一段前文内容用于测试', 0)).toBe('');
  });

  it('overlapSuffix returns a non-empty tail for positive budget', () => {
    const source = '一二三四五六七八九十'.repeat(5);
    const tail = overlapSuffix(source, 8);
    expect(tail.length).toBeGreaterThan(0);
  });
});
