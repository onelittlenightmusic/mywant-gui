import { useState, useCallback, useEffect } from 'react';

export interface CardInnerFocusState {
  innerFocused: boolean;
  enterInner: () => void;
  exitInner: () => void;
}

/**
 * Shared hook for outer → inner → outer focus transitions on card components.
 *
 * Outer focus (isFocused) is owned by the parent grid via focusedIdx.
 * Inner focus lets the user navigate interactive elements inside the card
 * (e.g. action buttons, selects) with keyboard/gamepad without leaving the grid.
 *
 * Lifecycle:
 *   isFocused=true  → card highlighted (CursorMan, cyan ring)
 *   enterInner()    → card enters inner focus (amber ring, inner elements active)
 *   exitInner()     → card returns to outer focus
 *   isFocused=false → inner focus is automatically cleared
 *
 * Used by: DeviceCard (location toggle + CharacterSelect)
 * Can be adopted by: WantCard for quick-action keyboard access
 */
export function useCardInnerFocus(isFocused: boolean): CardInnerFocusState {
  const [innerFocused, setInnerFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setInnerFocused(false);
  }, [isFocused]);

  const enterInner = useCallback(() => setInnerFocused(true), []);
  const exitInner = useCallback(() => setInnerFocused(false), []);

  return { innerFocused, enterInner, exitInner };
}
