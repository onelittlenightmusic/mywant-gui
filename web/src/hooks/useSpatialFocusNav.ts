import { useEffect } from 'react';
import { FREE_CURSOR_ITEM_ATTR } from '@/hooks/useFreeCursorNav';

/**
 * Walking a panel's controls with the arrows, by where they are.
 *
 * A card grid can be walked by index because it IS a grid — useCardGridNavigation
 * takes a count and a column span and does the arithmetic. A settings sheet is
 * not: it is rows of pills of different widths, a strip of colour swatches, a
 * slider. There is no row length to divide by, and any number chosen for one
 * would be wrong for the next section added.
 *
 * So the arrows are answered geometrically. Every control already declares
 * itself a stop for the roaming cursor (data-free-cursor-item, added so the
 * stick has somewhere to land); this walks that same set. One list of stops,
 * two ways to reach them — the stick pointing at one, and the arrows stepping
 * to the nearest one that way.
 *
 * The scoring is the usual one for spatial navigation: of the candidates that
 * genuinely lie in the direction pressed, prefer the closest along that axis,
 * and break ties by how far off the line they sit. Weighted rather than
 * lexicographic, because a control a long way along the axis but exactly in
 * line is usually the wrong answer next to one just past the corner.
 */

type Dir = 'up' | 'down' | 'left' | 'right';

/** The "you are here" ring on an element the keys were just put on (.mw-walked),
 *  until focus leaves it — for the walk, and for anything that moves the keys
 *  along by itself (a picture's buttons, changing under them). */
export function markWalked(el: HTMLElement): void {
  el.classList.add('mw-walked');
  el.addEventListener('blur', () => el.classList.remove('mw-walked'), { once: true });
}

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};

/** How much a sideways offset counts against a candidate, relative to distance
 *  along the direction of travel. Above 1, so "roughly straight ahead" wins. */
const OFF_AXIS_WEIGHT = 2;

interface Rect { cx: number; cy: number; left: number; right: number; top: number; bottom: number }

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
}

/** How far past the nearest stop that way another still counts as the same
 *  row (or column) — the cells of one row are never quite level. */
const SAME_ROW_PX = 12;

/** The stop to move to from `from`, or null when there is nothing that way.
 *
 *  One row at a time, as a table is walked: the nearest row that way first
 *  (the stops whose near edge is within SAME_ROW_PX of the nearest one's),
 *  and in it the one most nearly in line. Scored as one sum, a stop straight
 *  ahead but rows away beat the row next door whenever that row's controls
 *  sat to one side — a panel's buttons, left-aligned, were stepped over to
 *  the cards below them. */
function pick(from: Rect, stops: HTMLElement[], dir: Dir): HTMLElement | null {
  const ahead: { el: HTMLElement; near: number; off: number; score: number }[] = [];
  for (const el of stops) {
    const r = rectOf(el);
    // Along the direction of travel, measured edge to centre so a wide control
    // beside a narrow one is not judged by its far side.
    const along = dir === 'up'   ? from.top - r.cy
                : dir === 'down' ? r.cy - from.bottom
                : dir === 'left' ? from.left - r.cx
                :                  r.cx - from.right;
    if (along <= 0) continue;                 // behind, or overlapping — not that way
    // Its near edge, for which row it is in.
    const near = dir === 'up'   ? from.top - r.bottom
               : dir === 'down' ? r.top - from.bottom
               : dir === 'left' ? from.left - r.right
               :                  r.left - from.right;
    // Past the edge it leaves from, not merely centred further on: a wide row
    // above a button reaches past it to the right, and is not to its right.
    if (near < -SAME_ROW_PX) continue;
    const off = dir === 'up' || dir === 'down'
      ? Math.abs(r.cx - from.cx)
      : Math.abs(r.cy - from.cy);
    ahead.push({ el, near, off, score: along + off * OFF_AXIS_WEIGHT });
  }
  if (ahead.length === 0) return null;
  const nearest = Math.min(...ahead.map(a => a.near));
  const row = ahead.filter(a => a.near <= nearest + SAME_ROW_PX);
  row.sort((a, b) => a.off - b.off || a.score - b.score);
  return row[0].el;
}

/**
 * @param rootRef  the panel whose controls are walked
 * @param enabled  false while something else owns the arrows (an open editor)
 */
export function useSpatialFocusNav(
  rootRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;

      const active = document.activeElement as HTMLElement | null;
      // A range input spends the horizontal arrows on its own value — that is
      // what it is for. Vertical arrows still leave it.
      if (active instanceof HTMLInputElement && active.type === 'range'
          && (dir === 'left' || dir === 'right')) return;
      // Typing wins over walking, always.
      if (active && (active.tagName === 'TEXTAREA'
                  || (active.tagName === 'INPUT' && (active as HTMLInputElement).type !== 'range')
                  || active.isContentEditable)) return;

      // The places themselves, not what holds them: a stop with stops in it
      // (a card around its buttons) is walked through to those. Except a
      // panel's landing spot ([data-sidebar-primary]): it and the card in it
      // are one place, the one the keys arrived at.
      const all = Array.from(root.querySelectorAll<HTMLElement>(`[${FREE_CURSOR_ITEM_ATTR}]`))
        .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));
      const stops = all.filter(el => el.hasAttribute('data-sidebar-primary')
        || (!el.parentElement?.closest('[data-sidebar-primary]')
            && !all.some(other => other !== el && el.contains(other))));
      if (stops.length === 0) return;

      // Arriving from outside: land on the first stop rather than guessing a
      // direction from a caret that is not in here.
      const here = active && root.contains(active) && stops.includes(active)
        ? active
        : null;
      const next = here ? pick(rectOf(here), stops.filter(s => s !== here), dir) : stops[0];
      if (!next) return;   // edge of the panel — leave the key to whoever else wants it

      e.preventDefault();
      e.stopPropagation();
      // A stop the pointer lands on need not take focus by itself (a card's
      // box): it is made to, so the keys can land there too.
      if (next.tabIndex < 0 && !next.hasAttribute('tabindex')) next.tabIndex = -1;
      next.focus({ preventScroll: false });
      // Said where it is: the "you are here" ring (.mw-walked), put on by the
      // walk itself — the browser's own focus ring shows for a key it trusts,
      // not for the pad's D-pad, which arrives as a key made for it — and
      // taken off as focus leaves.
      markWalked(next);
    };

    // Bubble phase on the panel: anything that handles its own arrows (a slider
    // dragging, a text box) has already consumed them by the time this runs.
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [rootRef, enabled]);
}
