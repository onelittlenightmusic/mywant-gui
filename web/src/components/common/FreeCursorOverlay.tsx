import React from 'react';
import { CursorManIcon } from '@/components/dashboard/CursorManIcon';
import type { UseGlobalFreeCursorResult } from '@/hooks/useFreeCursorNav';

/**
 * Floating CursorMan-equivalent overlay — pair with the single
 * useGlobalFreeCursor instance (see GlobalFreeCursor in App.tsx). Renders
 * fixed to the viewport; position is driven directly via
 * cursorRef.current.style.transform each frame (see the hook), not React
 * state, so dragging doesn't re-render the page.
 *
 * Also renders the drag-preview highlight frame (mirrors the browser
 * extension's cursorOverlayCore hover-highlight) — its left/top/width/height/
 * opacity are likewise driven directly per-frame by the hook, not React state.
 */
export const FreeCursorOverlay: React.FC<Pick<UseGlobalFreeCursorResult, 'cursorRef' | 'highlightRef' | 'active'>> = ({ cursorRef, highlightRef, active }) => {
  if (!active) return null;
  return (
    <>
      <div
        ref={highlightRef}
        className="fixed z-[199] pointer-events-none rounded-md opacity-0"
        style={{
          boxSizing: 'border-box',
          borderWidth: 2,
          borderStyle: 'solid',
          transition: 'left .15s cubic-bezier(.4,0,.2,1), top .15s cubic-bezier(.4,0,.2,1), width .15s cubic-bezier(.4,0,.2,1), height .15s cubic-bezier(.4,0,.2,1), opacity .15s ease',
        }}
      />
      <div
        ref={cursorRef}
        data-testid="free-cursor"
        className="fixed left-0 top-0 z-[200] pointer-events-none"
        style={{ willChange: 'transform' }}
      >
        <CursorManIcon size={28} />
      </div>
    </>
  );
};
