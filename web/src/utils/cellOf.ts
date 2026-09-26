/**
 * Which cell something is standing on.
 *
 * A want sits on a cell. A thing does not have to: it rests wherever it stopped
 * sliding, which is a real number, and the board draws it there. But every
 * question of the form "what is under the character", "what did this get
 * dropped on", "is this square taken" is about a SQUARE — a thing three tenths
 * of a cell past the character's feet is the thing at their feet.
 *
 * So positions stay exact and the comparison rounds. The alternative, snapping
 * the position itself, throws away the only thing that made the motion look
 * like motion.
 */
export interface GridPos { x: number; y: number }

/** The cell a position falls in. */
export function cellOf(p: GridPos): GridPos {
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** Whether a position is standing on the cell (x, y). */
export function atCell(p: GridPos, x: number, y: number): boolean {
  return Math.round(p.x) === Math.round(x) && Math.round(p.y) === Math.round(y);
}

/**
 * The first entry standing on (x, y), or null.
 *
 * "First" is as arbitrary as it was when positions were whole numbers and two
 * things could share a cell exactly; callers that care collect them all.
 */
export function idAtCell(positions: Map<string, GridPos>, x: number, y: number): string | null {
  for (const [id, p] of positions.entries()) if (atCell(p, x, y)) return id;
  return null;
}

/** Everything standing on (x, y). */
export function idsAtCell(positions: Map<string, GridPos>, x: number, y: number): string[] {
  const out: string[] = [];
  for (const [id, p] of positions.entries()) if (atCell(p, x, y)) out.push(id);
  return out;
}
