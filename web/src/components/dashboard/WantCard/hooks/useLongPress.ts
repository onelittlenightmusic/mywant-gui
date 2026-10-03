import React, { useRef, useState } from 'react';
import { useWantStore } from '@/stores/wantStore';
import { playHapticClick } from '@/utils/haptic';

interface UseLongPressOptions {
  disabled?: boolean;
  /** Fired when the press commits, with the point it started from — the touch
   *  reorder arms itself here, so a hold that then moves drags the card. */
  onCommit?: (x: number, y: number) => void;
}

export function useLongPress(id: string | null, { disabled = false, onCommit }: UseLongPressOptions = {}) {
  // Selector, not `useWantStore()` — see useCardOverlay: a selector-less
  // subscription re-renders this hook's card on every store write.
  const setQuickActionsWantId = useWantStore(s => s.setQuickActionsWantId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  // True during the 0-150ms hold window before the quick-actions overlay
  // commits — drives a brief "still movable" affordance icon (see WantCard)
  // so a user intending to drag doesn't land on an overlay button the
  // instant they pause. Native HTML5 drag can start independently of this
  // timer (it isn't gated by useLongPress at all), so this can't prevent
  // that race, just make the "you can still move" window visible instead of
  // silent.
  const [holding, setHolding] = useState(false);
  /**
   * The hold has committed (the card is armed to move) and the finger has not
   * moved since: letting go now opens the quick actions. They open on the
   * release, not the instant the hold commits — a hold that then moves is a
   * reorder, and a menu up under the moving finger was in its way.
   */
  const armedRef = useRef(false);

  const start = (x: number, y: number) => {
    if (disabled) return;
    posRef.current = { x, y };
    setHolding(true);
    armedRef.current = false;
    timerRef.current = setTimeout(() => {
      if (posRef.current) {
        navigator.vibrate?.(10);
        playHapticClick();
        armedRef.current = true;
        onCommit?.(posRef.current.x, posRef.current.y);
        timerRef.current = null;
      }
      setHolding(false);
    }, 150);
  };

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    posRef.current = null;
    armedRef.current = false;
    setHolding(false);
  };

  /** Let go: a committed hold that never moved opens the quick actions. */
  const openedAtRef = useRef(0);
  const end = () => {
    if (armedRef.current) { setQuickActionsWantId(id); openedAtRef.current = Date.now(); }
    cancel();
  };
  /** The click the release sends right after opening the actions is part of
   *  that press, not a tap on the card. */
  const swallowsClick = () => Date.now() - openedAtRef.current < 600;

  const checkMove = (x: number, y: number) => {
    if (posRef.current) {
      const dist = Math.sqrt(
        Math.pow(x - posRef.current.x, 2) + Math.pow(y - posRef.current.y, 2)
      );
      if (dist > 10) cancel();
    }
  };

  return {
    onMouseDown: (e: React.MouseEvent) => { if (e.button !== 0) return; start(e.clientX, e.clientY); },
    onMouseMove: (e: React.MouseEvent) => checkMove(e.clientX, e.clientY),
    onMouseUp: end,
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; start(t.clientX, t.clientY); },
    onTouchMove: (e: React.TouchEvent) => { const t = e.touches[0]; checkMove(t.clientX, t.clientY); },
    onTouchEnd: end,
    cancel,
    holding,
    swallowsClick,
    /** The hold has committed: a drag from here is a long-press drag — a
     *  reorder, nothing else (see WantCard's handleDragStart). */
    isArmed: () => armedRef.current,
  };
}
