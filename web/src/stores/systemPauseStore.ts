import { create } from 'zustand';
import { apiClient } from '@/api/client';

/**
 * The global pause — the emergency stop the control pill offers on every page
 * (and, through the extension and the bookmarklet, on every tab).
 *
 * The server owns the flag (PUT /api/v1/system/pause) and announces changes
 * over SSE as `system_pause`, so every open GUI flips its pill together; see
 * useSystemPauseSync for the listening half.
 */
interface SystemPauseStore {
  /** null until the first answer — the pill shows neither state then. */
  paused: boolean | null;
  /** True while a toggle is in flight, so a double press cannot undo itself. */
  busy: boolean;
  setPaused: (paused: boolean) => void;
  load: () => Promise<void>;
  toggle: () => Promise<void>;
}

export const useSystemPauseStore = create<SystemPauseStore>((set, get) => ({
  paused: null,
  busy: false,
  setPaused: (paused) => set({ paused }),
  load: async () => {
    try {
      const r = await apiClient.getSystemPause();
      set({ paused: r.paused });
    } catch {
      // Server down or an older backend without the endpoint — leave it unknown.
    }
  },
  toggle: async () => {
    const { paused, busy } = get();
    if (busy || paused === null) return;
    set({ busy: true });
    try {
      const r = await apiClient.setSystemPause(!paused);
      set({ paused: r.paused });
    } catch {
      // Nothing changed on the server; the pill keeps showing what is true.
    } finally {
      set({ busy: false });
    }
  },
}));
