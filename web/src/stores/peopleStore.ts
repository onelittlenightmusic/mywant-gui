import { create } from 'zustand';

/**
 * The people on the board, as the board shows them: the list (the header's
 * People, drawn as the want list's map is) and the one person whose sheet is
 * open.
 *
 * A sheet is opened two ways, and they close differently. Chosen from the list
 * ('list'), it stays until it is closed. Walked to with 会話 equipped ('talk'),
 * it is the person you are standing with, and it goes when you step away or put
 * the skill down — as a want's panel goes when you step off its tile.
 */
export type PeopleSheetVia = 'list' | 'talk';

interface PeopleStore {
  listOpen: boolean;
  setListOpen: (open: boolean) => void;
  /** tab: the sheet's tab to open it at (a link's, /canvas/character/<id>/<tab>). */
  sheet: { characterId: string; via: PeopleSheetVia; tab?: string } | null;
  openSheet: (characterId: string, via: PeopleSheetVia, tab?: string) => void;
  closeSheet: () => void;
}

export const usePeopleStore = create<PeopleStore>()((set) => ({
  listOpen: false,
  setListOpen: (listOpen) => set({ listOpen }),
  sheet: null,
  openSheet: (characterId, via, tab) => set({ sheet: { characterId, via, tab } }),
  closeSheet: () => set({ sheet: null }),
}));
