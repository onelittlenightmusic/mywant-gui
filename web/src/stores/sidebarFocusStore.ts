import { create } from 'zustand';
import { giveStickToBoard, giveStickToPanel } from './stickOwner';

/**
 * Whether input has been handed to the detail sidebar.
 *
 * The sidebar has always had this notion — WantDetailsSidebar's
 * `sidebarDetailFocused` — but it was private to that component, entered only
 * by an L1/R1 press or a click on a parameter card. Three things outside it now
 * need the same fact:
 *
 *   - the canvas, which offers "open details" beside the CursorMan and has to
 *     stop offering it once you have taken it;
 *   - RightSidebar, which draws the highlight frame that tells you input is
 *     over here now;
 *   - the thing sidebar, which has no card grid of its own but is just as much
 *     a place focus can be.
 *
 * So the fact lives here instead of inside one of its three readers.
 *
 * `request` is the ask, separate from the state: bumping it means "move DOM
 * focus into the sidebar content", which is what actually redirects the arrow
 * keys. A counter rather than a boolean because the same ask can be made twice
 * in a row (tab switches use it) and each one has to land.
 */
interface SidebarFocusStore {
  focused: boolean;
  request: number;
  setFocused: (v: boolean) => void;
  /** Ask the open sidebar to take DOM focus, and mark it focused. */
  enter: () => void;
  /** Ask again without changing the flag — used by tab switches. */
  bumpRequest: () => void;
  /** Hand input back to whatever is behind the sidebar. */
  exit: () => void;
}

/**
 * Is this node inside the detail panel — including the parts of it that are not
 * inside it in the DOM?
 *
 * The panel's card can be blown up, and a blown-up card is a portal at the
 * document root. Half of this app answers "is focus in the panel?" by asking
 * whether the panel contains it, and every one of those answers is wrong for a
 * portal: the focus loops below dragged focus back out of a card the user was
 * typing into, and the input guards let canvas handlers fire over the top of it.
 *
 * So containment is asked once, here, and the portal carries a mark saying
 * whose it is (see WantCard's data-sidebar-portal). Nothing else should ask
 * with `closest('[data-sidebar="true"]')` — that question cannot see portals.
 */
export function isInSidebarSurface(el: EventTarget | Element | null | undefined): boolean {
  const node = el as Element | null | undefined;
  if (!node || typeof node.closest !== 'function') return false;
  return !!node.closest('[data-sidebar="true"], [data-sidebar-portal="true"]');
}

/*
 * Moved to stores/focusOwner.ts.
 *
 * Every one of these was a transition — a list of steps done in an order,
 * composed afresh by each caller. They are one call there now. What stays
 * here is what this file is actually about: the flag, the reading of
 * document.activeElement that keeps it honest, and the two ways to put focus
 * on a panel.
 */

/** Forget where focus was in the panel: the keys have deliberately left it. */
function lastInPanelForget(): void { lastInPanel = null; }

export const useSidebarFocusStore = create<SidebarFocusStore>((set) => ({
  focused: false,
  request: 0,
  setFocused: (v) => set({ focused: v }),
  // The stick travels with the ask, and only with the ask. `focused` itself is
  // a reading of document.activeElement (see installSidebarFocusTracking) and
  // therefore flickers as focus moves around; these two are the deliberate acts,
  // so they are the ones ownership hangs off. See stores/stickOwner.
  enter: () => { giveStickToPanel(); return set(s => ({ focused: true, request: s.request + 1 })); },
  // Asking again is still asking: the panel's own L1/R1 or B+L1/R1 handlers use this
  // to walk into it and between its tabs, and all of those are the user saying
  // they are in there. Unlike `focused`, which is only ever a reading of where
  // DOM focus happens to be, nothing incidental calls this.
  bumpRequest: () => { giveStickToPanel(); return set(s => ({ request: s.request + 1 })); },
  exit: () => { lastInPanelForget(); giveStickToBoard(); return set({ focused: false }); },
}));

/**
 * Put DOM focus on the open detail panel, and keep trying briefly.
 *
 * The flag alone is not enough: it only decides who *should* own input, and the
 * effects that turn that into real focus live in RightSidebar — of which two
 * are mounted at once (one open, one closed) sharing this one flag. Whether the
 * open one's effect actually re-ran for a given press depended on which of its
 * dependencies had changed, so the ask sometimes evaporated and left the flag
 * true with focus still on <body> — a state where the card grids hold the
 * exclusive input capture but nothing inside is focused, so Enter goes nowhere.
 *
 * Doing it here, at the point of intent, removes that whole chain. The retry is
 * for the phone, where this same press is what opens the panel, so it does not
 * exist yet on the first frame.
 */
