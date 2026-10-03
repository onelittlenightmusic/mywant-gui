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
  /** The software pad, drawn by the app natively while it is switched on:
   *  what A/B/X/Y do where the character stands, and whether A has latched a
   *  mode. Its presses come back as controller frames, as a real gamepad's do.
   *  null while the pad is off. */
  pad: HostPad | null;
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
  /** A button of the app's native software pad pressed (down) or let go —
   *  up/down/left/right, A, B, X, Y, SELECT, START. See CanvasDPad's HostPad. */
  pad?: (id: string, down: boolean) => void;
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

/** Where the focused card of a list is on screen, for the app to put its
 *  native buttons (maximize) on it; null when no card is focused. */
export interface HostFocusCard {
  type: 'focus-card';
  card: { kind: HostFloatCard['kind']; id: string; x: number; y: number; w: number; h: number } | null;
}

/** Something done on a card page (nativeCardPage) that belongs to the board:
 *  the app hands it to the board's page as "float:<act>:<kind>:<id>". */
export interface HostCardAct { type: 'card-act'; act: string; kind: HostFloatCard['kind']; id: string }

/** Hand a message to the app. Nothing happens without one. */
export function postToHost(message: HostMessage | HostChoice | HostSheetDone | HostCardAct | HostCardSlot | HostFocusCard | HostBubbles | { type: 'haptic'; kind: 'lift' | 'drop' }
  | { type: 'drag-shape'; shape: 'circle'; x: number; y: number; w: number; h: number }): void {
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
  nativeHost && typeof location !== 'undefined' && new URLSearchParams(location.search).has('__panel');

/** What this panel page was asked to show (`?__panel=<id>`), or null. */
export function hostPanelId(): string | null {
  return nativePanelPage ? new URLSearchParams(location.search).get('__panel') : null;
}

/**
 * The address of a panel page: `path` (a page of this app) asked to be its
 * panel for `id`, with anything else the panel needs to know (e.g. where the
 * character stands) as further parameters. The one form every sheet's route
 * takes.
 */
export function hostPanelRoute(path: string, id: string, extra?: Record<string, string | number>): string {
  const q = new URLSearchParams({ __panel: id });
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, String(v));
  return `${path}?${q}`;
}

export interface HostSheet {
  /** The route of this app the sheet shows, e.g. /panel/want/<id>. */
  route: string;
  title: string;
  /** A Lucide icon name, or "". */
  icon: string;
  /** Where it comes from: the bottom (a panel, the default) or the right edge
   *  (a map — pulled out from the right and put back there). */
  edge?: 'bottom' | 'right';
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
export function useHostSheet(route: string | null, title: string, icon: string, close: () => void,
  edge: 'bottom' | 'right' = 'bottom'): void {
  const owner = useRef(`sheet-${Math.random().toString(36).slice(2)}`).current;
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!route) { useHostSheetStore.getState().clear(owner); return; }
    useHostSheetStore.getState().set(owner, { route, title, icon, edge }, () => closeRef.current());
  }, [owner, route, title, icon, edge]);
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
  set: (cards: HostFloatCard[]) => void;
}

/** The corner cards, for the app; what is done on them comes back through useHostActs. */
export const useHostFloatStore = create<HostFloatState>((set) => ({
  cards: [],
  set: (cards) => set({ cards }),
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

// ── The software pad, drawn by the app ──────────────────────────────────────
//
// Framed by an app, the board's software pad (CanvasDPad) is not drawn: the
// app draws a gamepad natively, laid out as one is, and hands its presses to
// the page as controller frames — the same way it hands over a real gamepad
// (hostControllerFrame), so holding, chords and long presses are the page's
// as ever. What the page still says is the legend.

export interface HostPad {
  labels: Partial<Record<'A' | 'B' | 'X' | 'Y', string>>;
  aLatched: boolean;
  /** The driven character's colour, which a held button takes. */
  color?: string;
}

export const useHostPadStore = create<{ pad: HostPad | null; set: (pad: HostPad | null) => void }>((set) => ({
  pad: null,
  set: (pad) => set({ pad }),
}));

/**
 * Tell a framing app where a list's focused want card is, as it moves (the
 * list scrolls, the focus walks): the app puts its native buttons on it — the
 * corner card's maximize — and, pressed, grows its native card frame out of
 * it. Read once a frame and sent only when it changes.
 */
export function useHostFocusedCard(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !nativeHost) return;
    let last = '';
    let raf = 0;
    const look = () => {
      const el = document.querySelector<HTMLElement>('[data-keyboard-nav-selected="true"][data-want-id]');
      const r = el?.getBoundingClientRect();
      const card = el && r && r.width > 0
        ? { kind: 'want' as const, id: el.dataset.wantId ?? '', x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
        : null;
      const key = JSON.stringify(card);
      if (key !== last) { last = key; postToHost({ type: 'focus-card', card }); }
      raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => { cancelAnimationFrame(raf); postToHost({ type: 'focus-card', card: null }); };
  }, [enabled]);
}

type HostAct = (act: string, kind: HostFloatCard['kind'], id: string) => void;
const hostActs = new Set<HostAct>();

/**
 * What something the app draws for this page did that the page carries out —
 * a corner card pressed, a card pressed in a map sheet, Edit on a card — sent
 * by the app as a press "float:<act>:<kind>:<id>". Any part of the page that
 * carries such acts out registers here while it is mounted; each is handed
 * every act and takes the ones it knows.
 */
export function useHostActs(handler: HostAct, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const h: HostAct = (a, k, id) => ref.current(a, k, id);
    hostActs.add(h);
    return () => { hostActs.delete(h); };
  }, [enabled]);
}

