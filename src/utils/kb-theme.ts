export type KbIconKind = 'doc' | 'code' | 'api' | 'folder' | 'chat' | 'faq';

export interface KbTheme {
  strip: string;
  avatarBg: string;
  avatarFg: string;
  iconBg: string;
  iconFg: string;
  kind: KbIconKind;
}

export const KB_THEMES: KbTheme[] = [
  { strip: '#6366f1', avatarBg: '#eef2ff', avatarFg: '#4f46e5', iconBg: '#4f6ef7', iconFg: '#ffffff', kind: 'doc' },
  { strip: '#10b981', avatarBg: '#ecfdf5', avatarFg: '#059669', iconBg: '#059669', iconFg: '#ffffff', kind: 'code' },
  { strip: '#8b5cf6', avatarBg: '#f5f3ff', avatarFg: '#7c3aed', iconBg: '#7c3aed', iconFg: '#ffffff', kind: 'api' },
  { strip: '#f59e0b', avatarBg: '#fffbeb', avatarFg: '#d97706', iconBg: '#d97706', iconFg: '#ffffff', kind: 'folder' },
  { strip: '#14b8a6', avatarBg: '#f0fdfa', avatarFg: '#0d9488', iconBg: '#0d9488', iconFg: '#ffffff', kind: 'chat' },
  { strip: '#f97316', avatarBg: '#fff7ed', avatarFg: '#ea580c', iconBg: '#ea580c', iconFg: '#ffffff', kind: 'faq' },
];

export function kbThemeForId(id: string): KbTheme {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % KB_THEMES.length;
  return KB_THEMES[h]!;
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} 天前`;
  return iso.slice(0, 10);
}

export const FILE_TYPE_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  pdf: { label: 'PDF', bg: '#ef4444', fg: '#ffffff' },
  md: { label: 'MD', bg: '#374151', fg: '#ffffff' },
  docx: { label: 'DOCX', bg: '#2563eb', fg: '#ffffff' },
  txt: { label: 'TXT', bg: '#6b7280', fg: '#ffffff' },
};
