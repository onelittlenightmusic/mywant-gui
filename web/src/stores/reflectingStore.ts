import { create } from 'zustand';

/**
 * A change the server has taken that this page has not shown yet.
 *
 * Over a slow line the gap between "the server said yes" and "the board shows
 * it" can be seconds — the board is read back by the next poll, and that read
 * has to come down the same thin pipe. With nothing on screen in between, the
 * press looks as though it did nothing.
 *
 * So: a write that succeeded is noted here — by the response (client.ts), or
 * by a framing app that wrote on its own (window.__mywantHost.sent) — and it
 * stays noted until a read that BEGAN after it has been applied: the wants by
 * wantHashCache / fetchWants, the things by their list (client.ts). A read that
 * began earlier may have missed it, so it does not count. ReflectingIndicator
 * shows the gap.
 */

/** What a write changed, and so which read brings it back. */
export type BoardPart = 'wants' | 'things';
const PARTS: BoardPart[] = ['wants', 'things'];

/** Past this, stop saying it: a read that never comes is not worth a forever mark. */
const GIVE_UP_MS = 60_000;

interface ReflectingState {
  /** When the newest write not read back yet succeeded, per part (0: none). */
  sentAt: Record<BoardPart, number>;
  /** How many places better placed than the corner are saying it now — the
   *  board, beside the character (mywant-guiex). See claimReflecting. */
  claims: number;
  sent: (parts: BoardPart[]) => void;
  /** A read of `part` that began at `startedAt` has been applied. */
  synced: (part: BoardPart, startedAt: number) => void;
}

let giveUp: ReturnType<typeof setTimeout> | null = null;

export const useReflectingStore = create<ReflectingState>((set, get) => ({
  sentAt: { wants: 0, things: 0 },
  claims: 0,
  sent: (parts) => {
    if (parts.length === 0) return;
    const now = Date.now();
    const next = { ...get().sentAt };
    for (const p of parts) next[p] = now;
    set({ sentAt: next });
    if (giveUp) clearTimeout(giveUp);
    giveUp = setTimeout(() => { giveUp = null; set({ sentAt: { wants: 0, things: 0 } }); }, GIVE_UP_MS);
  },
  synced: (part, startedAt) => {
    const { sentAt } = get();
    if (sentAt[part] === 0 || startedAt < sentAt[part]) return;
    const next = { ...sentAt, [part]: 0 };
    if (PARTS.every(p => next[p] === 0) && giveUp) { clearTimeout(giveUp); giveUp = null; }
    set({ sentAt: next });
  },
}));

/**
 * Say it somewhere else than the corner — beside the character, on the board.
 * While held, ReflectingIndicator draws nothing. Returns the release.
 */
export function claimReflecting(): () => void {
  useReflectingStore.setState(s => ({ claims: s.claims + 1 }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useReflectingStore.setState(s => ({ claims: s.claims - 1 }));
  };
}

export function isReflecting(sentAt: Record<BoardPart, number>): boolean {
  return PARTS.some(p => sentAt[p] !== 0);
}

function pathOf(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?/, '/').split('?')[0];
}

/**
 * Which parts of the board a write changes: the wants and their state, the
 * things, or a capture (both). Settings, the cursor's whereabouts, a chat
 * marked read and the like are not on the board.
 */
export function boardPartsWritten(method: string | undefined, url: string | undefined): BoardPart[] {
  const m = (method ?? 'get').toLowerCase();
  if (m === 'get' || m === 'head' || m === 'options' || !url) return [];
  const path = pathOf(url);
  // A message to a want, or a chat marked read: nothing on the board moves.
  if (/^\/api\/v1\/wants\/[^/]+\/(notify|notifications)(\/|$)/.test(path)) return [];
  if (/^\/api\/v1\/(wants|states|riff\/deploy)(\/|$)/.test(path)) return ['wants'];
  if (/^\/api\/v1\/things(\/|$)/.test(path)) return ['things'];
  if (/^\/api\/v1\/capture(\/|$)/.test(path)) return ['wants', 'things'];
  return [];
}

/** The read that brings a part back, when a GET is one. */
export function boardPartRead(method: string | undefined, url: string | undefined): BoardPart | null {
  if ((method ?? 'get').toLowerCase() !== 'get' || !url) return null;
  return pathOf(url) === '/api/v1/things' ? 'things' : null;
}

// A framing app (lib/nativeHost) that wrote to the server itself — the robot
// adding a want, a capture — says so here, and the page waits for it the same.
if (typeof window !== 'undefined' && window.__mywantHost) {
  window.__mywantHost.sent = (parts?: BoardPart[]) =>
    useReflectingStore.getState().sent(parts && parts.length ? parts : PARTS);
}
