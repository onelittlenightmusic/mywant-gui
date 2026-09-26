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
  exit: () => { giveStickToBoard(); return set({ focused: false }); },
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

/** Is DOM focus, right now, inside an open sidebar? The single source of truth. */
function computeFocused(): boolean {
  const ae = document.activeElement as HTMLElement | null;
  if (!ae || ae === document.body || typeof ae.closest !== 'function') return false;
  // Through isInSidebarSurface: a blown-up card is the panel's own, drawn
  // elsewhere, and reading it as "left the panel" is what made everything
  // downstream of this flag fight the user for focus.
  return isInSidebarSurface(ae) && !!document.querySelector('[data-sidebar="true"][data-sidebar-open="true"]');
}

let tracking = false;

/**
 * Make `focused` a reading of reality rather than something anyone sets.
 *
 * This flag started out as a thing several places wrote to — the canvas handing
 * input over, the sidebar noticing a click, tab switches, a panel closing, a
 * landing resetting it — and with two RightSidebar instances mounted at once
 * (one open, one closed) sharing it, those writes interleaved in orders nobody
 * intended. Every resulting bug looked the same from outside: the flag and the
 * actual DOM focus disagreed. Since the flag exists only to describe where
 * focus is, and the card grids' exclusive input capture is gated on it, a
 * disagreement means the keys are owned by a panel that is not focused — Enter
 * vanishes while the mouse still works.
 *
 * So nobody sets it. It is computed from document.activeElement, and the only
 * way to change it is to move focus, which is the thing it was always claiming
 * to describe. Five separate races were patched one at a time before this;
 * deriving it removes the category.
 *
 * The poll is not laziness: unmounting a focused node (which is what changing
 * which want the sidebar shows does to the card grid) moves focus to <body>
 * and fires no event at all, so there is nothing to listen for.
 */
export function installSidebarFocusTracking(): void {
  if (tracking) return;
  tracking = true;
  const sync = () => {
    const v = computeFocused();
    if (useSidebarFocusStore.getState().focused !== v) {
      useSidebarFocusStore.setState({ focused: v });
    }
  };
  document.addEventListener('focusin', sync, true);
  // focusout lands before the new focus does, so read on the next tick.
  document.addEventListener('focusout', () => setTimeout(sync, 0), true);
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

