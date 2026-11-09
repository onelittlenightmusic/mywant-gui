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
  /** Closed instead when it is the one open already (the header's chat
   *  button, pressed again). */
  toggle: boolean;
  requestChat: (wantName: string, opts?: { toggle?: boolean }) => void;
  consume: () => void;
}

export const useChatOpenStore = create<ChatOpenState>(set => ({
  pending: null,
  toggle: false,
  requestChat: (wantName, opts) => set({ pending: wantName, toggle: !!opts?.toggle }),
  consume: () => set({ pending: null, toggle: false }),
}));
