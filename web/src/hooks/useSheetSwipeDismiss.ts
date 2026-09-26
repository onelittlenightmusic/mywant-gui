import { useCallback, useEffect, useRef, useState } from 'react';

// Swipe-to-dismiss for the mobile sheet: drag it toward the edge it is docked
// to and let go. On a phone that is the gesture people already expect from a
// sheet, and the alternative — aiming at the small close button in a corner —
// is the fiddliest thing on the screen.
//
// The drag only starts where it cannot fight the content's own scrolling:
// from the grab handle and header (always), or from content that is already
// scrolled to the edge the drag would pull away from.

const DISMISS_DISTANCE_PX = 80;
const DISMISS_VELOCITY_PX_PER_MS = 0.5;

interface Options {
  /** Sheet is docked to the bottom, so it dismisses downward (upward if not). */
  fromBottom: boolean;
  enabled: boolean;
  onDismiss: () => void;
}

interface SwipeState {
  /** Live drag offset in px, already clamped to the dismiss direction. */
  offset: number;
  dragging: boolean;
  /** Attach to the sheet element. */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

/** True when a scrollable ancestor would consume this drag itself. */
function scrollBlocksDrag(target: EventTarget | null, sheet: HTMLElement | null, fromBottom: boolean): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== sheet) {
    const canScroll = node.scrollHeight > node.clientHeight + 1;
    if (canScroll) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY)) {
        // Pulling a bottom sheet down means the content must already be at its
        // top; a top sheet dismisses upward, so it must be at its bottom.
        return fromBottom
          ? node.scrollTop > 0
          : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
      }
    }
    node = node.parentElement;
  }
  return false;
}

export function useSheetSwipeDismiss({ fromBottom, enabled, onDismiss }: Options): SwipeState {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; at: number } | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      start.current = null;
      setOffset(0);
      setDragging(false);
    }
  }, [enabled]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return;
    sheetRef.current = e.currentTarget as HTMLElement;
    if (scrollBlocksDrag(e.target, sheetRef.current, fromBottom)) return;
    start.current = { y: e.touches[0].clientY, at: Date.now() };
  }, [enabled, fromBottom]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!start.current) return;
    const delta = e.touches[0].clientY - start.current.y;
    // Only the dismiss direction moves; the other way the sheet stays put
    // rather than lifting off its edge.
    const travel = fromBottom ? Math.max(0, delta) : Math.min(0, delta);
    if (travel !== 0 && !dragging) setDragging(true);
    setOffset(travel);
  }, [dragging, fromBottom]);

  const onTouchEnd = useCallback(() => {
    const began = start.current;
    start.current = null;
    setDragging(false);

    if (!began) return;
    const travelled = Math.abs(offset);
    const velocity = travelled / Math.max(1, Date.now() - began.at);
    // A short flick counts as much as a long, slow pull.
    if (travelled >= DISMISS_DISTANCE_PX || velocity >= DISMISS_VELOCITY_PX_PER_MS) {
      onDismiss();
    }
    setOffset(0);
  }, [offset, onDismiss]);

  return { offset, dragging, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
