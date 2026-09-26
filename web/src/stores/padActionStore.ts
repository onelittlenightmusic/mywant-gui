import { create } from 'zustand';

/** A face button of the pad. */
export type PadButtonId = 'A' | 'B' | 'X' | 'Y';
/** What each button is captioned with, for those that have something to say. */
export type PadLabels = Partial<Record<PadButtonId, string>>;

/**
 * Face-button labels contributed by whatever control currently has focus,
 * layered over the canvas-derived ones (see canvasPadActions).
 *
 * The canvas legend only knows what A/B do where the character stands, and
 * what X/Y do via want types that opted in with `input_button`. It has no way
 * to say "the card the arrows are on right now answers Y with a jump" — that
 * lives in useCardGridNavigation, a world away. A focused grid writes its hint
 * here; usePadLabels reads it once a frame and merges it in.
 *
 * One slot, last writer wins: only one card grid is ever the focused one, and
 * each clears its hint when it stops being it (or unmounts).
 */
interface PadActionStore {
  override: PadLabels;
  /** Pass null (or {}) to clear. */
  setPadOverride: (labels: PadLabels | null) => void;
}

export const usePadActionStore = create<PadActionStore>((set) => ({
  override: {},
  setPadOverride: (labels) => set({ override: labels ?? {} }),
}));
