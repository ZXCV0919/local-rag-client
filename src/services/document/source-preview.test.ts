import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('../../hooks/useDatabase', () => ({
  tauriCommand: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('../parser', () => ({
  getSupportedType: () => 'md',
  parseDocument: vi.fn(async () => ({
    content: {
      title: 'parsed',
      file_type: 'md',
      sections: [{ heading: 'H', heading_path: 'H', heading_level: 1, content: 'body', content_type: 'text' }],
    },
    metadata: {},
  })),
}));

import {
  clearSourcePreviewMemoryCache,
  loadDocumentSource,
  saveDocumentSourceCache,
} from './source-preview';
import type { Document } from '../../types/document';

const doc = {
  id: 'doc-1',
  content_hash: 'hash-a',
  file_name: 'a.md',
  file_path: '/tmp/a.md',
  file_type: 'md',
} as Document;

describe('loadDocumentSource', () => {
  beforeEach(() => {
    clearSourcePreviewMemoryCache();
    invokeMock.mockReset();
  });

  it('returns memory cache on second call without disk/parse', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_source_preview_cache') {
        return {
          version: 1,
          document_id: 'doc-1',
          content_hash: 'hash-a',
          content: {
            title: 'cached',
            file_type: 'md',
            sections: [{ heading: '', heading_path: '', heading_level: 0, content: 'x', content_type: 'text' }],
          },
        };
      }
      throw new Error(`unexpected ${cmd}`);
    });
    const first = await loadDocumentSource(doc);
    expect(first?.title).toBe('cached');
    invokeMock.mockClear();
    const second = await loadDocumentSource(doc);
    expect(second?.title).toBe('cached');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('ignores disk cache when content_hash mismatches and falls back to parse', async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_source_preview_cache') {
        return {
          version: 1,
          document_id: 'doc-1',
          content_hash: 'old-hash',
          content: { title: 'stale', file_type: 'md', sections: [] },
        };
      }
      if (cmd === 'delete_source_preview_cache') return null;
      if (cmd === 'read_file_bytes') return Array.from(new TextEncoder().encode('# hi'));
      if (cmd === 'write_source_preview_cache') return null;
      throw new Error(`unexpected ${cmd}`);
    });
    const result = await loadDocumentSource(doc);
    expect(result?.title).toBe('parsed');
    expect(invokeMock).toHaveBeenCalledWith(
      'delete_source_preview_cache',
      expect.objectContaining({ documentId: 'doc-1' }),
    );
  });
});

describe('saveDocumentSourceCache', () => {
  beforeEach(() => {
    clearSourcePreviewMemoryCache();
    invokeMock.mockReset();
  });

  it('writes cache and seeds memory', async () => {
    invokeMock.mockResolvedValue(null);
    await saveDocumentSourceCache('doc-1', 'hash-a', {
      title: 't',
      file_type: 'md',
      sections: [],
    });
    expect(invokeMock).toHaveBeenCalledWith(
      'write_source_preview_cache',
      expect.objectContaining({
        payload: expect.objectContaining({
          version: 1,
          documentId: 'doc-1',
          contentHash: 'hash-a',
        }),
      }),
    );
    invokeMock.mockClear();
    const loaded = await loadDocumentSource(doc);
    expect(loaded?.title).toBe('t');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
