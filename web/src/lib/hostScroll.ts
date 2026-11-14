/**
 * A scrolling box moved by script — on a spring toward a place that may keep
 * moving, or over a set time — done where it is done best.
 *
 * In a page framed by the app (iOS, a Mac), the app moves it: WebKit draws
 * every scrolling box as a scroll view of its own, and the app moves that one
 * on the screen's own clock, as a finger does (the app's HostScroll). A frame
 * the page is too busy to run does not stop it, and the scroll is the only
 * thing that moves — so there is nothing to keep in step with it. Anywhere
 * else the page moves it itself, a frame at a time.
 *
 * Only for a box moved by script frame after frame (the board's camera). A
 * single scroll somewhere — scrollIntoView, scrollTo({ behavior: 'smooth' }) —
 * is already the browser's own (WebKit plays it natively) and needs none of
 * this.
 *
 * While a move is under way the box's scrolling is that move's
 * (scrollDriving), not a hand's. A finger taking it ends the move there.
 */

import { dampedSpring, nativeHost, postToHost, springStep } from './nativeHost';

export type ScrollMoveKind = 'spring' | 'journey';
export interface ScrollMove { op: ScrollMoveKind; tx: number; ty: number }

/** The app moves scrolling boxes here (until it says it cannot). */
let byApp = nativeHost && typeof window !== 'undefined' && !!window.__mywantHost?.scrollDrive;

interface Box {
  id: string;
  el: HTMLElement;
  move: ScrollMove | null;
  // The page's own driver (not framed by the app).
  x: number; y: number; vx: number; vy: number;
  omega: number; zeta: number;
  from: { x: number; y: number }; start: number; ms: number;
}

const boxes = new Map<string, Box>();
const ids = new WeakMap<HTMLElement, string>();
let nextId = 1;

function boxOf(el: HTMLElement): Box {
  let id = ids.get(el);
  if (!id) { id = `s${nextId++}`; ids.set(el, id); }
  let b = boxes.get(id);
  if (!b) {
    b = { id, el, move: null, x: 0, y: 0, vx: 0, vy: 0, omega: 0, zeta: 1, from: { x: 0, y: 0 }, start: 0, ms: 0 };
    boxes.set(id, b);
  }
  return b;
}

if (byApp && window.__mywantHost) {
  window.__mywantHost.scroll = (id, state) => {
    const b = boxes.get(id);
    if (b) b.move = null;
    // No scroll view of that box there: the page moves them all itself.
    if (state === 'unavailable') byApp = false;
  };
}

/** Whether the app moves the boxes here (rather than this page). */
export function scrollByApp(): boolean { return byApp; }

/** Whether a move of this box is under way. */
export function scrollDriving(el: HTMLElement | null): boolean {
  if (!el) return false;
  const id = ids.get(el);
  return !!id && !!boxes.get(id)?.move;
}

/** The move of this box under way, if any. */
export function scrollMove(el: HTMLElement): ScrollMove | null {
  const id = ids.get(el);
  return id ? boxes.get(id)?.move ?? null : null;
}

/** What the app finds the box by: where it is in the window and how much it scrolls. */
function where(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: el.clientWidth, h: el.clientHeight, sw: el.scrollWidth, sh: el.scrollHeight };
}

function clampTo(el: HTMLElement, tx: number, ty: number) {
  return {
    tx: Math.max(0, Math.min(el.scrollWidth - el.clientWidth, tx)),
    ty: Math.max(0, Math.min(el.scrollHeight - el.clientHeight, ty)),
  };
}

/**
 * Toward (tx, ty) on a spring (rad/s, damped `zeta` ≥ 1 — never past it).
 * Asked again with a new place, it bends from the speed it has.
 */
