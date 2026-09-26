import { create } from 'zustand';

/**
 * "Open this want's chat", asked from somewhere that cannot open it.
 *
 * The chat lives in the workspace's detail panel, and the ask can come from
 * any page — a header badge, a notice. The want is named rather than handed
 * over, because the asker may be on a page that has not loaded the wants; the
 * workspace (useWorkspace) answers once it has.
 */
interface ChatOpenState {
  /** metadata.name of the want whose chat to open, or null. */
  pending: string | null;
  requestChat: (wantName: string) => void;
  consume: () => void;
}

export const useChatOpenStore = create<ChatOpenState>(set => ({
  pending: null,
  requestChat: (wantName) => set({ pending: wantName }),
  consume: () => set({ pending: null }),
}));
