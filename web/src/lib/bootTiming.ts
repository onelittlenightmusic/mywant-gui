/**
 * How this page's start went, moment by moment, for the app that frames it
 * (mywant-ios) — which adds its own (the process started, the web view made,
 * the page loaded) and writes it all to its device log in one line, as time
 * since the app started (gui.boot). Imported first (main.tsx), so its own
 * evaluation is when the page's script began.
 *
 * Wall-clock times (Date.now()), as the app's are: the two add up.
 * Nothing is sent without an app (nativeHost), and once per page.
 */
import { nativeHost, postToHost } from '@/lib/nativeHost';

const marks: Record<string, number> = { script: Date.now() };
const details: Record<string, string | number> = {};
let sent = false;

/** A moment of the start, the first time it happens; what it was, if anything. */
export function bootMark(name: string, detail?: string | number): void {
  if (sent || marks[name] !== undefined) return;
  marks[name] = Date.now();
  if (detail !== undefined) details[name] = detail;
}

/** The moment once the frame after it is drawn — when the board is on screen. */
export function bootMarkDrawn(name: string, detail?: string | number): void {
  if (sent || marks[name] !== undefined) return;
  requestAnimationFrame(() => requestAnimationFrame(() => bootMark(name, detail)));
}

/** Hands the start to the app, once: when the server's wants are drawn, or
 *  after a while without them. */
export function sendBootTiming(): void {
  if (sent || !nativeHost) return;
  sent = true;
  // The page's own script, and whether it came from the cache.
  const bundle = performance.getEntriesByType('resource')
    .find(e => /\/assets\/index-[^/]+\.js$/.test(e.name)) as PerformanceResourceTiming | undefined;
  if (bundle) {
    details.bundle = `${Math.round(bundle.duration)}ms ${bundle.transferSize === 0 ? 'cached' : `${Math.round(bundle.transferSize / 1024)}KB`}`;
  }
  postToHost({ type: 'boot-timing', navigation: Math.round(performance.timeOrigin), marks, details });
}

setTimeout(() => {
  bootMark('gave-up-waiting');
  sendBootTiming();
}, 20000);
