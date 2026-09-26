import { useState, useRef } from 'react';
import { useInputActions } from './useInputActions';
import { handOverToSidebar, useInputHandedOver } from '@/stores/focusOwner';
import { playSound } from '@/utils/sounds';

interface UseGridFocusOptions {
  /** Total number of navigable items */
  count: number;
  /** Live column count from useGridCols */
  cols: number;
  /** Disable all input handling */
  enabled?: boolean;
  /** Called when Enter/A is pressed on a focused card */
  onConfirm?: (idx: number) => void;
  /** Called on Escape/B. Defaults to clearing focus (idx → -1). */
  onCancel?: (idx: number) => void;
  /**
   * Called on Shift+Enter / gamepad Start with the focused index.
   * Pages use it to open the focused card's action overlay, matching the
   * want dashboard (see useDashboardNav's option of the same name).
   */
  onContextMenu?: (idx: number) => void;
}

interface UseGridFocusResult {
  focusedIdx: number;
  setFocusedIdx: (idx: number) => void;
}

/**
 * Shared 2-D grid focus hook used by all card-grid pages.
 *
 * Navigation: left/right move ±1; up/down move ±cols (card directly above/below).
 * The caller owns any page-specific confirm/cancel logic via callbacks.
 *
 * Confirm also hands the keys to the detail panel beside the grid, and the grid
 * goes quiet for as long as the panel holds them — the same walk useDashboardNav
 * describes, for the pages that count their own focus instead. Anything the user
 * then does inside the panel is handled by the ordinary app-wide machinery, not
 * by anything here; see that hook's note for why that matters.
 */
export function useGridFocus({
  count,
  cols,
  enabled = true,
  onConfirm,
  onCancel,
  onContextMenu,
}: UseGridFocusOptions): UseGridFocusResult {
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const focusedIdxRef = useRef(-1);
  focusedIdxRef.current = focusedIdx;
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const countRef = useRef(count);
  countRef.current = count;
  // See useDashboardNav: the grid does not answer while the panel has the keys.
  const inputHandedOver = useInputHandedOver();

  useInputActions({
    enabled: enabled && !inputHandedOver,
    ignoreWhenInputFocused: true,
    ignoreWhenInSidebar: false,
    onNavigate: (dir) => {
      const total = countRef.current;
      if (total === 0) return;
      setFocusedIdx(prev => {
        if (prev < 0) return 0;
        const c = colsRef.current;
        switch (dir) {
          case 'left':  return prev > 0 ? prev - 1 : prev;
          case 'right': return prev < total - 1 ? prev + 1 : prev;
          case 'up':    return prev - c >= 0 ? prev - c : prev;
          case 'down':  return prev + c < total ? prev + c : prev;
          default:      return prev;
        }
      });
      playSound('gridMove');
    },
    // Always bound, even with no page callback: going into the panel is what
    // confirm means on a card grid now, and a page that has nothing else to do
    // with the press should still let the user in.
    onConfirm: () => {
      const i = focusedIdxRef.current;
      if (i < 0) return;
      onConfirm?.(i);
      requestAnimationFrame(() => handOverToSidebar());
    },
    onCancel: () => {
      const i = focusedIdxRef.current;
      if (onCancel) onCancel(i);
      else setFocusedIdx(-1);
    },
    onContextMenu: onContextMenu
      ? () => { const i = focusedIdxRef.current; if (i >= 0) onContextMenu(i); }
      : undefined,
  });

  return { focusedIdx, setFocusedIdx };
}
