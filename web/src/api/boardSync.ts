import { useEffect, useRef } from 'react';
import { subscribeSSE, onSSEReconnect } from './sseClient';

/**
 * What changed on the board — the one place the page hears it.
 *
 * The server says it as one event, `board_changed` (engine board_changed.go):
 * the wants and the things that changed, a want's change carrying the things
 * it names, a burst sent as one. Everyone who needs to know listens here
 * rather than to the stream: the want list, an open want's panel, the thing
 * records, the board's tiles.
 *
 * A stream that dropped and came back has missed whatever was said in
 * between, so its return is told as `all` — everyone catches up, once.
 *
 * An older server says it as two events, `want_changed` (an id list) and
 * `thing_changed` (one id); those are heard here too and told the same way.
 */
export interface BoardChange {
  wants: string[];
  things: string[];
  /** Everything may have changed: a world opened, the stream came back. */
  all: boolean;
}

type Listener = (change: BoardChange) => void;

const listeners = new Set<Listener>();
let attached = false;

/**
 * At most one telling every TELL_EVERY_MS. A change after a quiet spell is
 * told at once; those that follow within it are gathered — their wants and
 * things together — and told as one when it is up.
 *
 * Every telling sets the page asking again (the want list's hashes, the
 * labels, what needs a person, the thing records), and changes come in
 * bursts: the board's own view written back (a zoom, a step, a panel opened)
 * is a change to the gui_state want, and each one sent the page asking for
 * all of it again — in the frames a zoom was being drawn in.
 */
const TELL_EVERY_MS = 500;
let lastTold = 0;
let gathered: BoardChange | null = null;
let gatherTimer: ReturnType<typeof setTimeout> | null = null;

function tellNow(change: BoardChange) {
  lastTold = Date.now();
  listeners.forEach((fn) => {
    try { fn(change); } catch (e) { console.error('[boardSync]', e); }
  });
}

function tell(change: BoardChange) {
  const since = Date.now() - lastTold;
  if (!gatherTimer && since >= TELL_EVERY_MS) { tellNow(change); return; }
  gathered = gathered
    ? {
        wants: [...new Set([...gathered.wants, ...change.wants])],
        things: [...new Set([...gathered.things, ...change.things])],
        all: gathered.all || change.all,
      }
    : change;
  if (!gatherTimer) {
    gatherTimer = setTimeout(() => {
      gatherTimer = null;
      const c = gathered;
      gathered = null;
      if (c) tellNow(c);
    }, Math.max(0, TELL_EVERY_MS - since));
  }
}

function attach() {
  if (attached) return;
  attached = true;
  subscribeSSE<{ wants?: string[]; things?: string[]; all?: boolean }>('board_changed', (d) => {
    tell({ wants: d?.wants ?? [], things: d?.things ?? [], all: !!d?.all });
  });
  // An older server.
  subscribeSSE<string[] | string>('want_changed', (ids) => {
    tell({ wants: Array.isArray(ids) ? ids : ids ? [ids] : [], things: [], all: false });
  });
  subscribeSSE<string>('thing_changed', (id) => {
    tell({ wants: [], things: id ? [String(id)] : [], all: false });
  });
  onSSEReconnect(() => tell({ wants: [], things: [], all: true }));
}

/** Hear what changed on the board. Returns the way to stop. */
export function onBoardChanged(fn: Listener): () => void {
  attach();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** onBoardChanged for a component, always calling its latest handler. */
export function useBoardChanged(fn: Listener): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => onBoardChanged((c) => ref.current(c)), []);
}

/** Whether a change touches any of these wants (or everything). */
export function touchesWants(c: BoardChange): boolean {
  return c.all || c.wants.length > 0;
}

/** Whether a change touches any thing (or everything). */
export function touchesThings(c: BoardChange): boolean {
  return c.all || c.things.length > 0;
}
