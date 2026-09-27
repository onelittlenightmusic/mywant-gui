import { useEffect } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import { listExtensionContexts, type ExtensionProfileList } from '@/lib/extensionContext';
import { characterShapePath } from '@/shared/characterShapes';
import type { Character } from '@/types/character';

/**
 * What a browser tab says this is: its title and its icon.
 *
 * "MyWant Dashboard" in every tab said nothing a person with three servers open
 * could use. The title names the server instead, by the name the browser
 * extension keeps it under — the name the person gave it when they registered
 * it, which is the name they think of it by — and the icon is the person: their
 * character's emoji in their character's colour and outline, so a tab reads as
 * "me, on that server" at a glance.
 *
 * Owned here rather than written by whoever gets there first, because pages
 * borrow both — a `/w/:id` page is a want dressed as an app and names itself
 * after the want — and the name and the character arrive late (an extension
 * round trip, a fetch). A late arrival used to be undone by the page restoring
 * what it had seen when it opened; now a page holds the identity while it is
 * open (holdAppIdentity) and hands it back, and whatever arrived meanwhile is
 * what the tab gets.
 */

const BASE_TITLE = 'MyWant';
const DEFAULT_ICON = '/favicon.svg';

let title = BASE_TITLE;
let icon: string | null = null;
let held = 0;

function apply(): void {
  if (held > 0) return;
  document.title = title;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = icon ?? DEFAULT_ICON;
}

function setAppIdentity(next: { title?: string; icon?: string | null }): void {
  if (next.title !== undefined) title = next.title;
  if (next.icon !== undefined) icon = next.icon;
  apply();
}

/**
 * Borrow the tab's title and icon. The release puts the app's own back — as
 * they are by then, not as they were when borrowed.
 */
export function holdAppIdentity(): () => void {
  held++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    held--;
    apply();
  };
}

// ── The server's name ─────────────────────────────────────────────────────────

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

/**
 * Is `server` this page's own server?
 *
 * By origin, which is what registering from here stores (see DeviceCard). A
 * loopback name is any loopback name: a server registered as localhost is the
 * same one when the page is opened at 127.0.0.1, and the port is what tells two
 * local servers apart.
 */
function isThisServer(server: string): boolean {
  try {
    const a = new URL(server);
    const b = new URL(window.location.origin);
    if (a.protocol !== b.protocol || a.port !== b.port) return false;
    return a.hostname === b.hostname || (LOOPBACK.has(a.hostname) && LOOPBACK.has(b.hostname));
  } catch {
    return false;
  }
}

/** The name this server is kept under — the save target first, then a watched one, when several match. */
function nameOfThisServer(list: ExtensionProfileList): string | null {
  const mine = list.contexts.filter(c => isThisServer(c.server));
  const pick = mine.find(c => c.name === list.saveTarget)
    ?? mine.find(c => c.watched !== false)
    ?? mine[0];
  return pick?.name ?? null;
}

// ── The person's icon ─────────────────────────────────────────────────────────

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The character as a favicon: their outline filled with their colour and their
 * emoji over it — CharacterBadge, as an image a tab can hold.
 */
function characterIcon(c: Pick<Character, 'avatar' | 'color' | 'shape'>): string {
  const color = xmlEscape(c.color);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 106 106">` +
    `<path d="${xmlEscape(characterShapePath(c.shape))}" fill="${color}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>` +
    `<text x="50" y="54" text-anchor="middle" dominant-baseline="central" font-size="60">${xmlEscape(c.avatar)}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Keep the tab's title and icon on this server and this person. Mount once
 * (App).
 *
 * The server's name is asked again whenever the tab comes back into view: a
 * name given on the Extension page, or in the extension's own options, then
 * reaches the tab without a reload. No extension, or none that knows this
 * server, and the title is just the app's.
 */
export function useAppIdentity(): void {
  useEffect(() => {
    let cancelled = false;
    const ask = () => {
      void listExtensionContexts().then(list => {
        if (cancelled) return;
        const name = list ? nameOfThisServer(list) : null;
        setAppIdentity({ title: name ? `${BASE_TITLE} ${name}` : BASE_TITLE });
      });
    };
    ask();
    const onVisible = () => { if (document.visibilityState === 'visible') ask(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const me = useCharacterStore(s => s.getMyCharacter());
  const avatar = me?.avatar, color = me?.color, shape = me?.shape;
  useEffect(() => {
    setAppIdentity({ icon: avatar && color ? characterIcon({ avatar, color, shape }) : null });
  }, [avatar, color, shape]);
}
