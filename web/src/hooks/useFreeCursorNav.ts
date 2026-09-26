import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getControllerState } from '@/lib/controllerHub';
import { setStickNavSuppressed, setStickOwnerProbe, getOptionArrowVector, isCanvasCursorActive, isSpaceHeld } from './useInputActions';
import { isStickWithPanel } from '@/stores/stickOwner';
import { isMinimapFocused } from '@/stores/minimapFocusStore';
import { readCursorOwner, type FocusOwner } from '@/stores/focusOwner';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from './useDarkMode';

// Mirrors WantCanvas's CursorMan drag constants (see commitCursorManTo /
// renderCursorManDragOffset there) — same feel, but in screen pixels instead
// of grid cells since list pages have no grid coordinate system.
const DRAG_SPEED_PX  = 22; // px/frame at full deflection, 60fps (~1320px/s); x3 with B held
const DRAG_THRESHOLD = 0.15;
// Matches the browser extension's cursorOverlayCore hover-highlight throttle
// (g.highlightAt) — bounds getBoundingClientRect() cost across every
// candidate item to ~16fps instead of every rAF frame.
const HIGHLIGHT_THROTTLE_MS = 60;
// Edge auto-scroll: while dragging near the top/bottom of the viewport, scroll
// the page underneath the (viewport-fixed) cursor instead of just stopping at
// the edge — same idea as drag-and-drop libraries' edge-scroll.
const EDGE_SCROLL_MARGIN = 80; // px from top/bottom edge where scrolling kicks in
const EDGE_SCROLL_SPEED  = 16; // px/frame max, at the very edge

/** Nearest scrollable ancestor of `el` (overflow-y auto/scroll with real overflow), else the page's own scrolling element. */
function findScrollableAncestor(el: Element | null): Element | null {
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const style = getComputedStyle(node);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return document.scrollingElement;
}

/**
 * Scroll whatever scrollable box is under (x, y) when the point is near that
 * box's own top or bottom edge — see the stick drag, which is where this is
 * explained. `minY`/`maxY` bound the edge to what the cursor can reach, and
 * `scopeEl`, when given, is the only surface allowed to scroll.
 */
function edgeScroll(nx: number, ny: number, minY: number, maxY: number, scopeEl: HTMLElement | null): void {
  const under = document.elementFromPoint(nx, ny);
  // The last way out: only the surface holding the keys may scroll.
  // Even clamped, the cursor rides its own boundary, and the element
  // under a point exactly on that edge can belong to what is behind —
  // which would scroll the board out from under a panel being read.
  if (scopeEl && !(under && scopeEl.contains(under))) return;
  const box = findScrollableAncestor(under);
  if (!box) return;
  const r = box === document.scrollingElement
    ? { top: 0, bottom: window.innerHeight }
    : box.getBoundingClientRect();
  const top = Math.max(r.top, minY);
  const bottom = Math.min(r.bottom, maxY);
  // A short box gets a proportionally narrower edge, so its middle
  // still reads rather than scrolls.
  const margin = Math.min(EDGE_SCROLL_MARGIN, (bottom - top) / 3);
  let scrollDelta = 0;
  if (margin > 0 && ny < top + margin) {
    scrollDelta = -EDGE_SCROLL_SPEED * (1 - (ny - top) / margin);
  } else if (margin > 0 && ny > bottom - margin) {
    scrollDelta = EDGE_SCROLL_SPEED * (1 - (bottom - ny) / margin);
  }
  if (scrollDelta !== 0) box.scrollBy(0, scrollDelta);
}

/**
 * Shared, app-wide convention: any element carrying this attribute is a
 * candidate free-cursor snap target, full stop — no per-page registration.
 * Add it directly to a card/button's real clickable DOM node (the one that
 * already has an onClick handler) and the single global cursor (see
 * useGlobalFreeCursor, mounted once in App.tsx) picks it up automatically.
 * On release, the globally-nearest tagged element (by center-to-center
 * screen distance) is simply `.click()`ed — reusing whatever that element's
 * own onClick already does (open a sidebar, start editing, toggle a
 * checkbox, ...) instead of every page hand-rolling an onSnap callback.
 */
export const FREE_CURSOR_ITEM_ATTR = 'data-free-cursor-item';
const FREE_CURSOR_ITEM_SELECTOR = `[${FREE_CURSOR_ITEM_ATTR}]`;

