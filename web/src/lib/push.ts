/*
 * Web Push registration for the /w/<id> home-screen app.
 *
 * On iOS this only works once the page is installed to the home screen and the
 * permission prompt is triggered from a real tap; on Chrome it also works in a
 * plain tab. The engine holds the subscription and signs the messages
 * (handlers_push.go); the service worker (public/sw.js) shows them.
 */
import { apiClient } from '@/api/client';

export type PushState = 'unsupported' | 'denied' | 'default' | 'subscribed';

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Register the worker. Safe to call on every load; it no-ops if already there. */
export async function registerServiceWorker(): Promise<void> {
  if (!pushSupported()) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    /* registration failing just means no push on this device */
  }
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') return 'subscribed';
  } catch {
    /* fall through */
  }
  return 'default';
}

/** Must be called from a user gesture (the permission prompt needs one). */
export async function subscribeToPush(wantId?: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';

  const { key, enabled } = await apiClient.getVapidPublicKey();
  if (!enabled || !key) return 'unsupported';

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(key),
    });
  }
  await apiClient.pushSubscribe(sub.toJSON(), wantId);
  return 'subscribed';
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await apiClient.pushUnsubscribe(endpoint).catch(() => {});
}
