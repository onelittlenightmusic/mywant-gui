import { create } from 'zustand';

/**
 * Unread markers for the hamburger menu.
 *
 * A page registers a count against its NAV_ENTRIES id; the menu draws a dot on
 * that entry, and the hamburger button itself carries a dot whenever any entry
 * does — so something worth looking at is visible without opening the menu.
 * Pages clear their own marker when the user actually looks.
 */
interface NavBadgeStore {
  /** Nav entry id → number of unseen things. Zero or missing means no dot. */
  badges: Record<string, number>;
  setBadge: (id: string, count: number) => void;
  clearBadge: (id: string) => void;
}

export const useNavBadgeStore = create<NavBadgeStore>((set) => ({
  badges: {},
  setBadge: (id, count) =>
    set((state) =>
      // Avoid a new object when nothing changed: this runs on every poll.
      (state.badges[id] ?? 0) === count
        ? state
        : { badges: { ...state.badges, [id]: count } },
    ),
  clearBadge: (id) =>
    set((state) =>
      (state.badges[id] ?? 0) === 0 ? state : { badges: { ...state.badges, [id]: 0 } },
    ),
}));

/** True when any entry is carrying a marker. */
export function hasAnyNavBadge(badges: Record<string, number>): boolean {
  return Object.values(badges).some((n) => n > 0);
}
