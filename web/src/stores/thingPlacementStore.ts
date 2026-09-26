import { create } from 'zustand';

/**
 * Where each thing actually sits on the board, in grid cells.
 *
 * A thing's coordinates live on its own labels, but only when it has been
 * placed; the rest are worked out by the canvas as it lays them out — beside the
 * want that names them, or in the first free cell. That calculation belongs to
 * the canvas and nowhere else, so the canvas publishes the result here for the
 * one other surface that needs it: the minimap, which has to agree with the
 * board about where things are.
 */
interface ThingPlacementStore {
  positions: Map<string, { x: number; y: number }>;
  setPositions: (positions: Map<string, { x: number; y: number }>) => void;
}

const same = (a: Map<string, { x: number; y: number }>, b: Map<string, { x: number; y: number }>) => {
  if (a.size !== b.size) return false;
  for (const [id, p] of a) {
    const q = b.get(id);
    if (!q || q.x !== p.x || q.y !== p.y) return false;
  }
  return true;
};

export const useThingPlacementStore = create<ThingPlacementStore>((set, get) => ({
  positions: new Map(),
  // Guarded: the canvas recomputes placements on every layout pass, and handing
  // back an equal map would re-render the minimap for nothing.
  setPositions: (positions) => {
    if (same(positions, get().positions)) return;
    set({ positions: new Map(positions) });
  },
}));
