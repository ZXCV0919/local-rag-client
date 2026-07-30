import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentParser, FileType, ParserResult } from './types';
import type { DocSection } from '../../types/chunk';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let workerConfigured = false;

function ensurePdfWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  workerConfigured = true;
}

export class PdfParser implements DocumentParser {
  supportedTypes: FileType[] = ['pdf'];

  async parse(data: ArrayBuffer, fileName: string): Promise<ParserResult> {
    ensurePdfWorker();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
    const sections: DocSection[] = [];
    let totalWordCount = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item) => {
          if (item && typeof item === 'object' && 'str' in item) {
            const s = (item as { str?: unknown }).str;
            return typeof s === 'string' ? s : '';
          }
          return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text) {
        const label = `第${pageNum}页`;
        sections.push({
          heading: label,
          heading_path: label,
          heading_level: 1,
          content: text,
          content_type: 'text',
        });
        totalWordCount += text.length;
      }
    }

    const title = fileName.replace(/\.pdf$/i, '');

    return {
      content: {
        title,
        file_type: 'pdf',
        sections,
      },
      metadata: {
        title,
        pageCount: pdf.numPages,
        wordCount: totalWordCount,
      },
    };
  }
}
