// WCAG 2.x relative luminance / contrast — used to pick readable text over a
// club's own (arbitrary) brand colors. A club can pick #FFFF00 or #111111;
// the app must never assume white text works on every accent color.
const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const m = HEX_RE.exec(hex);
  if (!m) return 1; // invalid input defaults to "treat as light" (dark text), the safer failure
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Whichever of white/near-black ink has the higher contrast against this background. */
export function pickForeground(backgroundHex: string): "#FFFFFF" | "#16181C" {
  const bg = relativeLuminance(backgroundHex);
  const withWhite = contrastRatio(bg, 1.0);
  const withBlack = contrastRatio(bg, relativeLuminance("#16181C"));
  return withWhite >= withBlack ? "#FFFFFF" : "#16181C";
}
