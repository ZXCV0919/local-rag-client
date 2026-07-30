import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import type { Root, Content, Heading, Table, Code, Paragraph, Blockquote, List } from 'mdast';
import type { DocumentParser, FileType, ParserResult } from './types';
import type { DocSection } from '../../types/chunk';

function plainTextFromContent(node: Content): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'inlineCode') return node.value;
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as Content[]).map(plainTextFromContent).join('');
  }
  return '';
}

function headingText(h: Heading): string {
  return (h.children as Content[]).map(plainTextFromContent).join('').trim();
}

function tableToText(node: Table): string {
  const rows = node.children.map((row) =>
    row.children.map((cell) => plainTextFromContent(cell as unknown as Content).trim()),
  );
  return rows.map((r) => r.join(' | ')).join('\n');
}

function listToText(node: List): string {
  return node.children
    .map((item, i) => {
      const inner = (item.children as Content[])
        .map((c) => plainTextFromContent(c).trim())
        .filter(Boolean)
        .join(' ');
      return `${i + 1}. ${inner}`;
    })
    .join('\n');
}

function processMarkdownTree(tree: Root, titleFallback: string): DocSection[] {
  const sections: DocSection[] = [];
  let headingStack: { level: number; text: string }[] = [];

  const pathStr = (): string => {
    if (headingStack.length === 0) return '';
    return headingStack.map((h) => h.text).join(' / ');
  };

  const pushSection = (
    heading: string,
    content: string,
    content_type: DocSection['content_type'],
    heading_level: number,
  ) => {
    const body = content.trim();
    if (!body) return;
    sections.push({
      heading,
      heading_path: pathStr(),
      heading_level,
      content: body,
      content_type,
    });
  };

  for (const node of tree.children) {
    if (node.type === 'heading') {
      const h = node as Heading;
      const text = headingText(h);
      const level = h.depth;
      headingStack = headingStack.filter((x) => x.level < level);
      headingStack.push({ level, text });
      continue;
    }

    if (node.type === 'code') {
      const fence = node as Code;
      const last = headingStack[headingStack.length - 1];
      pushSection(last?.text ?? titleFallback, fence.value, 'code', last?.level ?? 1);
      continue;
    }

    if (node.type === 'table') {
      const last = headingStack[headingStack.length - 1];
      pushSection(
        last?.text ?? titleFallback,
        tableToText(node as Table),
        'table',
        last?.level ?? 1,
      );
      continue;
    }

    if (node.type === 'paragraph') {
      const body = plainTextFromContent(node as Paragraph).replace(/\s+/g, ' ').trim();
      if (!body) continue;
      const last = headingStack[headingStack.length - 1];
      pushSection(last?.text ?? titleFallback, body, 'text', last?.level ?? 1);
      continue;
    }

    if (node.type === 'blockquote') {
      const body = (node as Blockquote).children
        .map((c) => plainTextFromContent(c as Content).replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
      if (!body) continue;
      const last = headingStack[headingStack.length - 1];
      pushSection(last?.text ?? titleFallback, body, 'text', last?.level ?? 1);
      continue;
    }

    if (node.type === 'list') {
      const body = listToText(node as List);
      if (!body) continue;
      const last = headingStack[headingStack.length - 1];
      pushSection(last?.text ?? titleFallback, body, 'list', last?.level ?? 1);
    }
  }

  return sections;
}

export class MarkdownParser implements DocumentParser {
  supportedTypes: FileType[] = ['md'];

  async parse(raw: ArrayBuffer | string, fileName: string): Promise<ParserResult> {
    const md =
      typeof raw === 'string' ? raw : new TextDecoder('utf-8', { fatal: false }).decode(raw);
    const tree = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkGfm)
      .parse(md) as Root;

    const title = fileName.replace(/\.(md|markdown)$/i, '');
    const sections = processMarkdownTree(tree, title);
    const fullText = sections.map((s) => s.content).join('\n');

    return {
      content: {
        title,
        file_type: 'md',
        sections,
      },
      metadata: {
        title,
        wordCount: fullText.length,
      },
    };
  }
}
