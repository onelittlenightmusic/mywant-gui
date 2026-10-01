import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * The GUI framed by a native app — an iPhone app showing it in a web view.
 *
 * The app draws its own controls in native UI, so the page gives up its
 * header and lets the board take the whole screen. What the header would have
 * offered is not lost: the page tells the app which buttons there are, the app
 * draws them, and a press comes back here to run the button's own action.
 *
 * The app announces itself before any of this script runs, by defining
 * `window.__mywantHost` from a document-start user script. Read once: an app
 * does not arrive or leave while a page is loaded.
 *
 *   page → app   window.webkit.messageHandlers.mywantHost.postMessage(msg)
 *   app  → page  window.__mywantHost.press(id)
 *
 * The app's buttons float over the page, along the top or just above its tab
 * bar — wherever this person keeps the header. It sets --host-inset-top or
 * --host-inset-bottom to how tall they are, for what has to stay clear.
 */

export interface HostButton {
  id: string;
  label: string;
  /** A Lucide icon name (e.g. "Globe"); the app picks its own glyph for it. */
  icon: string;
  /** Lit: its panel is open, its mode is on. */
  active?: boolean;
  /** For a menu entry that is a page: where it goes. The app may open a page
   *  it has a place of its own for (a tab) there, rather than in this one. */
  href?: string;
}

export interface HostMessage {
  type: 'header';
  buttons: HostButton[];
  menu: HostButton[];
  /** What can be done with the card in hand (the selected or expanded one) —
   *  drawn by the app ahead of the header's buttons. See useHostCardActions. */
  card: HostButton[];
  /** Where this person keeps the header (their character's display setting):
   *  the app puts its own bar there. */
  position: 'top' | 'bottom';
}

interface HostBridge {
  platform?: string;
  press?: (id: string) => void;
}

declare global {
  interface Window {
    __mywantHost?: HostBridge;
    webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
  }
}

/** True when a native app frames this page. */
export const nativeHost: boolean = typeof window !== 'undefined' && !!window.__mywantHost;

/** Hand a message to the app. Nothing happens without one. */
export function postToHost(message: HostMessage): void {
  window.webkit?.messageHandlers?.mywantHost?.postMessage(message);
}

/** What runs when the app presses one of the buttons it was told about. */
export function onHostPress(handler: (id: string) => void): void {
  if (window.__mywantHost) window.__mywantHost.press = handler;
}

/** A Lucide component's name, for the app to map to a glyph of its own. */
export function iconName(icon: { displayName?: string } | undefined, fallback: string): string {
  return icon?.displayName ?? fallback;
}

// ── What can be done with the card in hand ─────────────────────────────────
//
// A card can have actions of its own that the page draws inside it — a web
// want's page opens in a new tab from a button over the page. Framed by an
// app those are hard to reach (a frame drawn at half size, a tap that only
// selects), so the card in hand hands them over as well, and the app draws
// them beside the header's buttons. One card at a time: the one selected or
// expanded, the last to register.

export interface HostCardAction {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

interface HostCardState {
  owner: string | null;
  actions: HostCardAction[];
  set: (owner: string, actions: HostCardAction[]) => void;
  clear: (owner: string) => void;
}

export const useHostCardStore = create<HostCardState>((set, get) => ({
  owner: null,
  actions: [],
  set: (owner, actions) => set({ owner, actions }),
  clear: owner => { if (get().owner === owner) set({ owner: null, actions: [] }); },
}));

/**
 * Hand the app this card's actions while `actions` is non-null (the card is
 * the one in hand); take them back when it stops being, or goes. Nothing at
 * all outside an app.
 */
export function useHostCardActions(owner: string, actions: HostCardAction[] | null): void {
  // The latest closures, without re-registering on every render.
  const latest = useRef(actions);
  latest.current = actions;
  const shape = actions ? JSON.stringify(actions.map(a => [a.id, a.label, a.icon])) : '';
  useEffect(() => {
    if (!nativeHost || !shape) return;
    const now = latest.current ?? [];
    useHostCardStore.getState().set(owner, now.map(a => ({
      ...a,
      run: () => latest.current?.find(x => x.id === a.id)?.run(),
    })));
    return () => useHostCardStore.getState().clear(owner);
  }, [owner, shape]);
}
