/**
 * The cubic block — the look of a want on the board, as plain functions.
 *
 * Framework-free like the rest of shared/: the board's tiles and walls
 * (WantTypeVisuals, design/cubic) and the browser extension's way back to
 * MyWant (webext pill.js, which has no React) draw a block from these, so a
 * block anywhere is the board's block.
 *
 * One base colour, one ladder: the top face is lit (light from the upper
 * left), the right face turned from it, the front face furthest — and the
 * order top > right > front holds by construction. Two separate tables used
 * to disagree about a category's hue between the top and the sides, and a
 * YAML gradient could span two hues (an amber block with a blue lid); one base
 * scaled along one ladder cannot.
 */

const FACE_TOP_HI = 1.06;
const FACE_TOP_LO = 0.88;
const FACE_RIGHT  = 0.66;
const FACE_FRONT  = 0.41;
// On a LIGHT board the shadowed faces catch bounce light off the bright ground,
// so they sit far closer to the top face. At the dark-theme ratios above they
// came out as dark slabs stuck to a white page — the block looked like it was
// wearing pasted-on skirts rather than being one shaded solid. Still ordered
// top > right > front, just a compressed ladder.
const FACE_RIGHT_LIGHT = 0.85;
const FACE_FRONT_LIGHT  = 0.72;

/**
 * How far a block's depth projects: down and right of its face, by exactly
 * this. It fixes where the board's light comes from (the upper left) and is
 * the cubic design's ground plane (design/cubic: groundOffset).
 */
export const CUBIC_DEPTH = { dx: 6, dy: 8 } as const;

/**
 * `hex`, scaled toward black (k < 1) or toward white (k > 1).
 * Returns the input untouched if it isn't a 6-digit hex.
 */
export const shade = (hex: string, k: number): string => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => {
    const out = k <= 1 ? v * k : v + (255 - v) * (k - 1);
    return Math.round(Math.min(255, Math.max(0, out))).toString(16).padStart(2, '0');
  };
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
};

/** The lit top face of a block in `base`. 160deg = light from the upper left,
 *  the same direction the walls project their depth and a thing's sphere puts
 *  its highlight. */
export const bodyTopFace = (base: string): string =>
  `linear-gradient(160deg, ${shade(base, FACE_TOP_HI)} 0%, ${shade(base, FACE_TOP_LO)} 100%)`;

/** The right face — turned away from the light. `isLight` is the board's mode:
 *  a compressed ladder on a light board (see FACE_RIGHT_LIGHT). */
export const bodyRightFace = (base: string, isLight = false): string =>
  shade(base, isLight ? FACE_RIGHT_LIGHT : FACE_RIGHT);

/** The front/bottom face — turned furthest from it. */
export const bodyFrontFace = (base: string, isLight = false): string =>
  shade(base, isLight ? FACE_FRONT_LIGHT : FACE_FRONT);

export interface CubicBlockOptions {
  /** The face's side, px (a square block). */
  size: number;
  /** The base colour (6-digit hex) every face is shaded from. */
  base: string;
  /** The board is light (a compressed ladder) or dark. */
  isLight?: boolean;
  /** Drawn on the face, as markup — an icon's SVG and/or a word. Trusted. */
  faceHtml?: string;
}

/**
 * One block as markup: the face, with its right and front walls projected by
 * CUBIC_DEPTH and the walls' fold lines — what CubicWalls draws under a tile,
 * here for a page with no board. Square: the walls meet the face at its exact
 * corners, which a radius would open (see --r-tile). Its box is the face plus
 * the depth; the face sits at its top left.
 */
export function cubicBlockHtml(o: CubicBlockOptions): string {
  const W = o.size, H = o.size;
  const { dx, dy } = CUBIC_DEPTH;
  const isLight = !!o.isLight;
  const edgeTop   = isLight ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.4)';
  const edgeFront = isLight ? 'rgba(0,0,0,0.13)' : 'rgba(0,0,0,0.32)';
  const right = `${W},0 ${W},${H} ${W + dx},${H + dy} ${W + dx},${dy}`;
  const front = `0,${H} ${W},${H} ${W + dx},${H + dy} ${dx},${H + dy}`;
  return (
    `<span style="position:relative;display:block;width:${W + dx}px;height:${H + dy}px">` +
      `<svg width="${W + dx}" height="${H + dy}" viewBox="0 0 ${W + dx} ${H + dy}" style="position:absolute;left:0;top:0;overflow:visible" aria-hidden="true">` +
        `<polygon points="${right}" fill="${bodyRightFace(o.base, isLight)}"/>` +
        `<polygon points="${front}" fill="${bodyFrontFace(o.base, isLight)}"/>` +
        // The folds CubicWalls strokes: the right face's top edge, the front
        // face's left edge, and its foot.
        `<line x1="${W}" y1="0" x2="${W + dx}" y2="${dy}" stroke="${edgeTop}" stroke-width="0.8"/>` +
        `<line x1="0" y1="${H}" x2="${dx}" y2="${H + dy}" stroke="${edgeFront}" stroke-width="0.8"/>` +
        `<line x1="${dx}" y1="${H + dy}" x2="${W + dx}" y2="${H + dy}" stroke="${edgeFront}" stroke-width="0.8"/>` +
      `</svg>` +
      `<span style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;box-sizing:border-box;` +
        `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;` +
        `background:${bodyTopFace(o.base)}">${o.faceHtml ?? ''}</span>` +
    `</span>`
  );
}
