import { create } from 'zustand';
import { ThingRecord } from '@/types/thing';

/**
 * "Open the editor for this thing."
 *
 * The card carries the Edit action, and the editor is a sidebar — the same one
 * naming a thing uses, because changing what kind of thing it is is the same
 * question that was asked when it was named. The card cannot open a sidebar: it
 * is drawn in three places (the Thing page's grid, the detail sheet's embedded
 * copy, a tile's card on the board) and none of them owns the panel.
 *
 * So the card asks by name and whichever page owns a sidebar answers. The
 * codebase already bridges this kind of gap with a store — see wantSeedStore,
 * which carries a value from the Thing page to the want form the same way.
 *
 * One-shot: the page clears it on arrival, so asking twice for the same thing
 * works the second time as well as the first.
 */
interface ThingEditStore {
  /** The thing whose editor should open, or null. */
  record: ThingRecord | null;
  requestEdit: (record: ThingRecord) => void;
  consume: () => void;
}

export const useThingEditStore = create<ThingEditStore>((set) => ({
  record: null,
  requestEdit: (record) => set({ record }),
  consume: () => set({ record: null }),
}));

/** Ask from outside React — the card's overlay handler runs as a plain callback. */
export function requestThingEdit(record: ThingRecord): void {
  useThingEditStore.getState().requestEdit(record);
}
