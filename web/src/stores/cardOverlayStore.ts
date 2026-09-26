import { create } from 'zustand';

/**
 * Which entity card currently shows its action overlay.
 *
 * The want dashboard has its own equivalent (`wantStore.quickActionsWantId`)
 * because want cards predate this store and carry extra want-specific state.
 * Every other card grid — want types, worlds, web wants, recipes, agents,
 * achievements, devices, characters — shares this one, so a page can open the
 * focused card's overlay from Shift+Enter / gamepad Start without each grid
 * inventing its own plumbing.
 *
 * IDs are namespaced by the caller (see `entityCardId`) so two pages can't
 * collide on a bare name like "default".
 */
interface CardOverlayStore {
  openCardId: string | null;
  setOpenCardId: (id: string | null) => void;
  /** Opens `id`, or closes the overlay if `id` is already the open one. */
  toggleCardOverlay: (id: string | null) => void;
}

export const useCardOverlayStore = create<CardOverlayStore>((set, get) => ({
  openCardId: null,
  setOpenCardId: (id) => set({ openCardId: id }),
  toggleCardOverlay: (id) =>
    set({ openCardId: id !== null && get().openCardId === id ? null : id }),
}));

/** Builds the namespaced card id used as EntityCard's `navId`. */
export function entityCardId(scope: string, name: string): string {
  return `${scope}:${name}`;
}
