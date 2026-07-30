export type CitationPart =
  | { type: 'text'; text: string }
  | { type: 'citation'; fileLabel: string; refIndex: number };

/** Match `[文档名#序号]` citations produced by the RAG prompt builder. */
export function parseCitations(content: string): CitationPart[] {
  const parts: CitationPart[] = [];
  const regex = /\[([^\]]+)#(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'citation',
      fileLabel: match[1],
      refIndex: parseInt(match[2], 10),
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return parts;
}
