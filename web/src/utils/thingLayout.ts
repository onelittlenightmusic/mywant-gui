/**
 * Where an ordered list of things goes on the board.
 *
 * Deliberately separate from thingOrder: that decides who is first, this
 * decides what cell "first" means. Keeping the two apart is what lets the Thing
 * page use the order without caring about cells, and lets a second arrangement
 * (a wrapping line, a ring) be added without touching the sorts.
 *
 * Pure — it is handed an origin and gives back cells. Nothing here reads the
 * canvas or writes a label.
 */

/** Left to right, or top to bottom. */
export type LayoutAxis = 'row' | 'column';

/**
 * Cells between one thing and the next.
 *
 * Two rather than one: a thing tile fills its cell, so a line of adjacent tiles
 * reads as one long block rather than as a sequence of stops. One empty cell
 * between them is what makes the order visible.
 */
export const THEME_ARRANGE_STEP = 2;

export interface LineLayoutSpec {
  axis: LayoutAxis;
  /** The cell the first thing takes. Whole cells; anything else is rounded. */
  origin: { x: number; y: number };
  /** Cells between neighbours. Defaults to THEME_ARRANGE_STEP. */
  step?: number;
}

/**
 * Lay `ids` out in one evenly-spaced line from `origin`, in the given order.
 * The first id lands ON the origin — the line starts where you are standing,
 * it does not start next to you.
 */
export function lineUp(ids: string[], spec: LineLayoutSpec): Map<string, { x: number; y: number }> {
  const step = spec.step ?? THEME_ARRANGE_STEP;
  const ox = Math.round(spec.origin.x);
  const oy = Math.round(spec.origin.y);
  const out = new Map<string, { x: number; y: number }>();
  ids.forEach((id, i) => {
    out.set(id, spec.axis === 'row'
      ? { x: ox + i * step, y: oy }
      : { x: ox, y: oy + i * step });
  });
  return out;
}
