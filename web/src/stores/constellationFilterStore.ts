import { create } from 'zustand';

/** The lists a constellation filter narrows. */
export type FilterPage = 'want' | 'thing';

const KEY = 'mywant.constellationFilter';

type Selected = Record<FilterPage, string[]>;

function load(): Selected {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { want: Array.isArray(v.want) ? v.want : [], thing: Array.isArray(v.thing) ? v.thing : [] };
  } catch {
    return { want: [], thing: [] };
  }
}

function save(s: Selected) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* the filter still holds for this visit */ }
}

interface ConstellationFilterStore {
  /** The constellations each list is narrowed to (by name); none = everything. */
  selected: Selected;
  toggle: (page: FilterPage, name: string) => void;
  clear: (page: FilterPage) => void;
}

/**
 * Which constellations the want list and the thing list are narrowed to.
 *
 * Kept in this browser's storage, not only in memory: a page's filter panel
 * can be a page of its own (an app's sheet shows it in a second web view), and
 * the list it narrows is in the first. Both read the same storage, and the
 * storage event tells the one that did not make the change.
 */
export const useConstellationFilterStore = create<ConstellationFilterStore>((set, get) => ({
  selected: load(),
  toggle: (page, name) => {
    const cur = get().selected[page];
    const next = { ...get().selected, [page]: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name] };
    save(next);
    set({ selected: next });
  },
  clear: (page) => {
    const next = { ...get().selected, [page]: [] };
    save(next);
    set({ selected: next });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) useConstellationFilterStore.setState({ selected: load() });
  });
}
