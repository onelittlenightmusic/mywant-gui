import type React from 'react';
import { useEffect, useState } from 'react';

/**
 * Panels that come out of the button that opened them.
 *
 * A surface that fades in where it will end up tells you it arrived; one that
 * travels out of the control you just pressed tells you *what* opened it. The
 * pad was given this first — its face buttons leave the header's Pad cell one
 * after another and fold back into it — and there is no reason the menus should
 * behave differently. Same button, same row, same act.
 *
 * The geometry is the whole of it: closed, a panel sits scaled down on the
 * origin's centre; open, it is where it belongs. What moves is the difference
 * between the two, in both axes, so a header docked to the top and a header
 * docked to the bottom both work without a case for either.
 */

/**
 * Opening is watched; closing is not.
 *
 * Quicker than they were (260/140, 26 apart). With six buttons the last one
 * used to start 130ms after the first and finish 390ms after the press — which
 * is a fifth of a second spent watching the pad arrive, every time, on a
 * control you reach for constantly. The stagger is what makes them read as
 * coming out of the button rather than appearing, and it survives being
 * halved; the travel does not need the extra 90ms to be legible.
 *
 * Last button out at 5 × 14 + 170 = 240ms, and back in by 180.
 */
export const REVEAL_OPEN_MS = 170;
export const REVEAL_CLOSE_MS = 110;
/** How far apart consecutive items leave. Zero for a panel that moves as one. */
export const REVEAL_STAGGER_MS = 14;
/** A little past 1 on the way out: a spring settling, not a panel sliding. */
export const REVEAL_OPEN_EASE = 'cubic-bezier(0.34, 1.4, 0.5, 1)';
export const REVEAL_CLOSE_EASE = 'cubic-bezier(0.4, 0, 1, 1)';

/**
 * Whether this viewer has asked for less movement.
 *
 * An opening animation is decoration; every one of these panels works
 * identically without it. So it is dropped rather than shortened for anyone who
 * has said so at the OS level.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() =>
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

export interface RevealState {
  /** In the tree — true through the whole of a close, so the exit can be seen. */
  mounted: boolean;
  /** What the styles are animating towards. */
  shown: boolean;
  /** Where the opening control is, in viewport pixels, as of this opening. */
  origin: { x: number; y: number } | null;
  reduceMotion: boolean;
}

/**
 * Track an open/close so the panel can be seen leaving as well as arriving.
 *
 * Three states rather than one, because a closing animation has to run on
 * something still in the tree: unmounting on the flag alone deletes the panel
 * on the frame the user asked it to go, and the exit is never seen. So closing
 * keeps it mounted until the last item has finished, and opening mounts it a
 * frame BEFORE flipping `shown`, so the browser has a closed style to
 * transition away from — set both at once and it interpolates from nothing and
 * paints the end state.
 *
 * `originSelector` is read at the moment of opening rather than assumed:
 * the header docks top on some layouts and bottom on others, and the row's
 * contents change with the page, so the button is not at a coordinate this
 * could name.
 */
export function useOriginReveal(open: boolean, originSelector: string, items = 1): RevealState {
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setShown(false);
      const id = setTimeout(
        () => setMounted(false),
        reduceMotion ? 0 : REVEAL_CLOSE_MS + REVEAL_STAGGER_MS * items,
      );
      return () => clearTimeout(id);
    }

    const el = document.querySelector(originSelector);
    if (el) {
      const r = el.getBoundingClientRect();
      setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    } else {
      setOrigin(null);
    }
    setMounted(true);

    // A frame is the right unit for "let the closed style be painted once", and
    // a timer is the fallback, because a hidden tab freezes
    // requestAnimationFrame outright — open a panel in a background tab and the
    // frame that was going to reveal it never comes.
    let done = false;
    const reveal = () => { if (!done) { done = true; setShown(true); } };
    const frame = requestAnimationFrame(() => requestAnimationFrame(reveal));
    const timer = setTimeout(reveal, 32);
    return () => { done = true; cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [open, originSelector, items, reduceMotion]);

  return { mounted, shown, origin, reduceMotion };
}

/**
 * The style that carries one thing between the origin and its resting place.
 *
 * `rect` is where the thing sits when open. `order` is its place in the stagger
 * — 0 leaves first on the way out and last on the way back — and `total` how
 * many are travelling, so the closing order can be reversed without the caller
 * doing the arithmetic.
 *
 * `transformOrigin` faces the button, so a shrinking panel collapses toward it
 * rather than toward its own centre and drifting off the path.
 */
export function revealStyle(
  state: RevealState,
  rect: { left: number; top: number; width: number; height: number },
  order = 0,
  total = 1,
): React.CSSProperties {
  const { shown, origin, reduceMotion } = state;
  if (reduceMotion) return {};

  const from = origin ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height + 12 };
  const dx = from.x - (rect.left + rect.width / 2);
  const dy = from.y - (rect.top + rect.height / 2);
  const step = shown ? order : Math.max(0, total - 1 - order);

  return {
    transform: shown ? 'translate(0, 0) scale(1)' : `translate(${dx}px, ${dy}px) scale(0.2)`,
    opacity: shown ? 1 : 0,
    transformOrigin: `${dx >= 0 ? '100%' : '0%'} ${dy >= 0 ? '100%' : '0%'}`,
    transition: [
      `transform ${shown ? REVEAL_OPEN_MS : REVEAL_CLOSE_MS}ms ${shown ? REVEAL_OPEN_EASE : REVEAL_CLOSE_EASE}`,
      `opacity ${(shown ? REVEAL_OPEN_MS : REVEAL_CLOSE_MS) * 0.6}ms linear`,
    ].join(', '),
    transitionDelay: `${step * REVEAL_STAGGER_MS}ms`,
  };
}

/**
 * The style for a panel already positioned against the button that opens it.
 *
 * A dropdown anchored to its own control has nowhere to travel from — it is
 * already there. What it needs is to grow out of the corner nearest the button
 * rather than appear at full size, which is the same statement the pad's
 * buttons make by flying, in the space a dropdown actually has.
 *
 * `corner` is the side the button is on: a menu that opens downward grows from
 * its top edge, one that opens upward from its bottom.
 */
export function anchoredRevealStyle(state: RevealState, corner: string): React.CSSProperties {
  const { shown, reduceMotion } = state;
  if (reduceMotion) return {};
  return {
    transform: shown ? 'scale(1)' : 'scale(0.72)',
    opacity: shown ? 1 : 0,
    transformOrigin: corner,
    transition: [
      `transform ${shown ? REVEAL_OPEN_MS : REVEAL_CLOSE_MS}ms ${shown ? REVEAL_OPEN_EASE : REVEAL_CLOSE_EASE}`,
      `opacity ${(shown ? REVEAL_OPEN_MS : REVEAL_CLOSE_MS) * 0.7}ms linear`,
    ].join(', '),
  };
}
