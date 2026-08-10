import type { DocContent } from './chunk';

export type SourcePreviewCacheFile = {
  version: 1;
  document_id: string;
  content_hash: string;
  content: DocContent;
};
