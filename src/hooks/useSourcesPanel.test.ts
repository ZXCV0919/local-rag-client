import { describe, expect, it, beforeEach } from 'vitest';
import { SOURCES_PANEL_STORAGE_KEY } from './useSourcesPanel';

// 测纯逻辑：抽出 readStoredOpen / writeStoredOpen 便于单测
import { nextFocusChunk, readStoredOpen, writeStoredOpen } from './useSourcesPanel';

const store = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => {
      store.clear();
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  },
  configurable: true,
});

describe('sources panel storage', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to false when missing', () => {
    expect(readStoredOpen()).toBe(false);
  });

  it('round-trips true', () => {
    writeStoredOpen(true);
    expect(localStorage.getItem(SOURCES_PANEL_STORAGE_KEY)).toBe('true');
    expect(readStoredOpen()).toBe(true);
  });
});

describe('nextFocusChunk', () => {
  it('creates focus with nonce 1 from null', () => {
    expect(nextFocusChunk(null, { documentId: 'd1', chunkId: 'c1' })).toEqual({
      documentId: 'd1',
      chunkId: 'c1',
      nonce: 1,
    });
  });

  it('increments nonce when revealing same or different chunk', () => {
    const a = nextFocusChunk(null, { documentId: 'd1', chunkId: 'c1' });
    const b = nextFocusChunk(a, { documentId: 'd1', chunkId: 'c1' });
    const c = nextFocusChunk(b, { documentId: 'd2', chunkId: 'c9' });
    expect(b.nonce).toBe(2);
    expect(c).toEqual({ documentId: 'd2', chunkId: 'c9', nonce: 3 });
  });
});
