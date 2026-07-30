import type { DocContent } from '../../types/chunk';

export type FileType = 'pdf' | 'md' | 'txt' | 'docx';

export interface ParserResult {
  content: DocContent;
  metadata: {
    title: string;
    pageCount?: number;
    wordCount: number;
    language?: string;
  };
}

export interface ParserOptions {
  maxFileSize: number;
  extractMetadata: boolean;
}

export const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  maxFileSize: 50 * 1024 * 1024,
  extractMetadata: true,
};

export interface DocumentParser {
  parse(raw: ArrayBuffer | string, fileName: string): Promise<ParserResult>;
  supportedTypes: FileType[];
}
