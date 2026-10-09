/**
 * A tile's size on the board, for wants and things alike: a whole cell, or a
 * half or a quarter of one — and, smaller, where in its cell it stands.
 *
 * The board's cells stay whole numbers. A want's position is still the cell
 * it is in (mywant.io/canvas-x / -y, integers, as the server and every reader
 * of a want's place have them), and a small want adds where in that cell it
 * sits (mywant.io/canvas-sub-x / -y: 0, ¼, ½, ¾). A thing already rests at a
 * real position, so a small thing's is simply finer: a multiple of its size.
 *
 * A small tile is drawn as a whole one scaled down about its slot's corner, so
 * its face, glyph and marks keep their proportions (see WantTilesLayer,
 * ThingTilesLayer).
 */

export const CANVAS_LABEL_SIZE = 'mywant.io/canvas-size';
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
 * Where in its cell a tile of size `s` stands: the offset of its slot from
 * the cell's corner, each axis a multiple of `s` below 1. Read from the
 * labels, snapped onto the size's grid — a want made ¼ then put back to ½
 * keeps a place a half can stand on.
 */
export function tileSubOf(labels: Record<string, string> | undefined, s: TileSize): { x: number; y: number } {
  if (s >= 1) return { x: 0, y: 0 };
  const read = (k: string) => {
    const n = Number(labels?.[k]);
    return Number.isFinite(n) ? Math.min(1 - s, Math.max(0, snapDown(n, s))) : 0;
  };
  return { x: read(CANVAS_LABEL_SUB_X), y: read(CANVAS_LABEL_SUB_Y) };
}

/**
 * The slot a point falls in, for a tile of size `s`: `g` is the point in
 * grid units (cells, fractional), and the slot's corner is returned, a
 * multiple of `s`. A whole tile's slot is the cell itself.
 */
export function slotAt(g: number, s: TileSize): number {
  return snapDown(g, s);
}

/** Whether two slots, each a square of its size from its corner, overlap. */
export function slotsOverlap(
  ax: number, ay: number, as: number,
  bx: number, by: number, bs: number,
): boolean {
  const e = 1e-6;
  return ax < bx + bs - e && bx < ax + as - e && ay < by + bs - e && by < ay + as - e;
}
