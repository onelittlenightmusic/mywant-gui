/**
 * Who the left stick belongs to right now: the board, or a panel in front of it.
 *
 * This used to be derived, every frame, from where a sidebar was — the board
 * took the stick back whenever no panel was on screen and gave it up the
 * instant one appeared (WantCanvas's poll, and useFreeCursorNav's mirror of the
 * same test). Deriving it is what made the stick die under the user's thumb:
 * walking onto a want opens the detail panel as a *side effect of the move*, so
 * the move itself was what took the stick away. The character stopped, mid-walk,
 * because it had arrived somewhere.
 *
 * So ownership is a fact that is handed over, not one that is recomputed. It
 * changes only when someone says so:
 *
 *   - `giveStickToPanel()` — Enter/A on the board ("look inside this"), opening
 *     a form, or a real pointer press inside a panel. All of them are the user
 *     asking to be in there.
 *   - `giveStickToBoard()` — Escape/B, the panel closing, walking onto another
 *     tile, or a press on the board itself.
 *
 * A panel appearing, DOM focus moving, a card lighting up: none of those are a
 * handover. The panel that follows the character around is allowed to be on
 * screen without owning anything, which is what lets the stick keep working
 * after you land on a tile — and what lets it keep working *inside* the panel
 * once you have deliberately gone in, since landing on a field in there no
 * longer bounces ownership back out.
 *
 * A module-level value rather than a store: it is read from rAF poll loops
 * (60fps, two of them) that must see the change the same frame it is made, and
 * nothing renders from it.
 */
export type StickOwner = 'board' | 'panel';

let _owner: StickOwner = 'board';

/** Hand the stick to the panel in front of the board. Deliberate acts only. */
export function giveStickToPanel(): void {
  _owner = 'panel';
}

/** Hand the stick back to the board. */
export function giveStickToBoard(): void {
  _owner = 'board';
}

/** Does a panel hold the stick right now? */
export function isStickWithPanel(): boolean {
  return _owner === 'panel';
}
