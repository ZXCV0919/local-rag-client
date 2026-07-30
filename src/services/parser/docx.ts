import mammoth from 'mammoth';
import type { DocumentParser, FileType, ParserResult } from './types';
import { MarkdownParser } from './markdown';

export class DocxParser implements DocumentParser {
  supportedTypes: FileType[] = ['docx'];
  private mdParser = new MarkdownParser();

  async parse(data: ArrayBuffer, fileName: string): Promise<ParserResult> {
    const mammothMod = mammoth as unknown as {
      convertToMarkdown: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
    };
    const result = await mammothMod.convertToMarkdown({ arrayBuffer: data });
    const mdContent = result.value;
    const mdData = new TextEncoder().encode(mdContent).buffer;
    const virtualName = fileName.replace(/\.docx$/i, '.md');
    const parsed = await this.mdParser.parse(mdData, virtualName);
    parsed.content.file_type = 'docx';
    if (parsed.content.title.endsWith('.md')) {
      parsed.content.title = parsed.content.title.slice(0, -3);
    }
    parsed.metadata.title = parsed.content.title;
    return parsed;
  }
}
