import type { Chunk, ChunkType, DocSection } from '../types/chunk';

export function chunkTypeBadge(type: ChunkType): { label: string; bg: string; fg: string } {
  switch (type) {
    case 'heading':
      return { label: '标题', bg: 'color-mix(in srgb, #7c3aed 16%, var(--color-surface))', fg: '#7c3aed' };
    case 'code':
      return { label: '代码', bg: 'color-mix(in srgb, #16a34a 16%, var(--color-surface))', fg: '#15803d' };
    case 'table':
      return { label: '表格', bg: 'color-mix(in srgb, #ea580c 16%, var(--color-surface))', fg: '#c2410c' };
    case 'mixed':
      return { label: '混合', bg: 'var(--badge-neutral-bg)', fg: 'var(--badge-neutral-fg)' };
    default:
      return { label: '段落', bg: 'color-mix(in srgb, #2563eb 14%, var(--color-surface))', fg: '#2563eb' };
  }
}

export function chunkTypeMinimapColor(type: ChunkType): string {
  switch (type) {
    case 'heading':
      return '#7c3aed';
    case 'code':
      return '#16a34a';
    case 'table':
      return '#ea580c';
    case 'mixed':
      return '#71717a';
    default:
      return '#6366f1';
  }
}

export function chunkHeadingLabel(chunk: Chunk): string {
  const path = chunk.heading_path.trim();
  if (path) return path;
  if (typeof chunk.metadata.section_heading === 'string' && chunk.metadata.section_heading.trim()) {
    return chunk.metadata.section_heading.trim();
  }
  return '未命名片段';
}

export function resolveSectionForChunk(sections: DocSection[], chunk: Chunk): DocSection | null {
  if (sections.length === 0) return null;
  const path = chunk.heading_path.trim();
  if (path) {
    const exact = sections.find((s) => s.heading_path === path);
    if (exact) return exact;
    const partial = sections.find(
      (s) => path.startsWith(s.heading_path) || s.heading_path.startsWith(path),
    );
    if (partial) return partial;
  }
  const probe = chunk.content.trim().slice(0, 80);
  if (probe.length >= 8) {
    const byContent = sections.find(
      (s) => s.content.includes(probe) || probe.includes(s.content.trim().slice(0, 40)),
    );
    if (byContent) return byContent;
  }
  return sections[0] ?? null;
}

/** Per-section text block used by full-document join and expanded source preview. */
export function sectionBlockText(section: DocSection): string {
  const heading = (section.heading_path || section.heading || '').trim();
  const content = section.content ?? '';
  if (!heading) return content;
  if (content.trimStart().startsWith(heading)) return content;
  return `${heading}\n\n${content}`;
}

export function buildFullDocumentText(sections: DocSection[]): string {
  if (sections.length === 0) return '';
  return sections
    .map(sectionBlockText)
    .filter((block) => block.length > 0)
    .join('\n\n');
}

export function findHighlightInFullText(
  fullText: string,
  chunk: Chunk,
): { start: number; end: number } | null {
  const content = chunk.content;
  let range = findHighlightRange(fullText, content);
  if (range) return range;

  const cleanedNeedle = content.replace(/[\u00ad\u200b]/g, '');
  if (cleanedNeedle !== content) {
    range = findHighlightRange(fullText, cleanedNeedle);
    if (range) return range;
  }

  const cleanedHay = fullText.replace(/[\u00ad\u200b]/g, '');
  if (cleanedHay !== fullText) {
    range = findHighlightRange(cleanedHay, content);
    if (range) return range;
  }

  return null;
}

export function findHighlightRange(
  haystack: string,
  needle: string,
): { start: number; end: number } | null {
  const n = needle.trim();
  if (!n) return null;

  let i = haystack.indexOf(n);
  if (i >= 0) return { start: i, end: i + n.length };

  const normHay = haystack.replace(/\s+/g, ' ');
  const normNeedle = n.replace(/\s+/g, ' ');
  i = normHay.indexOf(normNeedle);
  if (i >= 0) return { start: i, end: i + normNeedle.length };

  const prefix = normNeedle.slice(0, Math.min(48, normNeedle.length));
  if (prefix.length >= 12) {
    i = normHay.indexOf(prefix);
    if (i >= 0) return { start: i, end: Math.min(i + normNeedle.length, normHay.length) };
  }
  return null;
}

export function buildChunkContextText(chunks: Chunk[], active: Chunk): string {
  const path = active.heading_path.trim();
  const related = path
    ? chunks.filter((c) => c.heading_path.trim() === path)
    : chunks.filter((c) => {
        const heading =
          typeof c.metadata.section_heading === 'string' ? c.metadata.section_heading.trim() : '';
        const activeHeading =
          typeof active.metadata.section_heading === 'string'
            ? active.metadata.section_heading.trim()
            : '';
        return heading.length > 0 && heading === activeHeading;
      });

  const list = (related.length > 0 ? related : [active])
    .slice()
    .sort((a, b) => a.chunk_index - b.chunk_index);

  return list
    .map((c) => c.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function groupChunksByHeading(chunks: Chunk[]): Array<{ heading: string; items: Chunk[] }> {
  const groups: Array<{ heading: string; items: Chunk[] }> = [];
  for (const chunk of chunks) {
    const heading = chunkHeadingLabel(chunk);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) {
      last.items.push(chunk);
    } else {
      groups.push({ heading, items: [chunk] });
    }
  }
  return groups;
}

export const SOURCE_PREVIEW_CONTEXT_CHARS = 3000;

export type TextRange = { start: number; end: number };

export type ContextWindow = {
  windowStart: number;
  windowEnd: number;
  text: string;
  highlight: TextRange | null;
  hasPrefix: boolean;
  hasSuffix: boolean;
};

function snapStartToNewline(text: string, index: number): number {
  if (index <= 0) return 0;
  const nl = text.lastIndexOf('\n', index);
  if (nl >= 0 && nl >= index - 80) return nl + 1;
  return index;
}

function snapEndToNewline(text: string, index: number): number {
  if (index >= text.length) return text.length;
  const nl = text.indexOf('\n', index);
  if (nl >= 0 && nl <= index + 80) return nl;
  return index;
}

export function sliceContextWindow(
  fullText: string,
  range: TextRange | null,
  contextChars: number = SOURCE_PREVIEW_CONTEXT_CHARS,
): ContextWindow {
  if (!fullText || !range) {
    return {
      windowStart: 0,
      windowEnd: 0,
      text: '',
      highlight: null,
      hasPrefix: false,
      hasSuffix: false,
    };
  }

  const start = Math.max(0, Math.min(range.start, fullText.length));
  const end = Math.max(start, Math.min(range.end, fullText.length));

  let windowStart = Math.max(0, start - contextChars);
  let windowEnd = Math.min(fullText.length, end + contextChars);
  windowStart = snapStartToNewline(fullText, windowStart);
  windowEnd = snapEndToNewline(fullText, windowEnd);

  const text = fullText.slice(windowStart, windowEnd);
  return {
    windowStart,
    windowEnd,
    text,
    highlight: { start: start - windowStart, end: end - windowStart },
    hasPrefix: windowStart > 0,
    hasSuffix: windowEnd < fullText.length,
  };
}
