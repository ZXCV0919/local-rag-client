import { tauriCommand } from '../../hooks/useDatabase';
import type { DocContent, DocSection } from '../../types/chunk';
import type { Document } from '../../types/document';
import { getSupportedType, parseDocument } from '../parser';

function bytesToArrayBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

/** Merge micro-sections (e.g. one paragraph each with the same fallback heading) for readable preview. */
export function mergeSectionsForPreview(sections: DocSection[]): DocSection[] {
  if (sections.length <= 1) return sections;

  const merged: DocSection[] = [];
  for (const section of sections) {
    const last = merged[merged.length - 1];
    const sameGroup =
      last &&
      last.heading_path === section.heading_path &&
      last.heading === section.heading &&
      last.content_type === section.content_type;

    if (sameGroup) {
      last.content = `${last.content}\n\n${section.content}`;
    } else {
      merged.push({ ...section });
    }
  }
  return merged;
}

export function isDegenerateSectionList(sections: DocSection[]): boolean {
  if (sections.length <= 3) return false;
  const labels = sections.map((s) => (s.heading_path || s.heading || '').trim());
  const unique = new Set(labels.filter(Boolean)).size;
  return unique <= Math.max(2, Math.floor(sections.length * 0.2));
}

export async function loadDocumentSource(doc: Document): Promise<DocContent | null> {
  const fileType = getSupportedType(doc.file_name);
  if (!fileType) return null;
  try {
    const raw = await tauriCommand<number[]>('read_file_bytes', { filePath: doc.file_path });
    const parsed = await parseDocument(bytesToArrayBuffer(raw), doc.file_name, fileType);
    return {
      ...parsed.content,
      sections: mergeSectionsForPreview(parsed.content.sections),
    };
  } catch (err) {
    console.error('Failed to load document source:', err);
    return null;
  }
}
