import { useEffect } from 'react';
import { WANT_ICON_KEYS } from '@/generated/wantIconKeys';

/**
 * While a `/w/:id` "one want as an app" page is open, point the page's
 * home-screen metadata at that want.
 *
 * iOS reads the title, the apple-mobile-web-app-* metas, an apple-touch-icon
 * and (newer iOS) the manifest link the moment "Add to Home Screen" is tapped —
 * from whichever browser triggered it. The icon is a static file generated at
 * build time per want category (scripts/gen-want-icons.mjs → /want-icons/…);
 * iOS needs a real URL there, a canvas/data: URI does not work. Everything is
 * put back when the page closes.
 */
export function useWantHomeIcon(
  wantId: string | undefined,
  wantName: string | undefined,
  category: string | undefined,
  /** the SPA has uploaded the want's real tile icon → point at that instead */
  runtimeReady = false,
) {
  useEffect(() => {
    if (!wantId) return;
    const head = document.head;

    // Update the one existing <link rel="…"> in place (the server already put a
    // per-category one in the /w/<id> head), or create it if missing.
    const setLink = (rel: string, href: string) => {
      let el = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      const created = !el;
      const prev = el?.getAttribute('href') ?? null;
      if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        head.appendChild(el);
      }
      el.setAttribute('href', href);
      return () => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute('href', prev);
      };
    };

    const setMeta = (name: string, content: string) => {
      let el = head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const created = !el;
      const prev = el?.getAttribute('content') ?? null;
      if (!el) {
        el = document.createElement('meta');
        el.name = name;
        head.appendChild(el);
      }
      el.setAttribute('content', content);
      return () => {
        if (created) el.remove();
        else if (prev !== null) el.setAttribute('content', prev);
      };
    };

    const name = wantName?.trim() || 'Want';
    const key = category && WANT_ICON_KEYS.has(category.toLowerCase())
      ? category.toLowerCase()
      : 'default';
    const icon = (size: 180 | 512) =>
      runtimeReady
        ? `/w-home-icon/${wantId}-${size}.png`
        : `/want-icons/${key}-${size}.png`;
    const prevTitle = document.title;
    document.title = name;

    const restores = [
      setLink('manifest', `/api/v1/wants/${wantId}/manifest.webmanifest`),
      setLink('apple-touch-icon', icon(180)),
      setLink('icon', icon(512)),
      setMeta('apple-mobile-web-app-title', name),
      setMeta('apple-mobile-web-app-capable', 'yes'),
      setMeta('mobile-web-app-capable', 'yes'),
    ];

    return () => {
      document.title = prevTitle;
      restores.forEach((r) => r());
    };
  }, [wantId, wantName, category, runtimeReady]);
}
