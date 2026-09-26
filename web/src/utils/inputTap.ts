/**
 * A running record of who answered each press. Off by default; switch it on
 * from the console when something is going to the wrong place.
 *
 * Three separate mechanisms decide where an input event goes — the capture
 * stack's `_keyOwner` (which widget), `canvasActorStack` (which actor on the
 * board), and `focusOwner` (which surface) — and each is correct on its own.
 * What has no home is the moment two of them disagree, which is where the bugs
 * live: a prompt that had deregistered itself by the time a keyup arrived, a
 * held-state tracker that never saw a release, a letter two components both
 * answered. None of those show up in the DOM or in React DevTools, and finding
 * the last one took three rounds of adding a temporary trace, rebuilding,
 * reproducing by hand, and reading a stack out of a minified bundle.
 *
 * Deliberately NOT compiled out of production. `make gui-restart` builds the
 * binary with `npm run build`, so anything behind `import.meta.env.DEV` would
 * be absent from every build anyone actually runs — which is exactly when the
 * bugs turn up. The cost of being present is one boolean test per key while
 * off; recording only starts when someone asks for it.
 *
 * From the console:
 *   __inputTap.on()        start recording (remembered across reloads)
 *   __inputTap()           print what has been recorded, oldest first
 *   __inputTap('Enter')    ...only rows for that key, kind, or actor
 *   __inputTap.off()       stop, and forget
 */

export interface InputTapEntry {
  /** Milliseconds since page load, rounded — enough to see a keydown/keyup pair. */
  t: number;
  /** 'keydown' | 'keyup' | 'gamepad' | 'canvas-action' */
  kind: string;
  /** The key, button or action name. */
  name: string;
  /** Free-form detail: the target's tag, the winning actor, the claim state. */
  detail?: string;
}

const CAPACITY = 300;
const STORAGE_KEY = 'mywant.inputTap';

/**
 * Storage can throw outright, not just come back empty — a private window, a
 * browser set to block site data. A debugging aid must never be the reason a
 * page fails to start.
 */
function readStoredFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let enabled = typeof window !== 'undefined' && readStoredFlag();

const ring: InputTapEntry[] = [];
let next = 0;

/** Note one input event. A single boolean test when the tap is off. */
export function record(kind: string, name: string, detail?: string): void {
  if (!enabled) return;
  const entry: InputTapEntry = { t: Math.round(performance.now()), kind, name, detail };
  // A fixed-size ring rather than a growing array: this runs on every key of
  // every press for as long as the tap is on, and a leak in the debugging tool
  // would be a worse bug than the ones it exists to find.
  if (ring.length < CAPACITY) ring.push(entry);
  else ring[next] = entry;
  next = (next + 1) % CAPACITY;
}

/** Oldest first, so it reads top-to-bottom like a log. */
export function readInputTap(filter?: string): InputTapEntry[] {
  const ordered = ring.length < CAPACITY
    ? ring.slice()
    : ring.slice(next).concat(ring.slice(0, next));
  if (!filter) return ordered;
  const needle = filter.toLowerCase();
  return ordered.filter(e =>
    e.name.toLowerCase() === needle
    || e.kind.toLowerCase() === needle
    || !!e.detail?.toLowerCase().includes(needle));
}

function setEnabled(on: boolean): void {
  enabled = on;
  try {
    if (on) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisting is survivable; the flag still holds for this page.
  }
  if (!on) { ring.length = 0; next = 0; }
}

if (typeof window !== 'undefined') {
  const tap = (filter?: string) => {
    const rows = readInputTap(filter);
    if (!enabled && rows.length === 0) {
      console.log('[inputTap] off — run __inputTap.on(), reproduce, then __inputTap() again');
      return rows;
    }
    // console.table is the point: one row per event, columns lined up, and the
    // whole press readable without expanding anything.
    console.table(rows);
    return rows;
  };
  tap.on = () => { setEnabled(true); console.log('[inputTap] recording'); };
  tap.off = () => { setEnabled(false); console.log('[inputTap] off'); };
  (window as unknown as Record<string, unknown>).__inputTap = tap;
}
