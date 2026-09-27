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

/** The stop to move to from `from`, or null when there is nothing that way. */
function pick(from: Rect, stops: HTMLElement[], dir: Dir): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of stops) {
    const r = rectOf(el);
    // Along the direction of travel, measured edge to centre so a wide control
    // beside a narrow one is not judged by its far side.
    const along = dir === 'up'   ? from.top - r.cy
                : dir === 'down' ? r.cy - from.bottom
                : dir === 'left' ? from.left - r.cx
                :                  r.cx - from.right;
    if (along <= 0) continue;                 // behind, or overlapping — not that way
    const off = dir === 'up' || dir === 'down'
      ? Math.abs(r.cx - from.cx)
      : Math.abs(r.cy - from.cy);
    const score = along + off * OFF_AXIS_WEIGHT;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
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

      const stops = Array.from(root.querySelectorAll<HTMLElement>(`[${FREE_CURSOR_ITEM_ATTR}]`))
        .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled'));
      if (stops.length === 0) return;

      // Arriving from outside: land on the first stop rather than guessing a
      // direction from a caret that is not in here.
      const here = active && root.contains(active) && active.hasAttribute(FREE_CURSOR_ITEM_ATTR)
        ? active
        : null;
      const next = here ? pick(rectOf(here), stops.filter(s => s !== here), dir) : stops[0];
      if (!next) return;   // edge of the panel — leave the key to whoever else wants it

      e.preventDefault();
      e.stopPropagation();
      next.focus({ preventScroll: false });
    };

    // Bubble phase on the panel: anything that handles its own arrows (a slider
    // dragging, a text box) has already consumed them by the time this runs.
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [rootRef, enabled]);
}
