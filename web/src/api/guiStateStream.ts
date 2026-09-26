/**
 * guiStateStream — gui_state snapshots delivered by SSE *and* by polling.
 *
 * Same rationale as cursorStream.ts: an SSE-only consumer goes permanently
 * silent behind a reverse proxy that buffers streaming responses, because the
 * EventSource stays OPEN and simply never fires (so sseClient's CLOSED-only
 * reconnect never triggers either).
 *
 * Dashboard already polls gui_state, but only for its own state restoration —
 * that polling isn't shared, so every other `useSSEEvent('gui_state')` consumer
 * was still SSE-only. For character interaction that meant Call invites never
 * arriving and Ride state never propagating on a proxied connection.
 *
 * The endpoint is ETag-conditional, so an idle dashboard costs one 304 per
 * interval.
 */
import { apiClient } from './client';
import { subscribeSSE } from './sseClient';

export interface GUIStateSnapshot {
  seq: number;
  state: Record<string, unknown>;
}

type Listener = (snapshot: GUIStateSnapshot) => void;

const listeners = new Set<Listener>();

let unsubscribeSSE: (() => void) | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastETag: string | undefined;
let lastSeq = -1;

/**
 * Slower than cursorStream's: gui_state carries discrete events (a call invite,
 * a mount/dismount) rather than continuous motion, so bounded staleness of a
 * few seconds is fine and the payload is larger.
 */
const POLL_MS = 3000;

function emit(snapshot: GUIStateSnapshot): void {
  // seq is monotonic per write, so it's a cheaper and more reliable
  // change-check than serializing the whole state blob.
  if (snapshot.seq === lastSeq) return;
  lastSeq = snapshot.seq;
  for (const l of listeners) l(snapshot);
}

async function pollOnce(): Promise<void> {
  try {
    const { data, etag } = await apiClient.getGUIStateConditional(lastETag);
    if (etag) lastETag = etag;
    if (data !== null) emit(data);
  } catch {
    // Transient failure — the next tick retries.
  }
}

function start(): void {
  if (unsubscribeSSE) return;
  unsubscribeSSE = subscribeSSE<GUIStateSnapshot>('gui_state', (snapshot) => {
    // An SSE frame is fresher than any pending poll; drop the ETag so the next
    // poll can't 304 us back onto a stale snapshot.
    lastETag = undefined;
    emit(snapshot);
  });
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_MS);
}

function stop(): void {
  unsubscribeSSE?.();
  unsubscribeSSE = null;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  lastETag = undefined;
  lastSeq = -1;
}

/**
 * Subscribe to gui_state snapshots. The SSE subscription and poll loop run only
 * while at least one subscriber is attached.
 */
export function subscribeGUIState(listener: Listener): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}
