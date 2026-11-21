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

export interface WantNotice {
  /** The same for the same answer: shown once however many pages are open. */
  id: string;
  wantId: string;
  title: string;
  body: string;
}

let started = false;

/** Listen for notices, once per page. */
export function startNotices(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  subscribeSSE<WantNotice>('notice', notice => {
    if (!notice?.id) return;
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
  if (!nativeHost && !extensionShowsNotices()) askOnFirstTouch();
}

/** The MyWant browser extension is here (it marks the page). */
function extensionShowsNotices(): boolean {
  return document.documentElement.dataset.mywantExtension === 'true';
}

function showInBrowser(notice: WantNotice): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // The tag makes a second tab's the same notification, not another.
  const n = new Notification(notice.title, { body: notice.body, tag: notice.id });
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