/**
 * Land on `el` the way a mouse would.
 *
 * Not `el.click()`. The tag is a shared convention with no say in what kind of
 * element wears it, and the spatial minimap wears it on an SVG `<g>` — which
 * has no click() method. Calling it threw, from inside the poll below, before
 * the poll had re-armed its own rAF: one release with the cursor nearest a
 * mini-tile and the free cursor was dead for the rest of the page's life. A
 * dispatched event reaches the same React onClick and works on any element.
 */
function clickTarget(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

/**
 * The card the keys are on right now, however it says so.
 *
 * The selected-card attribute first, because that is the grids' own answer and
 * it survives focus being on a child; DOM focus otherwise, for the surfaces
 * with no selection of their own.
 */
function currentlyOn(): HTMLElement | null {
  const selected = document.querySelector<HTMLElement>('[data-keyboard-nav-selected="true"]');
  if (selected) return selected;
  const active = document.activeElement as HTMLElement | null;
  return active && active !== document.body ? active : null;
}

/** Are these the same place — either being the other, or containing it? */
function isSameSpot(from: HTMLElement | null, to: HTMLElement): boolean {
  if (!from) return false;
  return from === to || from.contains(to) || to.contains(from);
}

/**
 * The surface that currently holds the keys, or null when the board does.
 *
 * The cursor is clamped to the viewport, not to any container — that is what
 * lets it cross from one card grid into another, and it is right whenever the
 * board is in charge. It is wrong the moment a surface in front of the board has
 * been handed input: that surface is drawn OVER the board, so a cursor free to
 * leave it lands on something behind it, and releasing there clicks that thing.
 * The detail panel showed this first — pushing right to reach the last card in a
 * row snapped onto a mini-tile behind the panel's edge and moved the camera —
 * and the minimap has the same shape of problem from the other side.
 *
 * Asked as ownership rather than "is one on screen": the detail panel opens by
 * itself when the character walks onto a want, and treating that as a reason to
 * confine anything is what used to take the stick out of the user's hand
 * mid-walk (see stickOwner). While the board owns the keys this returns null and
 * nothing is confined at all.
 */
const SURFACE_SELECTOR: Record<Exclude<FocusOwner, 'board'>, string> = {
  // Drilling into a card is a deliberate narrowing — from "the panel" to "this
  // control" — and the cursor narrows with it rather than roaming the whole
  // panel and landing on a neighbouring card's button.
  card: '[data-inner-focus-card="true"]',
  minimap: '[data-minimap-panel="true"]',
  panel: '[data-sidebar="true"][data-sidebar-open="true"]',
};

function keyHoldingSurface(): HTMLElement | null {
  // Which surface that is, is not decided here. It was, in a chain of ifs that
  // repeated the arbitration in stores/focusOwner line for line — down to
  // asking the card first — so the two could drift apart. See readCursorOwner
  // for why the cursor asks about the stick where the keys ask about focus.
  const owner = readCursorOwner();
  if (owner === 'board') return null;
  const el = document.querySelector<HTMLElement>(SURFACE_SELECTOR[owner]);
  if (el) return el;
  // A claim with nothing on screen to confine to. Only a card really gets here
  // — it can be unmounted mid-edit — and the thing it was drilled into is the
  // next best answer, which is the panel it is a card of.
  return owner === 'card' && isStickWithPanel()
    ? document.querySelector<HTMLElement>(SURFACE_SELECTOR.panel)
    : null;
}

/**
 * Nearest visible tagged element to (x, y) — across the document, or within the
 * surface holding the keys when there is one. See keyHoldingSurface.
 */
function findNearestTarget(x: number, y: number): HTMLElement | null {
  const scope = keyHoldingSurface();
  let nearestEl: HTMLElement | null = null;
  let nearestDist = Infinity;
  document.querySelectorAll<HTMLElement>(FREE_CURSOR_ITEM_SELECTOR).forEach(el => {
    if (scope && !scope.contains(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // hidden/unmounted
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < nearestDist) { nearestDist = d; nearestEl = el; }
  });
  return nearestEl;
}

// Pending element to warp the free cursor onto — set by warpFreeCursorToElement,
// consumed on the next poll tick (see useGlobalFreeCursor's poll()).
let _pendingWarpEl: HTMLElement | null = null;

/**
 * Smoothly moves the global free cursor (and its highlight frame) to land on
 * `el`, as if the user had dragged there and released — used for input paths
 * with no actual stick drag to derive a destination from, e.g. Dashboard's
 * L1/R1 list-mode minimap handoff (jump straight to the mini-card matching
 * whichever want is currently keyboard-focused in the main list).
 */
export function warpFreeCursorToElement(el: HTMLElement): void {
  _pendingWarpEl = el;
}

/**
 * A target the cursor lands on without pressing.
 *
 * Landing clicks, and for most targets the click is the pick — a card is
 * selected by being clicked. A target whose click is an ACT (Pin, in Add
 * Thing's Pin tab, puts a thing on the board) would be acted on just by the
 * cursor passing over it and stopping, so it wears this beside
 * FREE_CURSOR_ITEM_ATTR and is only focused; A then presses it.
 */
export const FREE_CURSOR_FOCUS_ONLY_ATTR = 'data-free-cursor-focus-only';

// ── Carry ────────────────────────────────────────────────────────────────────
//
// The pad's drag-and-drop. A `draggable` element is picked up (a long A/Enter
// on it — see its caller), the cursor takes it out of the panel it lives in and
// across the page, and A puts it down wherever the cursor is.
//
// Put down through the same HTML5 drag events a mouse drag fires, carrying the
// same DataTransfer the element's own onDragStart filled in. So whatever a
// mouse drop onto that spot does, this does — the board's handler for a thing
// out of the Pin tab, say — and nobody who accepts a drop has to learn about a
// second way of being dropped on.

interface Carry {
  source: HTMLElement;
  data: DataTransfer;
  /** A copy of the source that rides under the cursor. */
  ghost: HTMLElement;
  /** Where the cursor is, in viewport px. */
  x: number;
  y: number;
  /** What the last dragover was sent to, so it is sent once per move. */
  overAt: string;
  /** The press that picked this up ends with a release that is not a drop. */
  skipConfirm: boolean;
}

let _carry: Carry | null = null;
const _carryListeners = new Set<() => void>();
const notifyCarry = () => _carryListeners.forEach(fn => fn());

/** Is something being carried right now? */
export function isFreeCursorCarrying(): boolean {
  return _carry !== null;
}

/** The same answer, for a component that renders from it. */
export function useFreeCursorCarrying(): boolean {
  return useSyncExternalStore(
    (fn) => { _carryListeners.add(fn); return () => { _carryListeners.delete(fn); }; },
    isFreeCursorCarrying,
  );
}

function dragEventAt(type: string, target: Element, x: number, y: number, data: DataTransfer): DragEvent {
  const ev = new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: data });
  target.dispatchEvent(ev);
  return ev;
}

