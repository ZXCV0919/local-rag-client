import { describe, expect, it } from 'vitest';
import { parseCitations } from './citations';

describe('parseCitations', () => {
  it('parses a single [文件#序号] citation', () => {
    const parts = parseCitations('根据资料 [手册#1] 可知。');
    expect(parts).toEqual([
      { type: 'text', text: '根据资料 ' },
      { type: 'citation', fileLabel: '手册', refIndex: 1 },
      { type: 'text', text: ' 可知。' },
    ]);
  });

  it('parses multiple citations', () => {
    const parts = parseCitations('见 [A.md#1] 与 [B.md#2]。');
    const citations = parts.filter((p) => p.type === 'citation');
    expect(citations).toEqual([
      { type: 'citation', fileLabel: 'A.md', refIndex: 1 },
      { type: 'citation', fileLabel: 'B.md', refIndex: 2 },
    ]);
  });

  it('treats brackets without #index as plain text', () => {
    const parts = parseCitations('这是 [普通括号] 不是引用。');
    expect(parts).toEqual([{ type: 'text', text: '这是 [普通括号] 不是引用。' }]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCitations('')).toEqual([]);
  });
});
