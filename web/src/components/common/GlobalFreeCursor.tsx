import React from 'react';
import { useGlobalFreeCursor } from '@/hooks/useFreeCursorNav';
import { FreeCursorOverlay } from './FreeCursorOverlay';

/**
 * Mounts the single, app-wide free-roaming cursor (see useGlobalFreeCursor) —
 * render exactly once, outside <Routes> (App.tsx), so it works on every page
 * and can cross between whatever grids are currently registered (want list,
 * an open sidebar's parameter/field grid, agents/want-types/recipes, ...).
 */
export const GlobalFreeCursor: React.FC = () => {
  const { cursorRef, highlightRef, active } = useGlobalFreeCursor();
  return <FreeCursorOverlay cursorRef={cursorRef} highlightRef={highlightRef} active={active} />;
};
