import { createContext, useEffect, useRef, useState } from 'react';
import type { RefCallback } from 'react';
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
  /** Where the header cursor is (Select / Alt+Enter walks it — the gamepad's
   *  way into the header): on the hamburger ("menu"), on a button (its id), or
   *  nowhere; whether the menu is open, and on which entry. The app draws the
   *  ring on its own buttons and opens its own menu to match. */
  focus: { slot: string | null; menu: boolean; menuIndex: number };
  /** The panel (a phone sheet) that is open, whose frame the app draws. */
  panel: HostPanel | null;
  /** A panel the app shows as a sheet of its own, from this route. */
  sheet: HostSheet | null;
  /** The corner cards for what is underfoot, front first, for the app to draw
   *  natively (useHostFloatStore). Empty when there are none. */
  float: HostFloatCard[];
  /** Where this person keeps the header (their character's display setting):
   *  the app puts its own bar there. */
  position: 'top' | 'bottom';
}

interface HostBridge {
  platform?: string;
  press?: (id: string) => void;
  /** The app reads the controller itself and hands the page its state. */
  ownsController?: boolean;
  controller?: (frame: { buttons: boolean[]; axes: number[] }) => void;
}

declare global {
  interface Window {
    __mywantHost?: HostBridge;
    webkit?: { messageHandlers?: Record<string, { postMessage: (message: unknown) => void }> };
  }
}

/** True when a native app frames this page. */
export const nativeHost: boolean = typeof window !== 'undefined' && !!window.__mywantHost;
// For the stylesheet: the page goes edge to edge (styles/index.css).
if (nativeHost && typeof document !== 'undefined') document.documentElement.classList.add('native-host');

/** A menu entry chosen with the header cursor (A on it): the app decides —
 *  a page it holds a tab for opens in that tab; anything else it sends back
 *  as a press of the entry's id. */
export interface HostChoice {
  type: 'choose';
  id: string;
  href?: string;
}

// ── The controller, read by the app ─────────────────────────────────────────
//
// In a web view a page sees a gamepad only after one of its buttons has been
// pressed while that page was showing, and an app keeps a page per tab: each
// time the tab changed, the first press went to waking the gamepad up and did
// nothing (measured — Select on the Want tab, pads=0 until it). An app that
// says it owns the controller reads it natively and hands the page the state
// in the standard mapping, to the page that is showing only; then this page
// reads that and never the Gamepad API, so there is one source and no first
// press lost. What the buttons mean stays here (useInputActions).

export const hostOwnsController: boolean = nativeHost && !!window.__mywantHost?.ownsController;
let hostFrame: { buttons: boolean[]; axes: number[] } | null = null;
if (hostOwnsController && window.__mywantHost) {
  window.__mywantHost.controller = frame => { hostFrame = frame; };
}

/** The controller as the app last handed it over (null before it has). */
export function hostControllerFrame(): { buttons: boolean[]; axes: number[] } | null {
  return hostFrame;
}

/**
 * How much of the top and bottom of the page an app framing it covers, in px:
 * its floating bar (--host-inset-top / --host-inset-bottom) and, at the
 * bottom, the safe area its tab bar sits in. Zero for both outside an app.
 * For what is placed by measuring rather than by CSS — a maximized card.
 */
export function hostInsets(): { top: number; bottom: number } {
  if (!nativeHost || typeof document === 'undefined') return { top: 0, bottom: 0 };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding-top:calc(env(safe-area-inset-top, 0px) + var(--host-inset-top, 0px));' +
    'padding-bottom:calc(env(safe-area-inset-bottom, 0px) + var(--host-inset-bottom, 0px));';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}

/** A panel page (see nativePanelPage) whose panel has closed itself. */
export interface HostSheetDone { type: 'sheet-done' }

/** Where a panel page (nativePanelPage) left room for its subject's card, for
 *  the app to put its native card frame there (null: no room any more). In
 *  the page's own coordinates, kept up to date as it scrolls. */
export interface HostCardSlot {
  type: 'card-slot';
  slot: { kind: HostFloatCard['kind']; id: string; x: number; y: number; w: number; h: number } | null;
}

/** Something done on a card page (nativeCardPage) that belongs to the board:
 *  the app hands it to the board's page as "float:<act>:<kind>:<id>". */
export interface HostCardAct { type: 'card-act'; act: string; kind: HostFloatCard['kind']; id: string }

