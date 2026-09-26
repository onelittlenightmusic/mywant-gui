import { create } from 'zustand';
import { apiClient } from '@/api/client';

/**
 * Per-want unread alert counts — the number a tile / minimap badge shows.
 *
 * A "want alert" is a deliberate, persistent notice tied to one want (raised on
 * want_achieved, or by POST /wants/{id}/notify). It stays unread until the want
 * is opened, at which point `markRead` clears it. Counts are global, not
 * per-character, for now.
 */
interface NotificationStore {
  counts: Record<string, number>;
  /**
   * Per want, the ids of the outputs its unread alerts announce. An alert IS a
   * want's new output (see engine server/handlers_want_output.go), so this is
   * how the board tells which of the answers it draws are still news.
   */
  unreadOutputs: Record<string, string[]>;
  total: number;
  fetch: () => Promise<void>;
  markRead: (wantId: string) => Promise<void>;
  /** unread count for one want (0 when none) */
  countFor: (wantId: string) => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  counts: {},
  unreadOutputs: {},
  total: 0,

  fetch: async () => {
    try {
      const { counts, total, outputs } = await apiClient.getUnreadWantCounts();
      set({ counts: counts ?? {}, total: total ?? 0, unreadOutputs: outputs ?? {} });
    } catch {
      /* leave the last known counts in place */
    }
  },

  markRead: async (wantId) => {
    // Optimistic: drop this want's badge now, reconcile on the next fetch.
    set((s) => {
      if (!s.counts[wantId] && !s.unreadOutputs[wantId]) return s;
      const next = { ...s.counts };
      const was = next[wantId] ?? 0;
      delete next[wantId];
      const outputs = { ...s.unreadOutputs };
      delete outputs[wantId];
      return { counts: next, unreadOutputs: outputs, total: Math.max(0, s.total - was) };
    });
    try {
      await apiClient.markWantNotificationsRead(wantId);
    } catch {
      void get().fetch();
    }
  },

  countFor: (wantId) => get().counts[wantId] ?? 0,
}));

// Background poll, same 5s cadence as the want list.
let started = false;
export function startNotificationPolling() {
  if (started) return;
  started = true;
  void useNotificationStore.getState().fetch();
  setInterval(() => void useNotificationStore.getState().fetch(), 5000);
}
