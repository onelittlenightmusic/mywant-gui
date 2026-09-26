import { create } from 'zustand';
import { setMinimapCursorActive } from '@/hooks/useInputActions';

/**
 * Whether input has been handed to the minimap.
 *
 * The fourth place the keys can be, after the board, the detail panel, and a card
 * being operated. What makes it its own state rather than a flag on one of those
 * is what it does with the two facts that already exist:
 *
 *   - the stick OWNER stays with the board (see stickOwner), because the stick is
 *     still being read by the canvas — it is just moving the camera instead of the
 *     character;
 *   - the keys, however, are here (see useInputHandedOver), so the board's frame
 *     goes out, this one's comes up, and A stops meaning "open the tile I am on".
 *
 * The character does not move in this state. That is not a new rule — it is what
 * the minimap already did, via setMinimapCursorActive making WantCanvas's
 * canvasFocused false. This store is now the one writer of that fact, so it
 * cannot end up set with nothing on screen claiming it.
 */
interface MinimapFocusStore {
  focused: boolean;
  /** Take the keys. Deliberate acts only — see handOverToMinimap. */
  enter: () => void;
  /** Hand them back to the board. */
  exit: () => void;
}

export const useMinimapFocusStore = create<MinimapFocusStore>((set) => ({
  focused: false,
  enter: () => { setMinimapCursorActive(true);  set({ focused: true }); },
  exit:  () => { setMinimapCursorActive(false); set({ focused: false }); },
}));

/** The non-React read, for the rAF poll loops that must see it the same frame. */
export function isMinimapFocused(): boolean {
  return useMinimapFocusStore.getState().focused;
}

/*
 * The two named moves live in stores/focusOwner.ts, with the sidebar's.
 * Handing the keys here has to take them off whoever had them, and only
 * something that knows all four owners can do that — which is how the panel
 * and this could both be focused at once before.
 */
