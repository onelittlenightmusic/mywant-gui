import { create } from 'zustand';
import { apiClient } from '@/api/client';

/**
 * A notice the app raises — "recipe saved", "✗ failed" — and who shows it.
 *
 * On its own the GUI shows a notice as a small toast (see NoticeToast). An
 * extension with somebody better placed to say it takes the job over with
 * setNotifier: in mywant-guiex that is the robot, whose bubble is where a
 * notice has always appeared. Either way the notice is recorded first, for
 * the Logs page's Notifications tab.
 */

/** What a notice is about, for whoever shows it to point at. */
export interface NoticeTarget {
  targetType: string;
  targetId?: string;
}

type Notifier = (message: string, target?: NoticeTarget) => void;

let notifier: Notifier | null = null;

/** Hand notices to someone else. The last to call it holds the job. */
export function setNotifier(fn: Notifier): void {
  notifier = fn;
}

/** Whether an extension is showing notices (so it records them itself). */
export function hasNotifier(): boolean {
  return notifier !== null;
}

interface NoticeState {
  message: string;
  /** Bumped per notice, so the same words twice still show twice. */
  seq: number;
}

export const useNoticeStore = create<NoticeState>(() => ({ message: '', seq: 0 }));

export function notify(message: string, target?: NoticeTarget): void {
  if (notifier) { notifier(message, target); return; }
  apiClient.recordNotification({
    message,
    targetType: target?.targetType,
    targetId: target?.targetId,
    route: window.location.pathname,
  }).catch(() => { /* history is best-effort */ });
  useNoticeStore.setState(s => ({ message, seq: s.seq + 1 }));
}
