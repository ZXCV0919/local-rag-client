import { describe, expect, it } from 'vitest';
import { summarizeDocumentHealth } from './document-health';

describe('summarizeDocumentHealth', () => {
  it('buckets pending with processing and counts ready/error', () => {
    expect(
      summarizeDocumentHealth([
        { status: 'ready' },
        { status: 'ready' },
        { status: 'pending' },
        { status: 'processing' },
        { status: 'error' },
      ]),
    ).toEqual({ ready: 2, processing: 2, error: 1, total: 5 });
  });

  it('returns zeros for empty list', () => {
    expect(summarizeDocumentHealth([])).toEqual({
      ready: 0,
      processing: 0,
      error: 0,
      total: 0,
    });
  });
});
