/**
 * 主题色工具：根据主色推导 hover 色与「按钮上的前景色」，避免浅底深字 / 浅字看不清。
 */

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function normalizeHex(hex: string): string | null {
  const m = hex.trim().match(HEX_RE);
  if (!m) return null;
  return `#${m[1].toLowerCase()}`;
}

export function parseHexRgb(hex: string): [number, number, number] | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const v = parseInt(n.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function linearChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0–1) */
export function relativeLuminance(rgb: [number, number, number]): number {
  const r = linearChannel(rgb[0]);
  const g = linearChannel(rgb[1]);
  const b = linearChannel(rgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((x) =>
      Math.round(Math.min(255, Math.max(0, x)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function darkenRgb(rgb: [number, number, number], ratio: number): [number, number, number] {
  const k = 1 - ratio;
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
}

const FG_OPTIONS: [number, number, number][] = [
  [255, 255, 255],
  [15, 23, 42],
  [17, 24, 39],
];

/**
 * 选一个在「主色 / hover 深」两种背景上对比度都尽可能高的前景色（≥4.5 优先）。
 */
export function pickOnAccentColor(normalRgb: [number, number, number], hoverRgb: [number, number, number]): string {
  let bestHex = '#ffffff';
  let bestScore = -1;

  for (const fg of FG_OPTIONS) {
    const c1 = contrastRatio(fg, normalRgb);
    const c2 = contrastRatio(fg, hoverRgb);
    const score = Math.min(c1, c2);
    if (score > bestScore) {
      bestScore = score;
      bestHex = rgbToHex(fg as [number, number, number]);
    }
  }

  return bestHex;
}

/** 将主题色写入 :root，并同步 `--color-accent-hover`、`--color-on-accent`。 */
export function applyAccentVariables(root: HTMLElement, accentHex: string): void {
  const normalized = normalizeHex(accentHex) ?? '#6366f1';
  const rgb = parseHexRgb(normalized);
  if (!rgb) return;

  const hover = darkenRgb(rgb, 0.14);
  const onAccent = pickOnAccentColor(rgb, hover);

  root.style.setProperty('--color-accent', normalized);
  root.style.setProperty('--color-accent-hover', rgbToHex(hover));
  root.style.setProperty('--color-on-accent', onAccent);

  root.style.setProperty('--color-citation-bg', `color-mix(in srgb, ${normalized} 14%, transparent)`);
  root.style.setProperty('--color-citation-border', `color-mix(in srgb, ${normalized} 38%, transparent)`);
  root.style.setProperty('--color-citation-hover-bg', `color-mix(in srgb, ${normalized} 22%, transparent)`);
  root.style.setProperty('--color-citation-fg', normalized);
}

export const ACCENT_PRESETS: { label: string; hex: string }[] = [
  { label: '靛紫', hex: '#6366f1' },
  { label: '紫罗兰', hex: '#7c3aed' },
  { label: '雾紫', hex: '#a855f7' },
  { label: '蓝', hex: '#2563eb' },
  { label: '电青', hex: '#06b6d4' },
  { label: '青', hex: '#0d9488' },
  { label: '翠绿', hex: '#059669' },
  { label: '珊瑚', hex: '#fb7185' },
  { label: '桃粉', hex: '#f472b6' },
  { label: '琥珀', hex: '#d97706' },
  { label: '玫红', hex: '#e11d48' },
  { label: '石板', hex: '#475569' },
];