/** Hand an act to whoever carries it out (see useHostActs). */
export function dispatchHostAct(act: string, kind: HostFloatCard['kind'], id: string): void {
  for (const h of hostActs) h(act, kind, id);
}

/**
 * One page's detail panel as a framing app's sheet — the same for every page
 * with one (characters, agents, worlds, want types, recipes, things, kata).
 *
 * The sheet shows the page itself, at its own address, asked to be its panel
 * (`?__panel=<what is selected>`): AppSidebarHost draws the panel as the whole
 * page there (nativePanelPage), and this hook selects what the address names
 * once it is loaded. On the page underneath it gives the panel's route, which
 * goes in the page's useAppSidebar as hostRoute.
 *
 * `select` returns false while what it names is not there yet; it is tried
 * again whenever `ready` changes (e.g. the list's length).
 */
export function useHostPanel(
  selected: string | null | undefined,
  select: (id: string) => boolean | void,
  ready: unknown = 0,
  /** The page the panel opens on, if not this one; and what else it is told. */
  at?: { path?: string; extra?: Record<string, string | number> },
): string | undefined {
  const wanted = hostPanelId();
  const done = useRef(false);
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    if (!wanted || done.current) return;
    if (selectRef.current(wanted) !== false) done.current = true;
  }, [wanted, ready]);
  return selected ? hostPanelRoute(at?.path ?? location.pathname, selected, at?.extra) : undefined;
}

// ── Overlay bubbles' frames, drawn by the app ───────────────────────────────
//
// A bubble on the board (OverlayBubble — the character's actions, a Y
// connection's choices, a name prompt…) keeps its contents here; framed by an
// app, its frame — the outline, the tail, the shadow, the arrival — is the
// app's, drawn natively around the box the bubble says it occupies. The app's
// frame takes no touches, so the buttons inside are pressed as ever.

export interface HostBubble { id: string; x: number; y: number; w: number; h: number; tail: boolean }
export interface HostBubbles { type: 'bubbles'; list: HostBubble[] }

const hostBubbles = new Map<string, { el: HTMLElement; tail: boolean }>();
let bubbleLoop = 0;
let lastBubbles = '';

function lookAtBubbles() {
  const list: HostBubble[] = [];
  for (const [id, { el, tail }] of hostBubbles) {
    const r = el.getBoundingClientRect();
    if (r.width > 0) list.push({ id, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), tail });
  }
  const key = JSON.stringify(list);
  if (key !== lastBubbles) { lastBubbles = key; postToHost({ type: 'bubbles', list }); }
  bubbleLoop = hostBubbles.size ? requestAnimationFrame(lookAtBubbles) : 0;
}

/** A bubble's box, for the app to frame while it is on screen (OverlayBubble). */
export function useHostBubble(el: HTMLElement | null, tail: boolean): void {
  const id = useRef(`bubble-${Math.random().toString(36).slice(2)}`).current;
  useEffect(() => {
    if (!nativeHost || !el) return;
    hostBubbles.set(id, { el, tail });
    if (!bubbleLoop) bubbleLoop = requestAnimationFrame(lookAtBubbles);
    return () => {
      hostBubbles.delete(id);
      if (!hostBubbles.size) { cancelAnimationFrame(bubbleLoop); bubbleLoop = 0; lookAtBubbles(); }
    };
  }, [id, el, tail]);
}

// ── Buttons a page adds to the app's pill ───────────────────────────────────
//
// What a page draws in the GUI's own control pill (an extension's pillCells —
// the board's mode lamp) is not drawn in an app, which hides the page's
// header and its pill. Such a page hands its button over here instead, and it
// goes out with the header's buttons — on the app's pill, pressed like them.

export interface HostExtraButton extends HostButton { run: () => void }

export const useHostExtraButtonsStore = create<{
  buttons: Record<string, HostExtraButton>;
  set: (b: HostExtraButton) => void;
  remove: (id: string) => void;
}>((set) => ({
  buttons: {},
  set: (b) => set(s => ({ buttons: { ...s.buttons, [b.id]: b } })),
  remove: (id) => set(s => { const next = { ...s.buttons }; delete next[id]; return { buttons: next }; }),
}));

/**
 * A tap felt in the hand, framed by an app: a card picked up (lift) or put
 * down (drop). A web view has no vibration of its own on iOS, so the app plays
 * it. Nothing outside an app.
 */
export function hostHaptic(kind: 'lift' | 'drop'): void {
  if (nativeHost) postToHost({ type: 'haptic', kind });
}

/**
 * What is being picked up is round (a thing's ball): framed by an app, the
 * app draws the lifted picture — a web view on a phone takes no drag image
 * from the page (setDragImage) and would carry the ball's square box. `rect`
 * is where it is on screen. Nothing outside an app.
 */
export function hostDragShape(rect: DOMRect, shape: 'circle'): void {
  if (nativeHost) postToHost({ type: 'drag-shape', shape, x: rect.left, y: rect.top, w: rect.width, h: rect.height });
}
