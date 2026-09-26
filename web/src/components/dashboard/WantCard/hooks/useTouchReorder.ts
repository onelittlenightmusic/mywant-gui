import { useCallback, useEffect, useRef, useState } from 'react';

// Reordering cards by touch.
//
// The card is draggable="true", which is HTML5 drag and drop and therefore
// mouse-only: on a phone a long press raised the quick-actions overlay and that
// was the end of it — the cards could not be rearranged at all. This turns the
// press that already happened into the start of a drag, so holding a card and
// moving moves the card, which is what a held card looks like it should do.
//
// The drop target is found with elementFromPoint rather than the browser's own
// hit testing, since no drag events fire; every card tags itself with
// data-want-card-index for that lookup.

/** Movement past this many px after the hold turns into a drag rather than a tap. */
const DRAG_START_PX = 8;

interface Options {
  wantId: string | null;
  index: number;
  disabled?: boolean;
  onDragStart?: (id: string) => void;
  onDragOver?: (index: number, position: 'before' | 'after' | 'inside' | null) => void;
  onDrop?: (draggedId: string, index: number, position: 'before' | 'after') => void;
  onDragEnd?: () => void;
  /** Called when the drag begins, to dismiss the quick-actions overlay. */
  onDragBegin?: () => void;
}

interface TargetHit {
  index: number;
  position: 'before' | 'after';
}

function targetUnder(x: number, y: number, selfIndex: number): TargetHit | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const card = el?.closest('[data-want-card-index]') as HTMLElement | null;
  if (!card) return null;

  const index = Number(card.dataset.wantCardIndex);
  if (Number.isNaN(index) || index === selfIndex) return null;

  const rect = card.getBoundingClientRect();
  return { index, position: x < rect.left + rect.width / 2 ? 'before' : 'after' };
}

export function useTouchReorder({
  wantId, index, disabled = false, onDragStart, onDragOver, onDrop, onDragEnd, onDragBegin,
}: Options) {
  const [dragging, setDragging] = useState(false);
  const armedRef = useRef(false);
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<TargetHit | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const reset = useCallback(() => {
    armedRef.current = false;
    if (draggingRef.current) {
      draggingRef.current = false;
      setDragging(false);
      onDragOver?.(index, null);
      onDragEnd?.();
    }
    startRef.current = null;
    targetRef.current = null;
  }, [index, onDragEnd, onDragOver]);

  /** Called once the long press has committed: from here on, movement drags. */
  const arm = useCallback((x: number, y: number) => {
    if (disabled || !wantId) return;
    armedRef.current = true;
    startRef.current = { x, y };
  }, [disabled, wantId]);

  // touchmove has to be non-passive to stop the page scrolling under the drag,
  // which React's own listener cannot promise, hence the native registration.
  useEffect(() => {
    const node = elementRef.current;
    if (!node) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!armedRef.current || !startRef.current || e.touches.length !== 1) return;
      const t = e.touches[0];

      if (!draggingRef.current) {
        const dx = t.clientX - startRef.current.x;
        const dy = t.clientY - startRef.current.y;
        if (Math.hypot(dx, dy) < DRAG_START_PX) return;
        draggingRef.current = true;
        setDragging(true);
        onDragBegin?.();
        if (wantId) onDragStart?.(wantId);
        navigator.vibrate?.(10);
      }

      e.preventDefault(); // the finger is moving a card, not the page
      const hit = targetUnder(t.clientX, t.clientY, index);
      targetRef.current = hit;
      onDragOver?.(hit ? hit.index : index, hit ? hit.position : null);
    };

    const onTouchEnd = () => {
      const hit = targetRef.current;
      const wasDragging = draggingRef.current;
      const id = wantId;
      reset();
      if (wasDragging && hit && id) onDrop?.(id, hit.index, hit.position);
    };

    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);
    return () => {
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [index, onDragBegin, onDragOver, onDragStart, onDrop, reset, wantId]);

  return {
    /** Attach to the card element. */
    ref: elementRef,
    arm,
    cancel: reset,
    dragging,
  };
}
