import React, { useCallback, useEffect, useRef, useState } from 'react';
import { playHapticClick } from '@/utils/haptic';

/** How long the finger has to stay down. Matches the want cards' own hold. */
const HOLD_MS = 450;
/** Moving further than this means the gesture was a scroll, not a press. */
const MOVE_CANCEL_PX = 10;

export interface UseTouchLongPressOptions {
  disabled?: boolean;
  /** Milliseconds the press must be held. */
  holdMs?: number;
}

/**
 * Opens something on a long press, on touch as well as with a right-click.
 *
 * Cards whose only way in was `onContextMenu` were unreachable on a phone.
 * iOS Safari does not raise `contextmenu` for a long press on ordinary
 * elements — it shows its own callout and text-selection UI instead — so on an
 * iPhone there was simply no gesture that opened them.
 *
 * Returns props to spread onto the element. Keep the existing `onContextMenu`
 * alongside: this hook deliberately does not handle mouse input, so a desktop
 * right-click keeps working exactly as before and a slow mouse click never
 * turns into a long press.
 *
 * The element also needs `touch-callout: none` and `user-select: none`, or iOS
 * raises its selection UI over the top of whatever this opens; `longPressStyle`
 * carries both.
 */
export function useTouchLongPress(
  onLongPress: () => void,
  { disabled = false, holdMs = HOLD_MS }: UseTouchLongPressOptions = {},
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  /** True from the moment the hold completes until the finger lifts, so the
   *  tap that ends a long press does not also fire the card's onClick. */
  const firedRef = useRef(false);
  const [holding, setHolding] = useState(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
    setHolding(false);
  }, []);

  useEffect(() => clear, [clear]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || e.touches.length !== 1) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    firedRef.current = false;
    setHolding(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setHolding(false);
      if (!startRef.current) return;
      firedRef.current = true;
      navigator.vibrate?.(10);
      playHapticClick();
      onLongPressRef.current();
    }, holdMs);
  }, [disabled, holdMs]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const start = startRef.current;
    if (!start || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_CANCEL_PX) clear();
  }, [clear]);

  const onTouchEnd = useCallback(() => clear(), [clear]);

  /** Swallows the click that follows a completed long press. */
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (!firedRef.current) return;
    firedRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    /** Spread onto the element that should respond to the hold. */
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, onClickCapture },
    /** True while the finger is down and the hold has not completed yet. */
    holding,
  };
}

/** iOS raises its callout/selection UI over a long press without these. */
export const longPressStyle: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserSelect: 'none',
  userSelect: 'none',
};
