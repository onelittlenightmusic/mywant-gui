/**
 * Colours DERIVED from a character's own colour.
 *
 * A character's colour is chosen to be a cursor: maximally saturated, so a
 * person finds their own pointer on a shared board instantly. That brief is
 * right for a 20px pointer and wrong for everything else the colour is asked to
 * do — a frame around a whole card, a notification bead, a focus glow — where
 * full saturation reads as neon and pulls the eye off the content. Each of
 * those wants the same HUE (whose mark this is has to stay readable, and hue is
 * what carries that) at a different weight.
 *
 * This is the one place those weights live, so "the character's frame colour"
 * and "the character's badge colour" mean one thing everywhere.
 *
 * NOT applied to the cursor itself, its aura, or its speech bubbles: those ARE
 * the character and stay raw and vivid.
 */

export type CharacterColorRole =
  /** A "you are here" outline — a card's focus/hover ring, the board frame, an
   *  overlay control's ring. Well below cursor saturation, lightness pinned to
   *  a theme band so two people's frames weigh the same. */
  | 'frame'
  /** A notification dot or bead — a want's unread-alert badge, the menu's
   *  attention dot, a sidebar tab's marker. Has to catch the eye, so brighter
   *  and more saturated than a frame, but still off the raw cursor so a board
   *  full of them is not neon. */
  | 'badge';

interface Weight {
  /** Multiplier on the source saturation, then clamped to [min, max]. */
  sMul: number;
  sMin: number;
  sMax: number;
  /** Absolute lightness for the role, per theme. */
  l: number;
}

const WEIGHTS: Record<CharacterColorRole, { light: Weight; dark: Weight }> = {
  frame: {
    light: { sMul: 0.6, sMin: 0.25, sMax: 0.72, l: 0.45 },
    // Brighter and more saturated on a dark ground, where the frame is light
    // ON something rather than a line drawn ACROSS it.
    //
    // The muted weight was chosen when a frame was a hard border on a pale
    // card, and neon there took the eye off the content. A glow bleeding into
    // a dark card is the opposite problem: dimmed to 60% saturation at mid
    // lightness it sank into the surface and read as a smudge rather than as
    // somebody's mark. Dark rooms take fluorescence.
    dark:  { sMul: 1.0, sMin: 0.72, sMax: 1.0, l: 0.78 },
  },
  badge: {
    light: { sMul: 0.9, sMin: 0.5, sMax: 0.95, l: 0.56 },
    dark:  { sMul: 0.9, sMin: 0.55, sMax: 1.0, l: 0.66 },
  },
};

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
      h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * `hex` (a character's colour) at the weight `role` calls for, for the current
 * theme. Hue is kept exactly. A non-hex input is returned untouched.
 */
export function characterColor(hex: string, role: CharacterColorRole, isDark: boolean): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const w = isDark ? WEIGHTS[role].dark : WEIGHTS[role].light;
  const s = Math.max(w.sMin, Math.min(w.sMax, hsl.s * w.sMul));
  return hslToHex(hsl.h, s, w.l);
}

/** The character's colour at frame weight — see role 'frame'. */
export const characterFrameColor = (hex: string, isDark: boolean): string =>
  characterColor(hex, 'frame', isDark);

/** The character's colour at notification-badge weight — see role 'badge'. */
export const characterBadgeColor = (hex: string, isDark: boolean): string =>
  characterColor(hex, 'badge', isDark);

/**
 * Black or white, whichever the eye reads more easily on `hex` — for text or a
 * glyph laid over a character-derived fill.
 */
export function characterInkOn(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lin = (v: number) => {
    const ch = v / 255;
    return ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#0f172a' : '#ffffff';
}
