/**
 * Where a want stands on the board, as far as the want itself says — the
 * labels its position is kept in, and which wants have no place at all.
 *
 * The board (the canvas) reads these to lay itself out; the list and the
 * forms write them when they create a want, so a new want lands where it was
 * made. Kept apart from the board's geometry for that reason.
 */

// ── System wants ─────────────────────────────────────────────────────────────

/**
 * True for wants the server manages rather than a user — infrastructure, not
 * a thing on the board. The frontend's one rule for canvas/list display: a
 * system want never draws a tile plate, isometric depth face, or minimap
 * square, whatever type it happens to be. (It still occupies a cell for
 * collision/focus purposes — walking onto one still opens its card — this is
 * only about what gets *drawn*.)
 *
 * Decided by IsSystemWant itself, not a hand-kept list of type names: the
 * server already keeps its own such list (alwaysVisibleSystemWantTypes, in
 * handlers_wants.go) for the separate question of which system wants are
 * even sent to the client at all — everything that reaches here has already
 * passed that gate, so a type added to that server-side list tomorrow
 * doesn't also need a matching entry added here to stay tile-less.
 *
 * Every one of these today (robot, character_chat, character_motion)
 * happens to be character-related, which is why every surface that draws
 * tiles filters with this and draws a character token instead — but the
 * rule itself is about being system-managed, not about being a character;
 * nothing here assumes the two coincide forever. The robot IS its want and
 * gets a token drawn for it (isTokenDrawnWant, below); a character's chat
 * and motion wants get nothing drawn at all — the character is drawn from
 * their cursor, and a token here would be the same person twice.
 */
export function isSystemWant(want: { metadata?: { type?: string; isSystemWant?: boolean } }): boolean {
  return Boolean(want.metadata?.isSystemWant);
}

/** True for the one character want that is drawn as a token: the robot, which
 *  has no cursor to be drawn from — see useRemoteCursors. */
export function isTokenDrawnWant(want: { metadata?: { type?: string } }): boolean {
  return want.metadata?.type === 'robot';
}

/**
 * True for a want that takes up no room of its own.
 *
 * A character's chat want stands on its character's cell so that walking onto
 * them opens it, and it is drawn by nothing — the character is already drawn
 * from their cursor. So it must share whatever cell it is on rather than claim
 * it: the layout gives a cell to the first want that asks and spirals the rest
 * away near the origin, which meant stepping onto the robot put a chat want on
 * its cell and shot the robot off to a fixed spot nobody asked for.
 */
export function isOverlayWant(want: { metadata?: { type?: string } }): boolean {
  return want.metadata?.type === 'character_chat';
}

/**
 * True for a system want that has no presence on the board at all — no tile,
 * no token, no entry in positionMap, nothing. `character_motion` is the one
 * of these today: it mirrors a character's own resolved position purely for
 * the engine's own bookkeeping (footstep/occupancy checks against the
 * character's cell), so that position is *always* exactly the cell the
 * character is standing on. Giving it board presence too meant standing on
 * your own character — which is where you always are — could resolve to
 * your own motion want and open its card from nothing more than standing
 * still, and (once its tile stopped being drawn at all, see isSystemWant)
 * left a stray mark at your own feet with nothing to explain it.
 *
 * The other two system wants deliberately keep their board presence: the
 * robot IS its own want (see isTokenDrawnWant) and a character's chat want
 * deliberately shares their cell so that walking onto them opens it (see
 * isOverlayWant). Only a system want that is neither of those is dropped
 * here — every positionMap-style builder (WantCanvas, WantMinimap,
 * useWorldThumbnail) should skip a want entirely, before even looking at its
 * canvas-x/-y labels, when this is true.
 */
export function isUnplacedSystemWant(want: { metadata?: { type?: string; isSystemWant?: boolean } }): boolean {
  return isSystemWant(want) && !isOverlayWant(want) && !isTokenDrawnWant(want);
}

// ── Canvas label keys ─────────────────────────────────────────────────────────

export const CANVAS_LABEL_X        = 'mywant.io/canvas-x';
export const CANVAS_LABEL_Y        = 'mywant.io/canvas-y';
export const CANVAS_LABEL_ROTATION = 'mywant.io/canvas-rotation';
export const CANVAS_LABEL_LENGTH   = 'mywant.io/canvas-length';

