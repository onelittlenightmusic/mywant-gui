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

/**
 * What needs a person, counted by want: a want with an error and an alert is
 * one, not two. A tab's own trouble (no want) counts by itself.
 */
export function attentionKey(item: AttentionItem): string {
  return item.want_id ? `want:${item.want_id}` : item.id;
}

export function attentionCount(items: AttentionItem[]): number {
  return new Set(items.map(attentionKey)).size;
}

/** The wants that need a person, for their tiles to say so (a "!"). */
export function attentionWantIds(items: AttentionItem[]): Set<string> {
  const out = new Set<string>();
  for (const i of items) if (i.want_id) out.add(i.want_id);
  return out;
}
