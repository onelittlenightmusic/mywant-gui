import { create } from 'zustand';

export interface PendingDeviceAction {
  /** 'open-url' opens a page; 'call-invite' asks a player to come somewhere.
   *  Room to add e.g. 'show-robot' later — see usePendingDeviceActions.ts */
  type: 'open-url' | 'call-invite';
  id: string;
  url: string;
  title: string;
  wantId?: string;
  /** Target device (myDeviceId from useDeviceSession). Omitted = broadcast to all devices. */
  device_id?: string;
  timestamp: number;

  /**
   * Whose invitation this is. Addressed to the person rather than to a screen,
   * because an invitation waits: whoever picks that character up answers it,
   * and the device they answer from need not have existed when it was sent.
   */
  to_character_id?: string;
  // ── call-invite only ──
  /** Who is calling. */
  from_character_id?: string;
  from_character_name?: string;
  /** Canvas cell to come to. Ignored when `url` is set (a web-page invite). */
  x?: number;
  y?: number;
}

interface PendingActionStore {
  actions: PendingDeviceAction[];
  setActions: (actions: PendingDeviceAction[]) => void;
}

export const usePendingActionStore = create<PendingActionStore>(set => ({
  actions: [],
  setActions: (actions) => set({ actions }),
}));

interface CallInviteStore {
  /** The invite awaiting my answer, or null. Newest wins if two arrive. */
  invite: PendingDeviceAction | null;
  setInvite: (invite: PendingDeviceAction | null) => void;
}

/**
 * Call invites are held apart from `actions` because, unlike 'open-url', they
 * are NOT auto-consumed: they wait for the player to accept or decline (see
 * usePendingDeviceActions and Dashboard's confirmation bubble).
 */
export const useCallInviteStore = create<CallInviteStore>(set => ({
  invite: null,
  setInvite: (invite) => set({ invite }),
}));
