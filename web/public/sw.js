/*
 * MyWant service worker — Web Push only.
 *
 * No offline caching: the app is always online (it reverse-proxies a live
 * backend). This worker exists so a per-want alert can reach a phone whose
 * home screen holds the /w/<id> app while it is closed. The engine signs the
 * message (handlers_push.go); here we show it and mirror the unread count onto
 * the app icon badge.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'MyWant';
  const url = data.url || '/';

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: data.icon || '/want-icons/default-192.png',
        badge: '/want-icons/default-192.png',
        tag: data.wantId || undefined,
        renotify: Boolean(data.wantId),
        data: { url },
      });
      if (typeof data.badgeCount === 'number' && self.navigator.setAppBadge) {
        try {
          if (data.badgeCount > 0) await self.navigator.setAppBadge(data.badgeCount);
          else await self.navigator.clearAppBadge();
        } catch {
          /* Badging unsupported here — the notification itself still shows. */
        }
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
