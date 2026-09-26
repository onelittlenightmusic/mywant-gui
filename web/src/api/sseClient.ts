/**
 * Singleton SSE client for /api/v1/events.
 *
 * EventSource auto-reconnects on network interruptions. All event-type
 * listeners are re-registered when the connection is re-created (e.g. after a
 * permanent CLOSED state caused by a server restart).
 *
 * Usage:
 *   const unsub = subscribeSSE<RemoteCursor[]>('cursor', (cursors) => { ... });
 *   // later:
 *   unsub();
 */

type Handler<T = unknown> = (data: T) => void;

const handlerSets = new Map<string, Set<Handler>>();
const attachedTypes = new Set<string>();
let es: EventSource | null = null;

function makeListener(type: string): EventListener {
  return (e: Event) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      handlerSets.get(type)?.forEach((h) => h(data));
    } catch {
      // ignore malformed JSON
    }
  };
}

// Listeners keyed by type so we can re-attach them on reconnect.
const listeners = new Map<string, EventListener>();

function attachType(type: string, target: EventSource) {
  if (attachedTypes.has(type)) return;
  attachedTypes.add(type);
  const listener = makeListener(type);
  listeners.set(type, listener);
  target.addEventListener(type, listener);
}

/**
 * Called when a stream comes up, so whoever reads from it can catch up.
 *
 * The app used to poll everything on a timer as well as listening here, which
 * is what a stream is for and so was pure duplication — but the timer was also
 * doing a second job nobody had named: covering the gap when the stream drops.
 * A dropped stream loses the events sent while it was down, and no amount of
 * listening gets those back.
 *
 * So the recovery is explicit and happens once per reconnection, rather than
 * every second forever on the off-chance.
 */
import { flushOutbox } from './outbox';

const reconnectHandlers = new Set<() => void>();
let hasConnectedOnce = false;


export function onSSEReconnect(fn: () => void): () => void {
  reconnectHandlers.add(fn);
  return () => { reconnectHandlers.delete(fn); };
}

function connect() {
  const newEs = new EventSource('/api/v1/events');
  es = newEs;
  attachedTypes.clear();

  newEs.onopen = () => {
    // Not on the first connection: whoever subscribed has just loaded its own
    // data, and catching up on nothing costs a round of requests per listener.
    if (hasConnectedOnce) {
      // Catching up runs both ways. Anything the outbox is still holding was
      // almost certainly refused because of the same outage this stream is
      // recovering from, and its backoff may have grown to half a minute —
      // which is plainly the wrong thing to wait out at the moment the
      // connection demonstrably works again.
      flushOutbox();
      reconnectHandlers.forEach(fn => fn());
    }
    hasConnectedOnce = true;
  };

  // Re-attach any types already subscribed (handles reconnect after CLOSED).
  for (const type of handlerSets.keys()) {
    attachType(type, newEs);
  }

  newEs.onerror = () => {
    // EventSource handles transient failures automatically.
    // Only re-create when the connection is permanently CLOSED (e.g. server restart).
    if (newEs.readyState === EventSource.CLOSED) {
      es = null;
      setTimeout(connect, 3000);
    }
  };
}

function ensureConnected() {
  if (!es || es.readyState === EventSource.CLOSED) {
    connect();
  }
}

/**
 * Subscribe to a named SSE event. Returns an unsubscribe function.
 */
export function subscribeSSE<T = unknown>(
  type: string,
  handler: Handler<T>,
): () => void {
  if (!handlerSets.has(type)) {
    handlerSets.set(type, new Set());
  }
  handlerSets.get(type)!.add(handler as Handler);

  ensureConnected();
  if (es) attachType(type, es);

  return () => {
    handlerSets.get(type)?.delete(handler as Handler);
  };
}
