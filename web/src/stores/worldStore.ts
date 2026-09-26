import { create } from 'zustand';
import { apiClient } from '@/api/client';
import { WorldSummary } from '@/types/world';

interface WorldStore {
  worlds: WorldSummary[];
  loading: boolean;
  error: string | null;
  fetchWorlds: () => Promise<void>;
}

export const useWorldStore = create<WorldStore>((set) => ({
  worlds: [],
  loading: false,
  error: null,

  fetchWorlds: async () => {
    set({ loading: true, error: null });
    try {
      const worlds = await apiClient.listWorlds();
      set({ worlds, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch worlds', loading: false });
    }
  },
}));
