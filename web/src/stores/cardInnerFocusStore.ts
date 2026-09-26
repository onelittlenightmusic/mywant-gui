import { create } from 'zustand';

/**
 * Which card is being operated right now — its slider taking the arrows, its
 * agent box taking the typing.
 *
 * One fact, two readers that must never disagree: the input layer drops every
 * key but Escape while it is set (see useInputActions), and the surfaces behind
 * the card grey themselves out. They used to be two separate flags written by
 * two separate effects in WantCard, and only one of them let go on unmount — so
 * Escape, which both leaves inner focus AND closes the detail sidebar, took the
 * card away before its "I am no longer being operated" could run. Input came
 * back to the board; the grey stayed. Anything that can be true in one place and
 * false in the other eventually will be, so there is now exactly one.
 *
 * A *claim*, not a setter. The card claims while it is mounted and inner
 * focused, and releases on the way out — including the way out that is being
 * unmounted mid-edit. Release is guarded by ownership, so a card leaving the
 * screen cannot clear a claim another card has since taken.
 *
 * The state lives here rather than inside the card because the grey is drawn far
 * away from it: the board's scrim is in WantCanvas, the list's in Dashboard. The
 * codebase already bridges this kind of gap with a store (see worldSpawnStore).
 */

/**
 * Which copy of a card is claiming. The same want is on screen twice on the
 * dashboard — the grid's card and the one embedded in the detail sidebar — and
 * only one of them is ever the one being operated.
 */
export type InnerFocusScope = 'grid' | 'sidebar';

interface CardInnerFocusStore {
  /** The want whose card is being operated, or null. */
  activeWantId: string | null;
  activeScope: InnerFocusScope;
  claim: (wantId: string | null, scope: InnerFocusScope) => void;
  /** Give it up — but only if this claimant still holds it. */
  release: (wantId: string | null, scope: InnerFocusScope) => void;
}

export const useCardInnerFocusStore = create<CardInnerFocusStore>((set, get) => ({
  activeWantId: null,
  activeScope: 'grid',
  claim: (wantId, scope) => set({ activeWantId: wantId, activeScope: scope }),
  release: (wantId, scope) => {
    const s = get();
    if (s.activeWantId !== wantId || s.activeScope !== scope) return;
    set({ activeWantId: null });
  },
}));

/** Is any card being operated? The non-React read, for the input layer. */
export function isAnyCardInnerFocused(): boolean {
  return useCardInnerFocusStore.getState().activeWantId !== null;
}
