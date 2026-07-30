import type { DocumentParser, FileType, ParserResult } from './types';
import type { DocSection } from '../../types/chunk';

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 80) return false;
  if (/^[A-Z0-9\s\-–—:]+$/.test(t) && t.length <= 50 && /[A-Z]/.test(t)) return true;
  if (t.length <= 50 && !/[。！？.!?]$/.test(t) && !/[，、,]/.test(t.slice(-2))) return true;
  return false;
}

export class TxtParser implements DocumentParser {
  supportedTypes: FileType[] = ['txt'];

  async parse(raw: ArrayBuffer | string, fileName: string): Promise<ParserResult> {
    const text =
      typeof raw === 'string' ? raw : new TextDecoder('utf-8', { fatal: false }).decode(raw);
    const normalized = text.replace(/\r\n/g, '\n');
    const blocks = normalized.split(/\n{2,}/);
    const sections: DocSection[] = [];
    let currentHeading = '正文';
    let level = 1;

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      if (lines.length === 1 && looksLikeHeading(lines[0]!)) {
        currentHeading = lines[0]!;
        level = 1;
        continue;
      }

      const content = lines.join('\n').trim();
      if (!content) continue;
      sections.push({
        heading: currentHeading,
        heading_path: currentHeading,
        heading_level: level,
        content,
        content_type: 'text',
      });
    }

    const title = fileName.replace(/\.txt$/i, '');

    if (sections.length === 0 && normalized.trim()) {
      sections.push({
        heading: '正文',
        heading_path: '正文',
        heading_level: 1,
        content: normalized.trim(),
        content_type: 'text',
      });
    }

    return {
      content: {
        title,
        file_type: 'txt',
        sections,
      },
      metadata: {
        title,
        wordCount: normalized.length,
      },
    };
  }
}
