import type { DocSection } from '../../types/chunk';
import type { ChunkType } from '../../types/chunk';
import type { ChunkerConfig, WorkingChunk } from './types';

function mapSectionType(ct: DocSection['content_type']): ChunkType {
  switch (ct) {
    case 'code':
      return 'code';
    case 'table':
      return 'table';
    case 'list':
      return 'mixed';
    default:
      return 'paragraph';
  }
}

export function chunkByHeading(sections: DocSection[], config: ChunkerConfig): WorkingChunk[] {
  return sections.map((s) => {
    const ctx =
      config.heading_as_context && s.heading_path.trim()
        ? `${s.heading_path}\n\n`
        : '';
    const type = mapSectionType(s.content_type);
    const body = s.content.trim();
    return {
      content: ctx + body,
      heading_path: s.heading_path,
      chunk_type: type,
      metadata: { section_heading: s.heading },
    };
  });
}
