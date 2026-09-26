import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useInputHandedOver } from '@/stores/focusOwner';

/** Marks the card a grid currently has selected. Set by every card grid. */
const SELECTED_CARD_SELECTOR = '[data-keyboard-nav-selected="true"]';

/**
 * The grey that says the keys are in the panel now, not out here.
 *
 * Mounted once at the app root, beside the sidebar shell it belongs to. It used
 * to be the want dashboard's own markup, which is why every other page handed
 * input over with nothing on screen to show for it: the panel lit its frame and
 * the grid behind it looked exactly as live as before. One surface, one fact,
 * read by both sides — the panel's frame and this — so they cannot disagree
 * about where a keypress is going.
 *
 * The selected card is raised through the dim rather than left under it, so the
 * pair reads as "this one, over there" instead of "everything is off". Which
 * card that is comes from data-keyboard-nav-selected, the attribute every grid
 * already sets for keyboard navigation, so no page has to opt in.
 *
 * pointer-events stay off throughout: this reports where the keys are, it does
 * not lock the mouse out of the page.
 *
 * The board is the one surface that dims itself. Its scrim has to live inside
 * the scaled, scrolling canvas layer — under the tile the panel is about, which
 * is raised through it by a z-layer the canvas owns — and that is not somewhere
 * a viewport-fixed overlay can be. Two dims would also stack to near-black and
 * grey the header, which on the board it never has. So the board opts out here
 * and keeps its own, which predates this and is drawn from the same one fact.
 */
export const HandoverScrim: React.FC = () => {
  const handedOver = useInputHandedOver();
  const onCanvas = useLocation().pathname === '/canvas';
  const show = handedOver && !onCanvas;

  useEffect(() => {
    if (!show) return;
    // Queried once on the way in, not watched. The selection cannot change
    // while the grid is not the one listening — that is the whole point of the
    // state this draws — and re-finding it on a timer would cost a DOM sweep
    // per frame for something that does not move.
    const el = document.querySelector<HTMLElement>(SELECTED_CARD_SELECTOR);
    if (!el) return;
    el.classList.add('mw-focus-lift');
    return () => el.classList.remove('mw-focus-lift');
  }, [show]);

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none"
      style={{ background: 'rgba(30, 34, 42, 0.55)' }}
    />
  );
};
