// =====================================================================
// Colibri — Branded placeholder generator
//
// Produces a deterministic SVG data URI from a seed string (e.g. product name).
// Same input always yields same output — products won't "flicker" between renders.
// =====================================================================

// Brand-true palette: emerald gradient pairs (Colibri)
const PALETTES: Array<[string, string]> = [
  ['#052E25', '#014737'], // dark forest to emerald
  ['#014737', '#0A5C46'], // deep emerald to botanical
  ['#0A5C46', '#3C8770'], // botanical to leaf
  ['#063D30', '#0A5C46'], // pine to botanical
  ['#052E25', '#063D30'], // forest deep
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function firstGlyph(s: string): string {
  // Get the first non-whitespace character, preserving Cyrillic etc.
  for (const ch of s.trim()) {
    return ch.toUpperCase();
  }
  return 'A';
}

interface PlaceholderOpts {
  seed: string;
  width?: number;
  height?: number;
  /** If true, render without the letter (for store covers). */
  textless?: boolean;
}

export function placeholderSvgDataUri(opts: PlaceholderOpts): string {
  const w = opts.width ?? 400;
  const h = opts.height ?? 400;
  const hash = hashString(opts.seed || 'colibri');
  const palette = PALETTES[hash % PALETTES.length];
  const glyph = firstGlyph(opts.seed);

  // Random-ish but deterministic gradient angle
  const angle = (hash % 4) * 22 + 135;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g${hash}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="${h}" gradientTransform="rotate(${angle} ${w / 2} ${h / 2})">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="100%" stop-color="${palette[1]}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g${hash})"/>
  ${opts.textless ? '' : `<text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Georgia, serif" font-weight="500" font-size="${Math.min(w, h) * 0.42}" fill="rgba(255,255,255,0.92)" letter-spacing="-0.02em">${escapeXml(glyph)}</text>`}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
