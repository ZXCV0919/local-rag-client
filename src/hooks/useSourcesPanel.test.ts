import { describe, expect, it, beforeEach } from 'vitest';
import { SOURCES_PANEL_STORAGE_KEY } from './useSourcesPanel';

// 测纯逻辑：抽出 readStoredOpen / writeStoredOpen 便于单测
import { readStoredOpen, writeStoredOpen } from './useSourcesPanel';

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
