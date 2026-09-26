import { create } from 'zustand';
import { apiClient } from '@/api/client';
import { Constellation, ConstellationKind } from '@/types/constellation';

interface ConstellationStore {
  /** All fetched constellations, both kinds. Keyed lookups filter by kind. */
  constellations: Constellation[];
  loading: boolean;
  error: string | null;

  /** Omit the kind for the whole sky — mixed constellations only appear there. */
  fetchConstellations: (kind?: ConstellationKind) => Promise<void>;
  createConstellation: (name: string, kind: ConstellationKind, members: string[], color?: string) => Promise<Constellation | null>;
  // Constellation id == name; kind selects the thing/want label namespace.
  updateConstellation: (name: string, kind: ConstellationKind, updates: { name?: string; members?: string[]; color?: string }) => Promise<void>;
  /** Recolour a constellation (color:null clears it, back to the default starlight). */
  setConstellationColor: (name: string, kind: ConstellationKind, color: string | null) => Promise<void>;
  deleteConstellation: (name: string, kind: ConstellationKind) => Promise<void>;
  clearError: () => void;
}

/** memberId → the constellations (of `kind`) it belongs to. Built from a constellations list. */
export function membersById(constellations: Constellation[], kind: ConstellationKind): Map<string, Constellation[]> {
  const map = new Map<string, Constellation[]>();
  for (const g of constellations) {
    if (g.kind !== kind) continue;
    for (const m of g.members) {
      const arr = map.get(m);
      if (arr) arr.push(g);
      else map.set(m, [g]);
    }
  }
  return map;
}

export const useConstellationStore = create<ConstellationStore>((set, get) => ({
  constellations: [],
  loading: false,
  error: null,

  fetchConstellations: async (kind) => {
    set({ loading: true, error: null });
    try {
      const fetched = await apiClient.getConstellations(kind);
      // Without a kind this IS the whole sky, so it replaces the lot; a mixed
      // constellation belongs to no single kind and merging it into a
      // per-kind cache would leave two stale halves of it behind.
      set((s) => ({
        constellations: kind ? [...s.constellations.filter((g) => g.kind !== kind), ...fetched] : fetched,
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch constellations', loading: false });
    }
  },

  createConstellation: async (name, kind, members, color) => {
    try {
      const created = await apiClient.createConstellation({ name, kind, members, color });
      // Membership is server-derived from labels — refetch to get the merged view
      // (adding to an existing group name folds in, no duplicate row).
      await get().fetchConstellations(kind);
      return created;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create group' });
      return null;
    }
  },

  updateConstellation: async (name, kind, updates) => {
    try {
      await apiClient.updateConstellation(name, { ...updates, kind });
      await get().fetchConstellations(kind);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update group' });
    }
  },

  setConstellationColor: async (name, kind, color) => {
    // The server takes "" to mean "clear it"; a rename is not involved here.
    const prev = get().constellations;
    // Optimistic: the folder marks and the board line should flip at once.
    set({
      constellations: prev.map((g) =>
        g.id === name && g.kind === kind ? { ...g, color: color ?? undefined } : g,
      ),
    });
    try {
      await apiClient.updateConstellation(name, { color: color ?? '', kind });
      await get().fetchConstellations(kind);
    } catch (error) {
      set({ constellations: prev, error: error instanceof Error ? error.message : 'Failed to recolour group' });
    }
  },

  deleteConstellation: async (name, kind) => {
    const prev = get().constellations;
    set({ constellations: prev.filter((g) => !(g.id === name && g.kind === kind)) }); // optimistic
    try {
      await apiClient.deleteConstellation(name, kind);
    } catch (error) {
      set({ constellations: prev, error: error instanceof Error ? error.message : 'Failed to delete group' });
    }
  },

  clearError: () => set({ error: null }),
}));
