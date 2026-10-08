import { vividIconColor } from '@/components/dashboard/WantCardFace';
import { shade } from '@/components/dashboard/WantTypeVisuals';

/*
 * The board's style rules — solidity, light, the drop cap — are written down in
 * components/dashboard/STYLE.md. This file is where most of them live as code.
 */

/**
 * The one colour scheme a thing wears, wherever it is drawn: its card's badge,
 * a kata's 所作 tile, the sphere on the canvas.
 *
 * The face is the thing's own colour, laid down solid, and the glyph is light on
 * top of it. The reverse — a pale wash with a saturated glyph — is what the
 * badge used to do, and at tile size it left every thing looking like the same
 * cream disc with a different scribble on it. A solid face carries the hue at
 * any size, and a light glyph reads against it without competing.
 */

/** The thing's colour at the weight a face wants: solid, a touch deeper in dark mode. */
export function thingFaceBackground(color: string, isLight: boolean): string {
  return isLight ? `${color}d9` : `${color}c4`;
}

/** The glyph laid over that face. Light, because the face beneath it is not. */
export function thingGlyphColor(isLight: boolean): string {
  return isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.92)';
}

/**
 * The GLYPH embossed into the thing's sphere.
 *
 * On a light board it takes a want-type icon's own weight (vividIconColor's
 * darker band). On a dark board vividIconColor's bright band read as neon on
 * the sphere — the sphere is already a tint of the same hue behind it — so the
 * glyph is pulled down a step. The name (thingFaceText) goes the other way; the
 * two marks want different things now.
 */
export function thingInk(color: string, isLight: boolean): string {
  return isLight
    ? vividIconColor(color, true)
    : shade(vividIconColor(color, false), 0.78);
}

/**
 * The thing's NAME, written on its ball.
 *
 * The two themes need opposite answers, because the ball is not the same kind
 * of object in them. On a DARK board the face is the thing's colour laid over
 * near-black, so it comes out deep, and the name can be the same hue pushed to
 * vividIconColor's brightest band — a louder version of what it is written on.
 *
 * On a LIGHT board the same face is that colour over white at 85%, which lands
 * mid-to-dark for every colour a thing actually gets (#2563eb → rgb(69,122,237),
 * #c026d3 → rgb(201,70,217)). The bright band on top of that is the same
 * lightness as the ball: measured against those faces it came to between 1.0
 * and 1.7:1, which is not a contrast, and the name was effectively unreadable —
 * a name nobody can read is the one failure a thing tile cannot afford, since
 * telling two of them apart is the whole job.
 *
 * So a light board gets white, the brightest ink there is, and the hue is
 * carried by the ball and the glyph instead. Even white only reaches ~2-4:1 on
 * this palette, so it is not asked to do the work alone: thingNameShadow puts a
 * dark halo of the thing's own colour behind it.
 */
export function thingFaceText(color: string, isLight: boolean): string {
  return isLight ? 'rgba(255,255,255,0.98)' : vividIconColor(color, false);
}

/**
 * The halo behind that name — what actually makes it legible, in both themes.
 *
 * Light: a tight outline in the thing's own colour taken right down, so white
 * letters have something dark against them whatever the face underneath turns
 * out to be. That matters most for the pale end of the palette — an amber or an
 * emerald ball is light enough that white alone reads at under 2:1 — and it is
 * the thing's hue rather than flat black, so the mark stays tinted with what it
 * belongs to. A wide soft shadow here read as a grey smudge under the letters,
 * which is why this one is tight.
 *
 * Dark: unchanged. Black, and allowed to spread, because the board behind it is
 * already dark and the halo only has to deepen what is there.
 */
export function thingNameShadow(color: string, isLight: boolean): string {
  if (!isLight) return '0 1px 3px rgba(0,0,0,0.9), 0 0 7px rgba(0,0,0,0.6)';
  const deep = shade(color, 0.32);
  return `0 0 1px ${deep}, 0 1px 2px ${deep}, 0 0 4px ${deep}99`;
}

/**
 * The canvas sphere: the same face, plus what makes it a ball rather than a
 * disc — a small highlight where the light is and a darker rim opposite.
 *
 * The opaque base is there because the board's backdrop is not the tile's to
 * control: the same translucent colour reads differently over every image.
 */
export function sphereBackground(color: string, isLight: boolean, picture?: string): string {
  const base = isLight ? '#ffffff' : '#0f172a';
  return [
    // Front to back: highlight, rim, the thing's colour, an opaque base.
    // The highlight stays tight — spread wide it washes the hue out, which is
    // what made every sphere look alike.
    `radial-gradient(circle at 34% 26%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 34%)`,
    // The terminator: off-centre up-left, so the dark gathers down-right where
    // the surface turns away from the same light the highlight comes from.
    // Deeper and starting further in than it once did — at marker size a faint
    // rim was enough to suggest a ball, but on the canvas the thing now takes a
    // whole cell beside the want blocks, and at that size a shallow rim read as
    // a flat disc. A solid needs its shading to be visible, not merely present.
    `radial-gradient(circle at 44% 40%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.36) 100%)`,
    // A thing with a picture of its own (a shared photo, a cover) wears it
    // as its surface, under the same highlight and rim: still a ball, lit
    // from the same place. The colour stays beneath for while it loads.
    ...(picture ? [`url(${JSON.stringify(picture)}) center / cover no-repeat`] : []),
    `linear-gradient(${thingFaceBackground(color, isLight)}, ${thingFaceBackground(color, isLight)})`,
    `linear-gradient(${base}, ${base})`,
  ].join(', ');
}

/**
 * The proportions a thing's marks take on its ball, as fractions of the ball.
 *
 * The glyph is a decal: a want icon's size, off-centre toward the lower right
 * where the surface turns away from the light. 0.30/0.155 puts its furthest
 * corner at ~0.93 of the radius, so a square-ish glyph still lands on the ball.
 * One pair, so a ball drawn at any size — a tile, a member of a folded
 * constellation — carries its marking in the same place.
 */
export const THING_GLYPH_SIZE = 0.3;
export const THING_GLYPH_OFFSET = 0.155;

/** How much bigger the first character is than the rest of the name. */
export const DROP_CAP_SCALE = 3;

/**
 * A name split for a drop cap: the first character carries it, big; the rest
 * only qualifies it, small. Past two characters the tail collapses to an
 * ellipsis — the initial plus a "there's more" mark is enough to pick a thing
 * out at a glance, and the full string is on the title/hover.
 *
 * Split by code point, not by UTF-16 unit, so a name starting with an emoji or
 * a surrogate-pair kanji keeps its first character whole.
 */
export function dropCap(value: string): { initial: string; rest: string } {
  const chars = [...value];
  return {
    initial: chars[0] ?? '',
    rest: chars.length > 2 ? '…' : chars.slice(1).join(''),
  };
}
