import { useState } from 'react';
import { useInputActions } from './useInputActions';

/**
 * Shared navigation hook for all overlay action grids
 * (QuickActionsOverlay, DeleteConfirmOverlay, SlotOverlay, etc.).
 *
 * Registers a captureInput useInputActions handler that:
 *   - Moves focusedIndex within a cols×rows grid via arrow keys / D-pad
 *   - Fires onConfirm(index) on Enter / Gamepad A (skips disabled items)
 *   - Fires onCancel on Escape / Gamepad B
 *
 * Note: when captureInput=true, useInputActions bypasses ignoreWhenInSidebar
 * and ignoreWhenInputFocused guards internally, so those values are only
 * meaningful for documentation / future non-capture usage.
 */

export interface UseOverlayKeyNavOptions {
  /** Number of columns in the button grid */
  cols: number;
  /** Total number of items */
  total: number;
  /** Called with the confirmed index when Enter/A fires and item is not disabled */
  onConfirm: (index: number) => void;
  /** Called on Escape/B */
  onCancel: () => void;
  /** Return true for items that should be skipped on confirm */
  isDisabled?: (index: number) => boolean;
  /** Forwarded to useInputActions. Has no practical effect for captureInput handlers. */
  ignoreWhenInSidebar?: boolean;
  /** Starting focused index (default: 0) */
  initialFocus?: number;
  /**
   * When true, releasing the bumper of a B+L1/R1 chord confirms the focused
   * item — for pickers opened by that chord (hold-to-show, release-to-commit).
   * A/Enter still confirm too. Default: false (no release behaviour).
   */
  confirmOnTriggerRelease?: boolean;
  /**
   * Per-item letter shortcuts, `{ y: confirm, n: cancel }`.
   *
   * Routed through this hook's own captureInput handler rather than a listener
   * of the grid's own, so they are arbitrated with everything else the overlay
   * answers. The grid used to bind them on `document` with no ownership check,
   * which meant `y` reached both the overlay's Yes tile and whatever the board
   * had on the Y button underneath it.
   */
  shortcuts?: Record<string, () => void>;
  /**
   * Whether the keys are this grid's right now. Default: true — an overlay
   * that opens is the thing being answered. A grid that stays up on a card
   * without being opened (a pending approval) takes the keys only while the
   * card is entered, or it would take them from the whole board.
   */
  enabled?: boolean;
}

export interface UseOverlayKeyNavResult {
  focusedIndex: number;
  setFocusedIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useOverlayKeyNav({
  cols,
  total,
  onConfirm,
  onCancel,
  isDisabled,
  ignoreWhenInSidebar = false,
  initialFocus = 0,
  confirmOnTriggerRelease = false,
  shortcuts,
  enabled = true,
}: UseOverlayKeyNavOptions): UseOverlayKeyNavResult {
  /**
   * The next item in a direction that can actually be pressed.
   *
   * A disabled tile is a place the highlight had no business stopping: the
   * arrows walked onto it, the ring sat there, and Enter did nothing — so the
   * grid looked broken rather than full. Now the step continues past it in the
   * same direction (along the row for left/right, down the column for up/down)
   * until it finds a live one, and stays where it was if the whole direction is
   * dead. Same rule the initial focus follows.
   *
   * `step` is in items for left/right and in whole rows for up/down, so the
   * search never wanders out of the line the user is moving along.
   */
  const nextEnabled = (from: number, step: number): number => {
    for (let i = from + step; i >= 0 && i < total; i += step) {
      // Left/right must not wrap onto the next row: a row is a line, and the
      // end of it is the end of the movement.
      if (Math.abs(step) === 1 && Math.floor(i / cols) !== Math.floor(from / cols)) break;
      if (!isDisabled?.(i)) return i;
    }
    return from;
  };

  const firstEnabled = (): number => {
    if (!isDisabled?.(initialFocus)) return initialFocus;
    for (let i = 0; i < total; i++) if (!isDisabled(i)) return i;
    return initialFocus;
  };

  const [focusedIndex, setFocusedIndex] = useState(firstEnabled);

  const confirmFocused = () => {
    if (!isDisabled?.(focusedIndex)) onConfirm(focusedIndex);
  };

  useInputActions({
    enabled,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar,
    shortcuts,
    // Release-to-confirm for hold-open B+L1/R1 pickers (opt-in). Both bumpers
    // map to the same "confirm focused" so whichever the caller held confirms.
    onSubTabForwardRelease: confirmOnTriggerRelease ? confirmFocused : undefined,
    onSubTabBackwardRelease: confirmOnTriggerRelease ? confirmFocused : undefined,
    onNavigate: (dir) => {
      setFocusedIndex(prev => {
        switch (dir) {
          case 'right': return nextEnabled(prev, 1);
          case 'left':  return nextEnabled(prev, -1);
          case 'down':  return nextEnabled(prev, cols);
          case 'up':    return nextEnabled(prev, -cols);
          default:      return prev;
        }
      });
    },
    onConfirm: confirmFocused,
    onCancel,
  });

  return { focusedIndex, setFocusedIndex };
}