export function focusSidebarPanel(maxFrames = 30): void {
  let left = maxFrames;
  const tick = () => {
    const el = document.querySelector<HTMLElement>('[data-sidebar="true"][data-sidebar-open="true"]');
    if (el) {
      const ae = document.activeElement;
      // Containment through isInSidebarSurface, so a blown-up card counts as
      // landed: it is the panel's own card, drawn elsewhere. Asking `el`
      // directly made this loop spend its whole budget hauling focus back out
      // of the thing the user was typing into.
      if (ae && ae !== document.body && isInSidebarSurface(ae)) return;   // landed
      // The sidebar's own card is the thing the panel is ABOUT, so that is
      // where arriving focus belongs — not the bare panel, and not whichever
      // field grid happens to be live. From there the arrows walk down into
      // the fields. Falls back to the panel for sidebars that have no card.
      const primary = el.querySelector<HTMLElement>('[data-sidebar-primary="true"]');
      (primary ?? el).focus();
    }
    // Keep going until focus is CONFIRMED inside, not merely requested once.
    // Arriving on a new want swaps the panel's contents in the same beat, so a
    // single focus() can land on a node that is unmounted a frame later —
    // which put focus back on <body> and made every other press do nothing.
    if (--left > 0) requestAnimationFrame(tick);
  };
  // Now, then keep trying — the same shape as focusOwner's handOverToSidebar /
  // handOverToSidebarWhenReady pair, and for the same reason. Starting inside
  // the frame callback meant focus was never in the panel for the first frame
  // even when the panel was already there and ready, and `focused` is a
  // reading of where DOM focus is: a poll that ran in that gap saw <body> and
  // set it back to false, disarming the panel's own way out. The retry loop is
  // for the cases that genuinely need to wait (contents swapping, a sheet
  // animating in), not for the common one.
  tick();
}

/** An open detail panel is on screen (or this page is one, in an app's sheet). */
function panelOpen(): boolean {
  return !!document.querySelector('[data-sidebar="true"][data-sidebar-open="true"]');
}

let tracking = false;
/** Where focus last was inside the panel — where it is put back (see below). */
let lastInPanel: HTMLElement | null = null;

/**
 * Keep `focused` — whether the panel holds the keys — as the focus state
 * machine says, and DOM focus where `focused` says it is.
 *
 * It used to be the other way round: a reading of document.activeElement,
 * polled. That ended the races between several writers (two RightSidebars
 * mounted at once, a landing, a tab switch, each setting it), but it made the
 * DOM the authority: any moment focus fell to <body> — an editor closed with
 * Escape, a section handing over between its cards, a node swapped under the
 * focus — the panel was read as having let go, and the next press of the pad
 * walked the board's wants instead. A brief accident of the DOM became a move
 * of the keys.
 *
 * Now the moves are the authority, and still written in one place each
 * (focusOwner's moveFocusTo, and here):
 *
 *   - Into the panel: moveFocusTo('panel') (A / Enter), or focus arriving in
 *     the open panel by any means — a click, a tap, Tab. Entering is never
 *     an accident.
 *   - Out of it: moveFocusTo('board') (B / Escape out, walking on), a press on
 *     the board or the list (the page's <main>), or the panel closing.
 *   - Focus falling to <body> while the panel holds the keys is no move at
 *     all: it is put back in the panel — where it last was, or the panel.
 *
 * The poll stays for what fires no event: a focused node unmounted (the panel
 * swapping to another want) moves focus to <body> silently.
 */
export function installSidebarFocusTracking(): void {
  if (tracking) return;
  tracking = true;
  const set = (v: boolean) => {
    if (useSidebarFocusStore.getState().focused !== v) useSidebarFocusStore.setState({ focused: v });
  };
  const sync = () => {
    const st = useSidebarFocusStore.getState();
    const ae = document.activeElement as HTMLElement | null;
    const inPanel = !!ae && ae !== document.body && isInSidebarSurface(ae);
    if (!panelOpen()) {
      // The panel gone (closed, another page): nothing holds the keys there.
      if (st.focused) { set(false); giveStickToBoard(); }
      return;
    }
    if (inPanel) {
      lastInPanel = ae;
      set(true);
      return;
    }
    if (!st.focused) return;
    if (!ae || ae === document.body) {
      // Fell out by accident: back in, where it was, or onto the panel.
      const back = lastInPanel && lastInPanel.isConnected && isInSidebarSurface(lastInPanel)
        ? lastInPanel
        : document.querySelector<HTMLElement>('[data-sidebar="true"][data-sidebar-open="true"]');
      back?.focus({ preventScroll: true });
    }
    // Focus on something real outside (a header field, an overlay drawn at
    // the document root): left alone, and the panel still holds the keys
    // until one of the moves above says otherwise.
  };
  document.addEventListener('focusin', sync, true);
  // focusout lands before the new focus does, so read on the next tick.
  document.addEventListener('focusout', () => setTimeout(sync, 0), true);
  // A press on the board or the list: the keys go there with it.
  document.addEventListener('pointerdown', (e) => {
    if (!useSidebarFocusStore.getState().focused) return;
    const t = e.target as HTMLElement | null;
    if (!t || typeof t.closest !== 'function' || isInSidebarSurface(t) || !t.closest('main')) return;
    lastInPanel = null;
    set(false);
    giveStickToBoard();
    const ae = document.activeElement as HTMLElement | null;
    if (ae && isInSidebarSurface(ae)) ae.blur();
  }, true);
  setInterval(sync, 200);
}

/**
 * Put focus on the sidebar's embedded card specifically.
 *
 * Unlike focusSidebarPanel this does not stand down when focus is already
 * somewhere in the panel — walking up out of the field cards means focus IS in
 * the sidebar, and moving it is the whole point.
 */
export function focusSidebarCard(maxFrames = 20): void {
  let left = maxFrames;
  const tick = () => {
    // While the card is blown up, the thing worth having focus is inside it.
    if (document.querySelector('[data-sidebar-portal="true"]')) return;
    const card = document.querySelector<HTMLElement>(
      '[data-sidebar="true"][data-sidebar-open="true"] [data-sidebar-primary="true"]',
    );
    if (card) {
      if (document.activeElement === card) return;   // confirmed
      card.focus();
    }
    // Keep trying until it sticks. Leaving the field grid re-renders the tab
    // around the card, so a single focus() can land on a node that is replaced
    // a frame later — which put focus back on <body> and made the walk one-way.
    if (--left > 0) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

