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

  const start = (x: number, y: number) => {
    if (disabled) return;
    posRef.current = { x, y };
    setHolding(true);
    timerRef.current = setTimeout(() => {
      if (posRef.current) {
        navigator.vibrate?.(10);
        playHapticClick();
        setQuickActionsWantId(id);
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
    setHolding(false);
  };

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
    onMouseUp: cancel,
    onTouchStart: (e: React.TouchEvent) => { const t = e.touches[0]; start(t.clientX, t.clientY); },
    onTouchMove: (e: React.TouchEvent) => { const t = e.touches[0]; checkMove(t.clientX, t.clientY); },
    onTouchEnd: cancel,
    cancel,
    holding,
  };
}
