/*
 * A want's answer it notifies of (spec.voice.notify; engine
 * handlers_want_output.go's "notice" event), shown as the device's own
 * notification while a page is open — in the app (its iOS / Mac notification,
 * handed over), or in a browser (the Notification API). Nothing to sign up
 * to: which wants notify is their spec.voice, and a device asks nothing but
 * the permission.
 */
import { subscribeSSE } from '@/api/sseClient';
import { nativeHost, postToHost } from '@/lib/nativeHost';
import { myDeviceId } from '@/hooks/useDeviceSession';
import { useNotificationStore } from '@/stores/notificationStore';

export interface WantNotice {
  /** The same for the same answer: shown once however many pages are open. */
  id: string;
  /** Devices that do not show notices (Devices' bell, off). */
  off?: string[];
  wantId: string;
  title: string;
  body: string;
  /** A character's notice (engine character_timings.go): who it is from,
   *  and how they look — what its picture is drawn as. */
  character?: string;
  avatar?: string;
  color?: string;
}

let started = false;

/** Listen for notices, once per page. */
export function startNotices(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  subscribeSSE<WantNotice>('notice', notice => {
    if (!notice?.id) return;
    // This device's notices are turned off (the Devices page).
    if (notice.off?.includes(myDeviceId)) return;
    if (nativeHost) {
      // The app shows it — once, though each of its tabs hands it over.
      postToHost({ type: 'notice', ...notice });
      return;
    }
    // The browser extension shows it itself (its own notification, even with
    // no page open): not a second time here.
    if (extensionShowsNotices()) return;
    showInBrowser(notice);
  });
  // Read somewhere — the board, a device's notification — gone everywhere:
  // the board's "♪" (the unread counts again), the app's notification.
  subscribeSSE<{ wantId?: string; ids?: string[] }>('notice_read', read => {
    if (!read?.ids?.length) return;
    void useNotificationStore.getState().fetch();
    if (nativeHost) postToHost({ type: 'notice_read', ids: read.ids });
  });
  if (!nativeHost && !extensionShowsNotices()) askOnFirstTouch();
}

/** The MyWant browser extension is here (it marks the page). */
function extensionShowsNotices(): boolean {
  return document.documentElement.dataset.mywantExtension === 'true';
}

function showInBrowser(notice: WantNotice): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // The tag makes a second tab's the same notification, not another.
  const icon = notice.character ? characterIcon(notice.avatar, notice.color) : undefined;
  const n = new Notification(notice.title, { body: notice.body, tag: notice.id, ...(icon ? { icon } : {}) });
  n.onclick = () => {
    window.focus();
    window.location.assign(`/w/${encodeURIComponent(notice.wantId)}`);
    n.close();
  };
}

/** A browser asks for the permission only from a press: the first one. */
function askOnFirstTouch(): void {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  const ask = () => {
    window.removeEventListener('pointerdown', ask, true);
    void Notification.requestPermission().catch(() => undefined);
  };
  window.addEventListener('pointerdown', ask, true);
}

/** A character's emoji on a disc of their colour, as a data: URL — a
 *  character's notice's picture. Undefined where a canvas cannot be had. */
function characterIcon(avatar?: string, color?: string): string | undefined {
  if (!avatar) return undefined;
  try {
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    if (!g) return undefined;
    g.fillStyle = color || '#8b5cf6';
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - size * 0.07, 0, Math.PI * 2);
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(size * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(avatar, size / 2, size / 2 + size * 0.04);
    return canvas.toDataURL('image/png');
  } catch {
    return undefined;
  }
}
