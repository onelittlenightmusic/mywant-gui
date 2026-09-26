import React from 'react';
import {
  useGlobalFreeCursor, useFreeCursorCarrying,
  dropFreeCursorCarry, cancelFreeCursorCarry, consumeCarrySkipConfirm,
} from '@/hooks/useFreeCursorNav';
import { useInputActions } from '@/hooks/useInputActions';
import { playSound } from '@/utils/sounds';
import { FreeCursorOverlay } from './FreeCursorOverlay';

/**
 * Mounts the single, app-wide free-roaming cursor (see useGlobalFreeCursor) —
 * render exactly once, outside <Routes> (App.tsx), so it works on every page
 * and can cross between whatever grids are currently registered (want list,
 * an open sidebar's parameter/field grid, agents/want-types/recipes, ...).
 */
export const GlobalFreeCursor: React.FC = () => {
  const { cursorRef, highlightRef, active } = useGlobalFreeCursor();

  // While something is carried, A/Enter put it down and B/Escape give it up —
  // and nothing else hears either. Claimed rather than broadcast: the panel the
  // thing came from still has the focus, and its own B would hand the keys to
  // the board, which takes the stick, which is the cursor the carry rides on.
  const carrying = useFreeCursorCarrying();
  useInputActions({
    enabled: carrying,
    captureInput: true,
    ignoreWhenInSidebar: false,
    ignoreWhenInputFocused: false,
    onConfirm: () => {
      if (consumeCarrySkipConfirm()) return;
      if (!dropFreeCursorCarry()) playSound('cardClose');
    },
    onCancel: () => {
      cancelFreeCursorCarry();
      playSound('cardClose');
    },
  });

  return <FreeCursorOverlay cursorRef={cursorRef} highlightRef={highlightRef} active={active} />;
};
