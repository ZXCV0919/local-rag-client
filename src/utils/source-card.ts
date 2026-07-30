export function inferFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  return 'txt';
}

export function fileTypeStyle(fileType: string): { label: string; bg: string; fg: string } {
  switch (fileType) {
    case 'pdf':
      return { label: 'PDF', bg: 'color-mix(in srgb, #ef4444 16%, var(--color-surface))', fg: '#dc2626' };
    case 'md':
      return { label: 'MD', bg: 'color-mix(in srgb, #2563eb 16%, var(--color-surface))', fg: '#2563eb' };
    case 'docx':
      return { label: 'DOC', bg: 'color-mix(in srgb, #7c3aed 16%, var(--color-surface))', fg: '#7c3aed' };
    default:
      return {
        label: 'TXT',
        bg: 'color-mix(in srgb, var(--color-text-secondary) 12%, var(--color-surface))',
        fg: 'var(--color-text-secondary)',
      };
  }
}

/** e.g. 第25页 → 页码：25 */
export function formatSourceLocationMeta(headingPath: string | undefined): string | null {
  if (!headingPath?.trim()) return null;
  const pageMatch = headingPath.match(/^第(\d+)页$/);
  if (pageMatch) return `页码：${pageMatch[1]}`;
  if (headingPath === '正文') return null;
  const label = headingPath.length > 36 ? `${headingPath.slice(0, 36)}…` : headingPath;
  return `章节：${label}`;
}

export function previewSnippet(text: string, maxChars = 120): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}…`;
}

export function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
