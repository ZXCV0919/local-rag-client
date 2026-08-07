import type { DocumentStatus } from '../types/document';

export type DocumentHealthSummary = {
  ready: number;
  processing: number;
  error: number;
  total: number;
};

export function summarizeDocumentHealth(
  docs: Array<{ status: DocumentStatus }>,
): DocumentHealthSummary {
  const summary: DocumentHealthSummary = {
    ready: 0,
    processing: 0,
    error: 0,
    total: docs.length,
  };
  for (const d of docs) {
    if (d.status === 'ready') summary.ready += 1;
    else if (d.status === 'error') summary.error += 1;
    else summary.processing += 1;
  }
  return summary;
}
