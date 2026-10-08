import { create } from 'zustand';

/** The lists whose order the order card switches. */
export type OrderedList = 'want' | 'thing';

/**
 * How a list is ordered: お気に入り, the order the user put it in (dragged,
 * saved), or 最近, the one updated last first.
 */
export type ListOrder = 'favorite' | 'recent';

const KEY = 'mywant.listOrder';

type Orders = Record<OrderedList, ListOrder>;

function load(): Orders {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { want: v.want === 'recent' ? 'recent' : 'favorite', thing: v.thing === 'recent' ? 'recent' : 'favorite' };
  } catch {
    return { want: 'favorite', thing: 'favorite' };
  }
}

interface ListOrderStore {
  order: Orders;
  /** The other order: the card's tap. */
  toggle: (list: OrderedList) => void;
}

/**
 * Which order the want list and the thing list are in (ListOrderCard).
 *
 * In this browser's storage, as the constellation filter is, so the choice
 * holds across visits and between an app's web views.
 */
export const useListOrderStore = create<ListOrderStore>((set, get) => ({
  order: load(),
  toggle: (list) => {
    const next: Orders = { ...get().order, [list]: get().order[list] === 'favorite' ? 'recent' : 'favorite' };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* holds for this visit */ }
    set({ order: next });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) useListOrderStore.setState({ order: load() });
  });
}
