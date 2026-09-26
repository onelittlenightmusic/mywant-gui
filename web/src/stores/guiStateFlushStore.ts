import { create } from 'zustand';

interface GuiStateFlushStore {
  /** Set by Dashboard while it is mounted; null when nothing owns a cursor. */
  flush: (() => Promise<void>) | null;
  setFlush: (fn: (() => Promise<void>) | null) => void;
}

/**
 * Same-tab bridge for "write the character's position to the server *now*".
 *
 * Dashboard debounces its gui_state writes by 800ms, which is right for a
 * cursor being dragged around and wrong at exactly one moment: leaving a world.
 * The server snapshots the outgoing world's GUI state when it is left, so a
 * move made within that 800ms window was still sitting in the browser and
 * never made it into the world being closed — the move looked undone on the
 * way back, and the debounced write landed in whichever world had just opened.
 *
 * Anything that switches worlds awaits this first. Mirrors worldSpawnStore's
 * minimal local-zustand-bridge pattern (WorldCardPlugin lives deep in the
 * WantCard tree and has no access to Dashboard's refs).
 */
export const useGuiStateFlushStore = create<GuiStateFlushStore>((set) => ({
  flush: null,
  setFlush: (fn) => set({ flush: fn }),
}));
