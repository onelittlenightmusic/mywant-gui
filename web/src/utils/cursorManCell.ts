/**
 * Where my character stands on the board, for placing a new want there.
 *
 * Every way of adding a want — the Add Want sidebar, a card overlay's Add, a
 * recipe or example deploy, a Web Want's Launch — should put it where the
 * character is, not wherever auto-placement spirals out from the origin. The
 * position is the dashboard's own state, though, and most of those paths run
 * outside it. So the dashboard publishes it here as it changes, and
 * apiClient.createWant reads it back for any want that names no cell itself.
 *
 * Module state rather than a store: nothing renders from it, and the API client
 * that reads it must not import the stores (they import the client).
 */
export type Cell = { x: number; y: number };

let known: Cell | null = null;

/** The dashboard's CursorMan cell (or its canvas centre while it has none). */
export function publishCursorManCell(cell: Cell | null | undefined): void {
  if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) return;
  known = { x: Math.round(cell.x), y: Math.round(cell.y) };
}

/** The last cell the dashboard published, or null if it has not been open. */
export function knownCursorManCell(): Cell | null {
  return known;
}