export function scrollSpring(el: HTMLElement, tx0: number, ty0: number, omega: number, zeta: number): void {
  const { tx, ty } = clampTo(el, tx0, ty0);
  const b = boxOf(el);
  const was = b.move;
  b.move = { op: 'spring', tx, ty };
  if (byApp) {
    postToHost({ type: 'scroll', op: 'spring', id: b.id, tx, ty, omega, zeta, ...where(el) });
    return;
  }
  if (!was) { b.x = el.scrollLeft; b.y = el.scrollTop; b.vx = 0; b.vy = 0; }
  b.omega = omega; b.zeta = zeta;
  run();
}

/** To (tx, ty) over `ms`, eased out of rest and into it. */
export function scrollJourney(el: HTMLElement, tx0: number, ty0: number, ms: number): void {
  const { tx, ty } = clampTo(el, tx0, ty0);
  const b = boxOf(el);
  const was = b.move;
  b.move = { op: 'journey', tx, ty };
  if (byApp) {
    postToHost({ type: 'scroll', op: 'journey', id: b.id, tx, ty, ms, ...where(el) });
    return;
  }
  if (!was) { b.x = el.scrollLeft; b.y = el.scrollTop; }
  b.from = { x: b.x, y: b.y };
  b.start = performance.now();
  b.ms = Math.max(1, ms);
  run();
}

/** Leave the box where it has got to. */
export function scrollStop(el: HTMLElement | null): void {
  if (!el) return;
  const id = ids.get(el);
  const b = id ? boxes.get(id) : undefined;
  if (!b?.move) return;
  b.move = null;
  if (byApp) postToHost({ type: 'scroll', op: 'stop', id: b.id });
}

// ── The page's own driver ────────────────────────────────────────────────────

let raf: number | null = null;
let lastT = -1;

function run(): void {
  if (raf !== null) return;
  lastT = -1;
  raf = requestAnimationFrame(frame);
}

const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function frame(t: number): void {
  raf = null;
  const dt = lastT < 0 ? 1 / 60 : Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  let any = false;
  for (const b of boxes.values()) {
    const m = b.move;
    if (!m) continue;
    if (!b.el.isConnected) { b.move = null; continue; }
    // Moved by someone else since (a hand): theirs now.
    if (Math.abs(b.el.scrollLeft - b.x) > 1.5 || Math.abs(b.el.scrollTop - b.y) > 1.5) { b.move = null; continue; }
    if (m.op === 'spring') {
      const step = (x: number, v: number, to: number) => {
        const s = b.zeta > 1 ? dampedSpring(x - to, v, b.omega, b.zeta, dt) : springStep(x - to, v, b.omega, dt);
        return { x: to + s.x, v: s.v };
      };
      const sx = step(b.x, b.vx, m.tx), sy = step(b.y, b.vy, m.ty);
      b.x = sx.x; b.vx = sx.v; b.y = sy.x; b.vy = sy.v;
      if (Math.abs(b.x - m.tx) < 0.3 && Math.abs(b.y - m.ty) < 0.3 && Math.abs(b.vx) < 3 && Math.abs(b.vy) < 3) {
        b.x = m.tx; b.y = m.ty; b.vx = 0; b.vy = 0; b.move = null;
      }
    } else {
      const p = Math.min(1, (performance.now() - b.start) / b.ms);
      const e = ease(p);
      const nx = b.from.x + (m.tx - b.from.x) * e, ny = b.from.y + (m.ty - b.from.y) * e;
      if (dt > 0) { b.vx = (nx - b.x) / dt; b.vy = (ny - b.y) / dt; }
      b.x = nx; b.y = ny;
      if (p >= 1) { b.vx = 0; b.vy = 0; b.move = null; }
    }
    b.el.scrollLeft = b.x;
    b.el.scrollTop = b.y;
    // What the scroller made of it (it may round).
    b.x = Math.abs(b.el.scrollLeft - b.x) <= 1.5 ? b.x : b.el.scrollLeft;
    b.y = Math.abs(b.el.scrollTop - b.y) <= 1.5 ? b.y : b.el.scrollTop;
    if (b.move) any = true;
  }
  if (any) raf = requestAnimationFrame(frame);
}