/**
 * Pick `source` up. Returns whether anything was picked up — nothing is, when
 * the element puts nothing in the drag (not draggable right now, say).
 *
 * `skipConfirm` is for a pick-up made with a key that is still down: Enter's
 * release is a confirm, and the release of the very press that picked the thing
 * up must not also put it down.
 */
export function beginFreeCursorCarry(source: HTMLElement, opts: { skipConfirm?: boolean } = {}): boolean {
  if (_carry) return false;
  const r = source.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const data = new DataTransfer();
  dragEventAt('dragstart', source, x, y, data);
  if (data.types.length === 0) return false;

  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  ghost.removeAttribute(FREE_CURSOR_ITEM_ATTR);
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed', left: '0px', top: '0px', margin: '0',
    width: `${r.width}px`, height: `${r.height}px`,
    zIndex: '199', pointerEvents: 'none', opacity: '0.85',
    boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
    transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(-3deg)`,
  });
  document.body.appendChild(ghost);

  _carry = { source, data, ghost, x, y, overAt: '', skipConfirm: !!opts.skipConfirm };
  notifyCarry();
  return true;
}

function endCarry(): void {
  const c = _carry;
  if (!c) return;
  c.ghost.remove();
  _carry = null;
  setStickNavSuppressed(false);
  // Back to where it was picked up from: the cursor is held inside the panel
  // again from the next frame, and the card it came from is where the keys are.
  if (c.source.isConnected) _pendingWarpEl = c.source;
  notifyCarry();
}

/**
 * Put it down where the cursor is. Returns whether anything there took it.
 *
 * Asked the way the browser asks: a dragover first, and only an element that
 * cancels it gets the drop. Put down over nothing that wants it, it goes back.
 */
export function dropFreeCursorCarry(): boolean {
  const c = _carry;
  if (!c) return false;
  const under = document.elementFromPoint(c.x, c.y);
  let taken = false;
  if (under && !c.source.contains(under)) {
    taken = dragEventAt('dragover', under, c.x, c.y, c.data).defaultPrevented;
    if (taken) dragEventAt('drop', under, c.x, c.y, c.data);
  }
  // What the source's dragend reads to know whether it went anywhere, as it
  // would after a mouse drop.
  c.data.dropEffect = taken ? (c.data.effectAllowed === 'move' ? 'move' : 'copy') : 'none';
  dragEventAt('dragend', c.source, c.x, c.y, c.data);
  endCarry();
  return taken;
}

/** Give up the carry; nothing is dropped anywhere. */
export function cancelFreeCursorCarry(): void {
  const c = _carry;
  if (!c) return;
  c.data.dropEffect = 'none';
  dragEventAt('dragend', c.source, c.x, c.y, c.data);
  endCarry();
}

/**
 * A confirm arrived while carrying — the release of the press that began it,
 * or a real press. Returns whether it was the former (and so is spent).
 */
export function consumeCarrySkipConfirm(): boolean {
  if (!_carry?.skipConfirm) return false;
  _carry.skipConfirm = false;
  return true;
}

export interface UseGlobalFreeCursorResult {
  /** Attach to the floating cursor's wrapper div (position: fixed). */
  cursorRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the drag-preview highlight frame's wrapper div (position: fixed). */
  highlightRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the cursor overlay should currently be mounted/visible. */
  active: boolean;
}

/**
 * The single, app-wide free-roaming "CursorMan"-equivalent for list/grid
 * pages. Mount exactly once (see GlobalFreeCursor in App.tsx). While the
 * plain left stick or Option(Alt)+Arrow (no A held) is tilted past
 * DRAG_THRESHOLD, a floating cursor glides continuously in screen-pixel
 * space (speed scaled by tilt magnitude, x3 with B held), unclamped by any
 * container — so it can cross freely between whatever's currently on screen
 * (want list, an open sidebar's parameter grid, ...). Once the stick returns
 * to rest, the globally-nearest FREE_CURSOR_ITEM_ATTR-tagged element (by
 * center-to-center screen distance, searched across the whole document) is
 * simply clicked.
 *
 * While dragging, a character-colored highlight frame previews whichever
 * item is currently nearest (throttled — see HIGHLIGHT_THROTTLE_MS), the
 * same "what will I land on if I let go now" preview the browser extension's
 * cursorOverlayCore shows for hovered page elements.
 *
 * Suppresses useInputActions' normal per-tick discrete stick-to-arrow-key
 * stepping for the duration (see setStickNavSuppressed) so the two mechanisms
 * never fight — D-pad and real keyboard arrows are untouched.
 *
 * Once a snap lands on an item, the cursor stays parked there (centered on
 * that item) instead of disappearing — mirroring WantCanvas's CursorMan,
 * which likewise stays put at its last committed cell until moved again.
 * The next drag resumes from that parked spot, not from screen center.
 */
export function useGlobalFreeCursor(): UseGlobalFreeCursorResult {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null); // set while dragging
  /**
   * What was already under the keys when this drag began.
   *
   * Kept so a release can tell "I went somewhere" from "I came back": see the
   * landing below, where it decides whether the release is a press at all.
   */
  const engagedOnRef = useRef<HTMLElement | null>(null);
  const restPosRef = useRef<{ x: number; y: number } | null>(null); // last parked spot
  const lastHighlightAtRef = useRef(0);
  const [visible, setVisible] = useState(false);

  const isDark = useDarkMode();
  const getMyCharacter = useCharacterStore(s => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore(s => s.myDefaultCursorColor);
  const colorRef = useRef('');
  colorRef.current = getMyCharacter()?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDark);

  useEffect(() => {
    let rafHandle: number;

    const renderAt = (x: number, y: number) => {
      const dom = cursorRef.current;
      if (dom) dom.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };

    const showHighlight = (el: HTMLElement | null) => {
      const box = highlightRef.current;
      if (!box) return;
      if (!el) { box.style.opacity = '0'; return; }
      const r = el.getBoundingClientRect();
      box.style.borderColor = colorRef.current;
      box.style.boxShadow = `0 0 8px ${colorRef.current}99, inset 0 0 6px ${colorRef.current}55`;
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
      box.style.opacity = '1';
    };

    const pollOnce = () => {
      // The canvas owns the stick — either driving its own CursorMan ("canvas
      // focus"), or driving the camera because the minimap holds the keys.
      // Stay completely out of the way. Abort any in-flight drag without
      // clicking/snapping, but leave restPosRef alone so this resumes from the
      // same parked spot once the canvas cedes focus.
      //
      // The minimap case has to be named separately, and it is easy to miss why:
      // canvasCursorActive is false there BECAUSE the minimap has the keys (see
      // WantCanvas's canvasFocusedNow), so the one test that used to be enough
      // reads as "nobody is using the stick" at exactly the moment the camera
      // is. Both would then move on one push, and releasing would click whatever
      // the cursor had wandered onto.
      if (isCanvasCursorActive() || isMinimapFocused()) {
        if (posRef.current) {
          posRef.current = null;
          setStickNavSuppressed(false);
          showHighlight(null);
        }
        setVisible(false);
        return;
      }

      if (_pendingWarpEl) {
        const el = _pendingWarpEl;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        // Transition for this one jump only — normal per-frame drag rendering
        // below stays untransitioned so it tracks the stick 1:1 without lag.
        const dom = cursorRef.current;
        // Hold the warp until there is something to move.
        //
        // setVisible is what mounts the overlay, and React has not committed it
        // by the time this same tick tries to position it — so a warp that
        // arrived while the cursor was hidden used to be consumed against a null
        // ref and thrown away. The cursor then appeared at the top-left corner
        // and stayed there until the user pushed the stick, which is exactly the
        // case that matters now: handing a panel the keys warps the cursor into
        // it, and until this the cursor was rarely already on screen when that
        // happened. restPosRef was set either way, so it LOOKED right the moment
        // you moved — which is what made it easy to miss.
        setVisible(true);
        if (!dom) return;   // poll() re-arms; try again once the overlay exists
        _pendingWarpEl = null;
        dom.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1)';
        renderAt(cx, cy);
        showHighlight(el);
        restPosRef.current = { x: cx, y: cy };
        setTimeout(() => { if (dom) dom.style.transition = ''; }, 260);
        setTimeout(() => showHighlight(null), 700);
      }

      const ctrl = getControllerState();
      // Option(Alt)+Arrow is the keyboard equivalent of the left stick — merge
      // it in so this works with no gamepad connected at all. If both are
      // pushed at once (unlikely), they simply add; magnitude clamps below via
      // the per-axis normalization the same way a stick's own diagonal does.
      const optArrow = getOptionArrowVector();
      const lx = (ctrl?.axes[0] ?? 0) + optArrow.x;
      const ly = (ctrl?.axes[1] ?? 0) + optArrow.y;
      const aHeld = ctrl?.buttons[0] ?? false;
      // Plain Space is the keyboard equivalent of gamepad B here (accelerate) —
      // mirrors how Option+Arrow above is the keyboard equivalent of the stick.
      const bHeld = (ctrl?.buttons[1] ?? false) || isSpaceHeld();
      const mag = Math.hypot(lx, ly);

      // Carrying: the cursor holds what was picked up and goes anywhere on the
      // page — out of the panel it came from, which is the point — with A still
      // held or not (the long A that picked it up is usually still down). The
      // thing rides under it and whatever is beneath is told it is being
      // dragged over, as a mouse drag would tell it. Nothing is landed on or
      // clicked; A puts it down (see GlobalFreeCursor).
      if (_carry) {
        const c = _carry;
        if (posRef.current) { posRef.current = null; engagedOnRef.current = null; showHighlight(null); }
        setStickNavSuppressed(true);
        setVisible(true);
        if (mag > DRAG_THRESHOLD) {
          const speed = DRAG_SPEED_PX * mag;
          c.x = Math.max(0, Math.min(window.innerWidth, c.x + (lx / mag) * speed));
          c.y = Math.max(0, Math.min(window.innerHeight, c.y + (ly / mag) * speed));
          edgeScroll(c.x, c.y, 0, window.innerHeight, null);
        }
        renderAt(c.x, c.y);
        c.ghost.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -50%) rotate(-3deg)`;
        const at = `${Math.round(c.x)},${Math.round(c.y)}`;
        if (at !== c.overAt) {
          c.overAt = at;
          const under = document.elementFromPoint(c.x, c.y);
          if (under && !c.source.contains(under)) dragEventAt('dragover', under, c.x, c.y, c.data);
        }
        restPosRef.current = { x: c.x, y: c.y };
        return;
      }

      if (!aHeld && mag > DRAG_THRESHOLD) {
        if (!posRef.current) {
          // Engage: resume from wherever the cursor last parked; otherwise
          // start at whichever item is currently DOM-focused, else viewport
          // center.
          let start = restPosRef.current;
          if (!start) {
            const selected = document.querySelector('[data-keyboard-nav-selected="true"]') as HTMLElement | null;
            const rect = selected?.getBoundingClientRect();
            start = rect
              ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
              : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
          }
          posRef.current = start;
          engagedOnRef.current = currentlyOn();
          setStickNavSuppressed(true);
          setVisible(true);
        }
        const speed = DRAG_SPEED_PX * (bHeld ? 3 : 1) * mag;
        const nlx = lx / mag, nly = ly / mag;
        // Clamp to the viewport, so the cursor can cross from one card grid into
        // another — unless a surface in front of the board holds the keys, in
        // which case clamp to that surface instead. Confining the POSITION and
        // not just the snap is what makes the boundary honest: a cursor allowed
        // to sit outside the panel it belongs to is drawn over content it cannot
        // act on, which reads as the cursor having escaped. See
        // keyHoldingSurface.
        const scope = keyHoldingSurface()?.getBoundingClientRect();
        const minX = scope ? scope.left : 0;
        const maxX = scope ? scope.right : window.innerWidth;
        const minY = scope ? scope.top : 0;
        const maxY = scope ? scope.bottom : window.innerHeight;
        const nx = Math.max(minX, Math.min(maxX, posRef.current.x + nlx * speed));
        const ny = Math.max(minY, Math.min(maxY, posRef.current.y + nly * speed));
        posRef.current = { x: nx, y: ny };
        renderAt(nx, ny);

        // Edge auto-scroll: the cursor itself is viewport-fixed, so approaching
        // an edge on its own would just stop there — scroll whichever
        // scrollable container sits under the cursor instead, so continued
        // stick pressure keeps revealing more content.
        //
        // The edge is that container's own, not the screen's. The cursor is
        // held inside the surface with the keys, and a list in a panel ends
        // wherever the panel's layout ends it — a category grid partway down,
        // a list above an action bar — so a cursor that had to reach the
        // bottom of the SCREEN to scroll could not scroll those at all. For
        // the page itself the container is the screen, so nothing changes
        // there.
        edgeScroll(nx, ny, minY, maxY, keyHoldingSurface());

        const now = performance.now();
        if (now - lastHighlightAtRef.current >= HIGHLIGHT_THROTTLE_MS) {
          lastHighlightAtRef.current = now;
          showHighlight(findNearestTarget(nx, ny));
        }
      } else if (posRef.current) {
        // Stick released (or A pressed, ceding to whatever A+stick does on
        // this page) — click the globally nearest tagged element exactly
        // once, then park there.
        const { x, y } = posRef.current;
        posRef.current = null;
        setStickNavSuppressed(false);
        showHighlight(null);

        const nearest = findNearestTarget(x, y);
        const from = engagedOnRef.current;
        engagedOnRef.current = null;
        if (nearest) {
          // Land the DOM focus too, the way pressing a mouse button does. A
          // dispatched click alone leaves the caret wherever it was, so driving
          // the stick onto a control left the ring's frame drawn around the one
          // you came from — and the next arrow press stepped from there rather
          // than from where you are now.
          if (typeof nearest.focus === 'function') nearest.focus({ preventScroll: true });
          // Landing where you already were is not a press.
          //
          // Releasing clicks what you land on, and that is how the stick picks
          // a card: the click is the pick. But a click on the card you were
          // ALREADY on is a second press, and a second press means something
          // else entirely — the detail panel toggles shut, or the card drills
          // into its own controls. Nudging the stick and coming back (or not
          // reaching the neighbour at all) then did something the user never
          // asked for, which is what "moving between cards sometimes opens or
          // closes the detail" was. A drag that ends where it began now does
          // what it looks like it does: nothing.
          //
          // Nor is landing on a target whose press is an act — see
          // FREE_CURSOR_FOCUS_ONLY_ATTR. It has the focus now; A presses it.
          if (!isSameSpot(from, nearest) && !nearest.hasAttribute(FREE_CURSOR_FOCUS_ONLY_ATTR)) clickTarget(nearest);
          const r = nearest.getBoundingClientRect();
          restPosRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        } else {
          restPosRef.current = { x, y };
        }
        renderAt(restPosRef.current.x, restPosRef.current.y);
      }
    };

    /**
     * Re-arm first, ask questions later.
     *
     * A throw anywhere above used to take the whole cursor with it, because the
     * next frame was only requested by the last statement of the body — the
     * same failure the gamepad poll was fixed for once already (see
     * _pollGamepads, and the regression that guards it in
     * e2e/input-pipeline.spec.mjs). This loop reads the live DOM on every
     * release, so it will always be one odd element away from another one.
     */
    let reportedPollError = false;   // once, not sixty times a second
    const poll = () => {
      try {
        pollOnce();
      } catch (err) {
        if (!reportedPollError) {
          reportedPollError = true;
          console.error('[free-cursor] poll failed (further failures silenced)', err);
        }
      } finally {
        rafHandle = requestAnimationFrame(poll);
      }
    };

    // Tell useInputActions' stick poll, per frame and per axis value, whether
    // this cursor is taking the stick — a mirror of the engage condition
    // below, evaluated on the same numbers. setStickNavSuppressed is still set
    // on engage (it also covers the frames while a drag is in flight), but it
    // is written from this rAF callback and therefore lands a frame late when
    // the stick is flicked straight past the arrow-synthesis deadzone; the
    // probe is what makes the two polls agree regardless of callback order.
    // See setStickOwnerProbe for the full account.
    setStickOwnerProbe((lx, ly, aHeld) => {
      if (_carry) return true;                  // carrying: the stick is ours, A held or not
      if (aHeld) return false;                  // A+stick is the move/warp chord, not ours
      const optArrow = getOptionArrowVector();
      const deflected = Math.hypot(lx + optArrow.x, ly + optArrow.y) > DRAG_THRESHOLD;
      // The camera takes it while the minimap holds the keys. Answered yes here
      // even though this cursor is not the one taking it, because there is one
      // probe slot and the question it asks is "will ANY other mechanism take
      // the stick this frame?" — a no means arrows get synthesized from the same
      // deflection WantCanvas's poll is already reading as a smooth pan, and the
      // view then jumps a quarter screen per synthesized press on top of gliding.
      // That doubling is exactly what "the stick pans in jerks" was.
      if (isMinimapFocused()) return deflected;
      // Canvas CursorMan owns the stick, and does its own arrow handling.
      if (isCanvasCursorActive()) return false;
      return deflected;
    });

    // Mouse-follow: the CursorMan snaps to the real pointer as it moves, so it
    // trails the mouse across list/grid pages the same way it does on external
    // tabs (cursorOverlayCore's mousemove handler). Defers to an in-flight stick
    // drag (posRef set) and to the canvas's own CursorMan; parks at the pointer
    // when the mouse goes idle (restPosRef so a later stick drag resumes there).
    const onMouseMove = (e: MouseEvent) => {
      if (posRef.current || _carry) return;  // a stick drag, or a carry, owns the position
      if (isCanvasCursorActive() || isMinimapFocused()) return;  // the canvas owns movement here
      const dom = cursorRef.current;
      if (dom) dom.style.transition = ''; // instant snap — cancel any warp easing
      restPosRef.current = { x: e.clientX, y: e.clientY };
      setVisible(true);
      renderAt(e.clientX, e.clientY);
    };
    window.addEventListener('mousemove', onMouseMove);

    rafHandle = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafHandle);
      window.removeEventListener('mousemove', onMouseMove);
      setStickOwnerProbe(null);
      if (posRef.current) { posRef.current = null; setStickNavSuppressed(false); }
    };
  }, []);

  return { cursorRef, highlightRef, active: visible };
}
