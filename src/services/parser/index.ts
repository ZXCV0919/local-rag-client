import type { FileType, ParserOptions, ParserResult, DocumentParser } from './types';
import { DEFAULT_PARSER_OPTIONS } from './types';
import { PdfParser } from './pdf';
import { MarkdownParser } from './markdown';
import { TxtParser } from './txt';
import { DocxParser } from './docx';

const parsers: Record<FileType, DocumentParser> = {
  pdf: new PdfParser(),
  md: new MarkdownParser(),
  txt: new TxtParser(),
  docx: new DocxParser(),
};

export async function parseDocument(
  fileData: ArrayBuffer,
  fileName: string,
  fileType: FileType,
  options?: Partial<ParserOptions>,
): Promise<ParserResult> {
  const opts = { ...DEFAULT_PARSER_OPTIONS, ...options };
  if (fileData.byteLength > opts.maxFileSize) {
    throw new Error(`File exceeds max size ${opts.maxFileSize} bytes`);
  }
  const parser = parsers[fileType];
  if (!parser) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
  return parser.parse(fileData, fileName);
}

export function getSupportedType(fileName: string): FileType | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, FileType> = {
    pdf: 'pdf',
    md: 'md',
    markdown: 'md',
    txt: 'txt',
    docx: 'docx',
  };
  return typeMap[ext || ''] || null;
}

export type { ParserResult, FileType, DocumentParser, ParserOptions } from './types';
