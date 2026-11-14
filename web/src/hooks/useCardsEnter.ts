import { useLayoutEffect, type RefObject } from 'react';

/**
 * A panel's cards come in one after another as it opens on something — its
 * parameters, then its labels — rather than all at once: each grid of cards
 * (`data-card-grid`) inside `root`, its cards in the order they are drawn;
 * up from below, or in from the right where the grid says so
 * (data-card-grid="right": the labels).
 *
 * Played for each new subject (`key`: the want, the thing, its tab), once:
 * cards that arrive a moment later (the type read after the want, a tab drawn
 * after the first paint) join the line where it has got to; after that the
 * panel is still, and a card added or edited later just appears. Only what is
 * in view is played — a card scrolled out of sight would only hold the line
 * up. Opacity and a small lift, so the compositor plays it; none at all for
 * someone who has asked for less motion.
 */

const STEP_MS = 45;
const DURATION_MS = 240;
/** How long after the subject changes cards still join the line. */
const WINDOW_MS = 900;
/** The line is never longer than this, however many cards there are. */
const MAX_DELAY_MS = 600;

const reduced = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useCardsEnter(root: RefObject<HTMLElement | null>, key: string | null | undefined, ready = true): void {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !key || !ready || reduced() || typeof el.animate !== 'function') return;
    const seen = new WeakSet<Element>();
    const t0 = performance.now();
    let n = 0;
    /** When the last card's turn comes: a card arriving late starts no earlier than now. */
    let lineAt = t0;

    const play = () => {
      const view = el.getBoundingClientRect();
      const cards = el.querySelectorAll<HTMLElement>('[data-card-grid] > *');
      for (const card of cards) {
        if (seen.has(card)) continue;
        seen.add(card);
        // A tab on its way out (the panel's slide between tabs) is not coming in.
        if (card.closest('[data-leaving]')) continue;
        const r = card.getBoundingClientRect();
        if (r.height === 0 || r.bottom < view.top || r.top > view.bottom) continue;
        const now = performance.now();
        const at = Math.max(now, Math.min(t0 + MAX_DELAY_MS, lineAt + (n === 0 ? 0 : STEP_MS)));
        lineAt = at;
        n++;
        const fromRight = card.parentElement?.getAttribute('data-card-grid') === 'right';
        card.animate(
          [
            { opacity: 0, transform: fromRight ? 'translateX(32px)' : 'translateY(8px) scale(0.96)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: DURATION_MS, delay: at - now, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' },
        );
      }
    };

    play();
    const mo = new MutationObserver(() => {
      if (performance.now() - t0 > WINDOW_MS) { mo.disconnect(); return; }
      play();
    });
    mo.observe(el, { childList: true, subtree: true });
    const stop = setTimeout(() => mo.disconnect(), WINDOW_MS);
    return () => { mo.disconnect(); clearTimeout(stop); };
  }, [root, key, ready]);
}
