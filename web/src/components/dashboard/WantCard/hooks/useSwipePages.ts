import React, { useRef } from 'react';
import type { ResultPages } from './useResultPages';

/**
 * Dealing through a card's answers by swiping across it.
 *
 * The edge controls are a target you have to hit; on a phone the gesture for a
 * stack of cards is to push the top one aside, and the card is the whole
 * target. Swiping LEFT pushes the top card off the way it is dealt, which is
 * the same thing the right-hand control does — it advances. Swiping right
 * brings the card you came from back on.
 *
 * Deliberately not interactive mid-gesture: the card does not follow the
 * finger. It cannot, for the same reason the deal is two animations rather than
 * one — only one answer is ever mounted, so there is nothing behind the face to
 * reveal as it moves. The swipe is read as a decision and then the deal plays,
 * which is also why the threshold is generous: a gesture that commits on 8px
 * with no visual feedback fires when somebody meant to tap.
 *
 * No conflict with the press gestures the card already has. A hold commits the
 * quick-actions overlay at 150ms and the touch reorder arms off that
 * (useLongPress, useTouchReorder) — but any movement over 10px in that window
 * cancels the hold, so a swipe cancels it on the way past, and once the overlay
 * IS up the face is pointer-events-none (see WantCard) so nothing here can
 * fire. Mouse drags mostly go to HTML5 drag-and-drop instead, which is the
 * card's own reordering; this is a touch gesture and reads as one.
 */

/** How far across the card counts as a swipe rather than a slip of the thumb. */
const SWIPE_PX = 44;
/** How much more horizontal than vertical, so a scroll is never a deal. */
const SWIPE_RATIO = 1.4;

export function useSwipePages(pages: ResultPages): React.HTMLAttributes<HTMLElement> {
  const from = useRef<{ x: number; y: number; id: number } | null>(null);
  // A swipe ends in a click on the card, and the card opens the detail panel.
  // The one that follows the gesture is swallowed rather than the pointer
  // events stopped, because the click is what the board listens for.
  const swallowClick = useRef(false);

  if (pages.pages.length < 2) return {};

  return {
    // Vertical scrolling stays the browser's; horizontal comes here. Only set
    // on a card that has a deck, so an ordinary card's touch behaviour is
    // untouched.
    style: { touchAction: 'pan-y' },

    onPointerDown: (e) => {
      if (!e.isPrimary) return;
      from.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    },

    onPointerMove: (e) => {
      const start = from.current;
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
      // Decided. Cleared first, so the rest of this gesture is inert rather
      // than dealing a second card as the finger keeps going.
      from.current = null;
      swallowClick.current = true;
      // Pushing the card left is the deal, so it does what the right-hand
      // control does: advance. Same physical action, same result.
      pages.turn(dx < 0 ? -1 : 1);
    },

    onPointerUp: () => { from.current = null; },
    onPointerCancel: () => { from.current = null; },

    onClickCapture: (e) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  };
}