/** Hand a message to the app. Nothing happens without one. */
export function postToHost(message: HostMessage | HostChoice | HostSheetDone | HostCardAct | HostCardSlot): void {
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

// ── The open panel's frame, drawn by the app ────────────────────────────────
//
// A panel (RightSidebar as a phone sheet) keeps its content here and gives up
// its frame — the grabber, the title and its icon, the close button — to an
// app framing the page, which draws them natively at the sheet's top edge.
// The sheet leaves that strip empty for it (HOST_PANEL_BAR) and says where
// its top is once it has arrived; a press on the app's close comes back as
// "panel:close". One panel at a time: the last to open.

/** The height of the strip a framed sheet leaves for the app's bar, in px. */
export const HOST_PANEL_BAR = 20;
/**
 * True inside a sheet whose frame the app draws: a panel's own close
 * (PanelCloseButton) is not drawn there — the app's bar has the close, for
 * every panel, including the ones that head themselves.
 */
export const HostFramedPanel = createContext(false);

export interface HostPanel {
  title: string;
  /** A Lucide icon name, or "" for none. */
  icon: string;
  /** The sheet's top edge, in page px, where the app draws its bar. */
  top: number;
  /** Unused now (every framed panel gets the app's full bar); kept false. */
  bare: boolean;
}

interface HostPanelState {
  owner: string | null;
  panel: HostPanel | null;
  close: (() => void) | null;
  set: (owner: string, panel: HostPanel, close: () => void) => void;
  clear: (owner: string) => void;
}

export const useHostPanelStore = create<HostPanelState>((set, get) => ({
  owner: null,
  panel: null,
  close: null,
  set: (owner, panel, close) => set({ owner, panel, close }),
  clear: owner => { if (get().owner === owner) set({ owner: null, panel: null, close: null }); },
}));

// ── Panels as the app's own sheets ──────────────────────────────────────────
//
// A panel that can stand on a page of its own (a want's details, Global) is
// not drawn here at all when an app frames the page: the app opens a real
// sheet — its slide, its drag, its heights, the board still usable behind it
// — with a second web view in it showing just that panel, from a route of
// this app's (/panel/want/<id>, /panel/global). The panel's content is the
// same components; only where it is drawn changes.

/** This page IS such a panel, inside an app's sheet: draw the panel, full. */
export const nativePanelPage: boolean =
  nativeHost && typeof location !== 'undefined' && location.pathname.startsWith('/panel/')
  && !location.pathname.startsWith('/panel/card/');

export interface HostSheet {
  /** The route of this app the sheet shows, e.g. /panel/want/<id>. */
  route: string;
  title: string;
  /** A Lucide icon name, or "". */
  icon: string;
}

interface HostSheetState {
  sheet: HostSheet | null;
  close: (() => void) | null;
  owner: string | null;
  set: (owner: string, sheet: HostSheet, close: () => void) => void;
  /** Only the one who asked for the sheet can take it back. */
  clear: (owner: string) => void;
}

export const useHostSheetStore = create<HostSheetState>((set, get) => ({
  sheet: null,
  close: null,
  owner: null,
  set: (owner, sheet, close) => set({ owner, sheet, close }),
  clear: (owner) => { if (get().owner === owner) set({ owner: null, sheet: null, close: null }); },
}));

/**
 * Ask a framing app to show a panel as a sheet of its own, from its route
 * (null: no sheet), and be told when the person closes it there. Whoever
 * calls this draws nothing for the panel itself while it is the app's.
 */
export function useHostSheet(route: string | null, title: string, icon: string, close: () => void): void {
  const owner = useRef(`sheet-${Math.random().toString(36).slice(2)}`).current;
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!route) { useHostSheetStore.getState().clear(owner); return; }
    useHostSheetStore.getState().set(owner, { route, title, icon }, () => closeRef.current());
  }, [owner, route, title, icon]);
  useEffect(() => () => useHostSheetStore.getState().clear(owner), [owner]);
}

/** Framed by an app on a phone, where panels are the app's sheets. */
export function hostSheetsOn(): boolean {
  return nativeHost && !nativePanelPage && typeof window !== 'undefined' && window.innerWidth < 640;
}

// ── The corner card, drawn by the app ───────────────────────────────────────
//
// On a phone the board shows a card for what is underfoot in its corner
// (CanvasFocusFloatCard). Framed by an app, the board does not draw it: it
// hands over which cards they are (front first), and the app draws the frame
// — its corner, its stack, its arrival — natively, with a small web view in
// it showing the card itself from a route of this app (/panel/card/<kind>/<id>,
// nativeCardPage). Being native, the card is what the details sheet grows out
// of and shrinks back into. What is done on the card that belongs to the board
// (opening its details, bringing a card forward, editing...) comes back to
// the board as "float:<act>:<kind>:<id>" presses.

export interface HostFloatCard { kind: 'want' | 'thing'; id: string }

/** This page IS a corner card, inside the app's frame: draw the card, full. */
export const nativeCardPage: boolean =
  nativeHost && typeof location !== 'undefined' && location.pathname.startsWith('/panel/card/');

interface HostFloatState {
  cards: HostFloatCard[];
  act: ((act: string, kind: HostFloatCard['kind'], id: string) => void) | null;
  set: (cards: HostFloatCard[], act: HostFloatState['act']) => void;
  clear: () => void;
}

export const useHostFloatStore = create<HostFloatState>((set) => ({
  cards: [],
  act: null,
  set: (cards, act) => set({ cards, act }),
  clear: () => set({ cards: [], act: null }),
}));

/**
 * Leave room for a subject's card on a panel page inside an app's sheet: the
 * app draws the card there natively — the same card frame the corner card is
 * (useHostFloatStore) — and is told where the room is, and again whenever the
 * panel scrolls or the room changes size.
 */
export function useHostCardSlot(kind: HostFloatCard['kind'], id: string): RefCallback<HTMLElement> {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!el) return;
    let frame = 0;
    const send = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        postToHost({ type: 'card-slot', slot: { kind, id, x: r.left, y: r.top, w: r.width, h: r.height } });
      });
    };
    send();
    const resize = new ResizeObserver(send);
    resize.observe(el);
    window.addEventListener('scroll', send, { capture: true, passive: true });
    window.addEventListener('resize', send);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', send, { capture: true });
      window.removeEventListener('resize', send);
      postToHost({ type: 'card-slot', slot: null });
    };
  }, [el, kind, id]);
  return setEl;
}
