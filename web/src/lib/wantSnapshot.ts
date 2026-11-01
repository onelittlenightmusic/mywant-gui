/**
 * The wants as last seen, kept in this browser (IndexedDB) so a page that
 * starts again draws them at once and the server's answer replaces them when
 * it comes — instead of an empty board until it does.
 *
 * A page starts again more often than it looks: iOS takes a backgrounded
 * app's web view away, and coming back loads the GUI afresh — on fly the
 * want list is ~2MB, and over a slow line the board stayed empty for seconds
 * (mywant-ios, 2026-11-02). Each server has its own origin, so its own copy.
 *
 * Only for drawing: nothing is sent from it, and the store's first real fetch
 * (fetchWants) takes over as before.
 */
import type { Want } from '@/types/want';

const DB = 'mywant-cache';
const STORE = 'kv';
const KEY = 'wants';
const SAVE_AFTER_MS = 4000;

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null); // no IndexedDB (a private window): nothing kept
    }
  });
}

/** The wants as last kept, or null. */
export async function loadWantSnapshot(): Promise<Want[] | null> {
  const db = await open();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as Want[]) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let pending: Want[] | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Keep these wants, a few seconds on — the latest of a burst of changes, once. */
export function saveWantSnapshot(wants: Want[]): void {
  pending = wants;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const wants = pending;
    pending = null;
    if (!wants) return;
    void open().then(db => {
      if (!db) return;
      try {
        db.transaction(STORE, 'readwrite').objectStore(STORE).put(wants, KEY);
      } catch {
        // too big for this browser, or a want it cannot clone: drawn from the server only
      }
    });
  }, SAVE_AFTER_MS);
}
