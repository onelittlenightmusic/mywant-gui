/**
 * A tile's size on the board, for wants and things alike: a whole cell, or a
 * half or a quarter of one — and, smaller, where in its cell it stands.
 *
 * The board's cells stay whole numbers. A want's position is still the cell
 * it is in (mywant.io/canvas-x / -y, integers, as the server and every reader
 * of a want's place have them), and a small want adds where in that cell its
 * centre is (mywant.io/canvas-cx / -cy: −¼, 0, ¼ — on a dot). A thing already
 * rests at a real position, its centre on a dot.
 *
 * A small tile is drawn as a whole one scaled down about its slot's corner, so
 * its face, glyph and marks keep their proportions (see WantTilesLayer,
 * ThingTilesLayer).
 */

export const CANVAS_LABEL_SIZE = 'mywant.io/canvas-size';
/** A small tile's centre in its cell, cells from the cell's centre (−¼, 0, ¼). */
export const CANVAS_LABEL_CX = 'mywant.io/canvas-cx';
export const CANVAS_LABEL_CY = 'mywant.io/canvas-cy';
/** Its corner instead, from the cell's corner — read from wants written before the centre was kept. */
export const CANVAS_LABEL_SUB_X = 'mywant.io/canvas-sub-x';
export const CANVAS_LABEL_SUB_Y = 'mywant.io/canvas-sub-y';

/** The sizes offered, largest first: a whole cell, a half, a quarter. */
export const TILE_SIZES = [1, 0.5, 0.25] as const;
export type TileSize = typeof TILE_SIZES[number];

/** The size a tile's labels give it; a whole cell when they say nothing usable. */
export function tileSizeOf(labels: Record<string, string> | undefined): TileSize {
  const n = Number(labels?.[CANVAS_LABEL_SIZE]);
  return (TILE_SIZES as readonly number[]).includes(n) ? (n as TileSize) : 1;
}

/** The next size along — 1 → ½ → ¼ → 1 — what one press of Size does. */
export function nextTileSize(s: TileSize): TileSize {
  const i = TILE_SIZES.indexOf(s);
  return TILE_SIZES[(i + 1) % TILE_SIZES.length];
}

/** How a size is written for a person: 1, 1/2, 1/4. */
export function tileSizeLabel(s: TileSize): string {
  return s === 1 ? '1' : s === 0.5 ? '1/2' : '1/4';
}

/** `v` floored onto the grid of `step` (a small float error is not a step down). */
export function snapDown(v: number, step: number): number {
  return Math.floor(v / step + 1e-6) * step;
}

/**
 * Where a small tile's centre may stand in its cell, `v` cells from the
 * cell's centre: on the ground's finest dots — a quarter of a cell, the dots
 * the character steps on and a thing is set on — and the tile inside its
 * cell, so a quarter's or a half's centre is one of −¼, 0, ¼. The nearest of
 * them; never the edge between two cells. A whole tile's is the cell's own.
 */
export function snapOffset(v: number, s: number): number {
  if (s >= 1) return 0;
  const lo = Math.ceil((s / 2 - 0.5) * 4 - 1e-9) / 4;
  const hi = Math.floor((0.5 - s / 2) * 4 + 1e-9) / 4;
  return Math.min(hi, Math.max(lo, Math.round(v * 4) / 4));
}

/**
 * Where a small tile carried to point `p` (cells from a cell's centre, as
 * the board's dots are counted) actually lands: the cell `p` is in, and its
 * centre's offset in that cell (snapOffset). What a carry's ghost is drawn
 * on, so the ghost is where the drop puts it — a dot on a cell's edge, where
 * a tile of the size would stick out of its cell, lands on the dot inside.
 */
export function landingCentre(p: { x: number; y: number }, s: number): {
  cell: { x: number; y: number }; off: { x: number; y: number }; x: number; y: number;
} {
  const cell = { x: Math.round(p.x), y: Math.round(p.y) };
  const off = { x: snapOffset(p.x - cell.x, s), y: snapOffset(p.y - cell.y, s) };
  return { cell, off, x: cell.x + off.x, y: cell.y + off.y };
}

/**
 * Where in its cell a small tile's centre stands, from its labels: cells from
 * the cell's centre (mywant.io/canvas-cx / -cy), put on a dot inside the cell
 * (snapOffset) — so a resize keeps it, there being nothing to recompute.
 *
 * A want written before the centre was kept has its corner instead
 * (mywant.io/canvas-sub-x / -y, from the cell's corner); that is read as the
 * centre it gives, and the next move or resize writes the centre.
 */
export function tileOffsetOf(labels: Record<string, string> | undefined, s: number): { x: number; y: number } {
  if (s >= 1) return { x: 0, y: 0 };
  const num = (k: string) => {
    const n = Number(labels?.[k]);
    return labels?.[k] !== undefined && Number.isFinite(n) ? n : null;
  };
  const one = (c: string, sub: string) => {
    const v = num(c);
    if (v !== null) return snapOffset(v, s);
    const corner = num(sub);
    return snapOffset(corner !== null ? corner + s / 2 - 0.5 : 0, s);
  };
  return { x: one(CANVAS_LABEL_CX, CANVAS_LABEL_SUB_X), y: one(CANVAS_LABEL_CY, CANVAS_LABEL_SUB_Y) };
}

/** The labels that put a small tile's centre `off` cells from its cell's centre. */
export function offsetLabels(off: { x: number; y: number }): Record<string, string> {
  return { [CANVAS_LABEL_CX]: String(off.x), [CANVAS_LABEL_CY]: String(off.y) };
}

/**
 * Whether two small tiles of the same cell overlap, each given by its centre's
 * offset in the cell and its size.
 */
export function offsetsOverlap(a: { x: number; y: number }, as: number, b: { x: number; y: number }, bs: number): boolean {
  const reach = (as + bs) / 2 - 1e-6;
  return Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach;
}

