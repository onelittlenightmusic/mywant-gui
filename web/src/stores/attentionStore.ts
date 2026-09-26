import { create } from 'zustand';
import { apiClient, type AttentionItem } from '@/api/client';

/**
 * What needs a person, across everything running — approvals, failed wants,
 * automated tab runs that failed or hit a login/CAPTCHA. The control pill's
 * attention button shows it and warps to the first item (see
 * GlobalControlPill). Polled by useSystemPauseSync, the pill's other feed.
 */
interface AttentionStore {
  items: AttentionItem[];
  load: () => Promise<void>;
}

export const useAttentionStore = create<AttentionStore>((set) => ({
  items: [],
  load: async () => {
    try {
      set({ items: await apiClient.getAttention() });
    } catch {
      // Server down or an older backend — keep what was known.
    }
  },
}));
