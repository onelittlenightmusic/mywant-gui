import { create } from 'zustand';

/**
 * Where the bins are, and what has just gone into one.
 *
 * Throwing something away is the only gesture on this board that destroys
 * anything, and it is deliberately a place rather than a menu: you carry the
 * tile to the bin. That needs two facts shared between three parts that cannot
 * see each other — the canvas layout knows where the bins ARE, the drop
 * handlers need to ask whether a cell is one, and the bin's own card draws the
 * lid opening for something it never sees being dragged.
 *
 * Cells rather than want ids in the lookup, because that is the question a drop
 * asks: "what is at the cell I let go over?"
 */

export type TrashedKind = 'want' | 'thing';

/** What a bin is currently swallowing — one at a time, briefly. */
export interface TrashSwallow {
  /** The bin's own want id, so only that tile animates. */
  trashId: string;
  /** What went in, for the tile to name as it disappears. */
  name: string;
  kind: TrashedKind;
  /** Distinguishes two disposals of the same thing, so the animation restarts. */
  at: number;
}

/** `${x},${y}` — the key both the publisher and the lookup agree on. */
export const trashCellKey = (x: number, y: number) => `${x},${y}`;

interface TrashStore {
  /** Cell key → the bin want's id. Republished by the canvas as it lays out. */
  cells: Map<string, string>;
  setCells: (cells: Map<string, string>) => void;
  /**
   * The bins being attended to right now — lid open.
   *
   * Two things count, because to a bin they are the same thing: something is
   * over the opening. A character standing on it, and a drag holding its
   * destination over it. The second is the one that earns its keep — the lid
   * opening while you are still deciding says "let go here and it goes in",
   * which is the answer you want BEFORE committing rather than after, and
   * moving the destination off closes it again.
   *
   * Worked out on the board (which knows where everyone is and what is being
   * dragged) rather than read from the want's server-side occupancy: this
   * needs no round trip and no state field, and the lid should follow the
   * hand, not the network.
   */
  occupied: Set<string>;
  setOccupied: (ids: Set<string>) => void;
  swallow: TrashSwallow | null;
  /** Start the lid-and-suck animation on one bin. */
  beginSwallow: (s: Omit<TrashSwallow, 'at'>) => void;
  /** The animation has played out. */
  endSwallow: () => void;
}

const sameCells = (a: Map<string, string>, b: Map<string, string>) => {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
};

export const useTrashStore = create<TrashStore>((set, get) => ({
  cells: new Map(),
  // Guarded like thingPlacementStore's: the canvas recomputes its layout on
  // every pass, and handing back an equal map would re-render every bin for
  // nothing.
  setCells: (cells) => { if (!sameCells(cells, get().cells)) set({ cells: new Map(cells) }); },
  occupied: new Set(),
  setOccupied: (ids) => {
    const cur = get().occupied;
    if (ids.size === cur.size && [...ids].every(i => cur.has(i))) return;
    set({ occupied: new Set(ids) });
  },
  swallow: null,
  beginSwallow: (s) => set({ swallow: { ...s, at: Date.now() } }),
  endSwallow: () => set({ swallow: null }),
}));

/** The bin at this cell, or null. What a drop asks before it does anything. */
export function trashAt(x: number, y: number): string | null {
  return useTrashStore.getState().cells.get(trashCellKey(x, y)) ?? null;
}
