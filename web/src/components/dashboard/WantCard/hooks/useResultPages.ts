import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ResultHistoryEntry, Want } from '@/types/want';
import { outputEntryKey } from '@/stores/outputFocusStore';
import { useResultPageStore } from '@/stores/resultPageStore';

/**
 * A want card as a small stack of cards: what it answers now, and what it
 * answered before that.
 *
 * A want like smartgolf_check_reserved is asked the same question over and
 * over, and its card shows the latest answer — which is the right thing to
 * show and the wrong thing to be the only thing showable. The question a person
 * actually brings to it once the front of the card is empty ("no reservation")
 * is "so what did it find last time?", and until now that answer existed on the
 * board only as a run of state deltas in a history tab.
 *
 * So the card turns back. Each page is one answer the engine kept
 * (history.resultHistory — shaped there, see engine/core/result_history.go),
 * and this hook hands the card a WANT to draw rather than an answer to
 * interpret: page 0 is the live want, page n is the same want with the state
 * that answer arrived with. The card does not learn anything new — every
 * plugin, every type renderer, the final-result panel, all of it draws a past
 * answer exactly as it draws the present one, because it is being handed the
 * same shape.
 *
 * That is the whole design: the engine shapes, the card displays.
 */

export interface ResultPage {
  /** The want as it should be drawn on this page. */
  want: Want;
  /** False for page 0 — the live want, not a remembered answer. */
  isPast: boolean;
  /**
   * What this page is about, for the pager's label: the answer's own
   * `checked_at` where it has one, else when it was recorded. Absent on page 0,
   * where the card's own header already says how fresh the want is.
   */
  at?: string;
  /**
   * The answer's key (outputEntryKey) — what the board's answer ball for it
   * is named by. Absent on page 0.
   */
  key?: string;
}

export interface ResultPages {
  pages: ResultPage[];
  /** Which page is showing. 0 is now; bigger is further back. */
  page: number;
  /** Turn to a page, clamped. `d` of +1 goes back in time. */
  turn: (d: number) => void;
  /** The page showing, already clamped — what the card should draw. */
  current: ResultPage;
  /**
   * The class the card's face wears mid-deal, or ''. See the
   * `mw-card-turn-*` rules in styles/index.css.
   */
  turnClass: string;
}

/**
 * How long each half of a deal takes. Matched to the CSS, and deliberately
 * short: this is a card being handled, not a transition being admired, and the
 * answer underneath is what somebody is waiting for.
 */
const TURN_OUT_MS = 150;
const TURN_IN_MS = 170;

/** Same answer, as far as a reader is concerned. */
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/**
 * The want as it stood when one remembered answer arrived.
 *
 * `current` is REPLACED rather than merged, which is the point of a history:
 * the fields a run did not write are not part of what it found, and merging
 * them in from the live want is how the first attempt at this ended up showing
 * four cards that all claimed the same reservation — the one only the oldest of
 * them had actually seen.
 *
 * `goal` and the rest of the state are kept: they are the standing request,
 * which has not changed and is what makes the page legible as this want's card
 * rather than a loose scrap of JSON.
 */
const asWant = (want: Want, entry: ResultHistoryEntry): Want => {
  const current: Record<string, unknown> = { ...(entry.fields ?? {}) };
  // The answer's own field goes back where the card reads it. The engine keeps
  // it as the entry's `result` and leaves it out of `fields` (printed twice it
  // read as two findings), so a card that draws from its source field — a
  // player's `track_name` — found it empty on every past page and drew
  // "nothing playing" instead of the song. A dotted finalResultField is a path
  // into some object, not a field of its own, and is left alone.
  const resultField = want.spec?.finalResultField;
  if (resultField && !resultField.includes('.') && !(resultField in current)) {
    current[resultField] = entry.result;
  }
  return {
    ...want,
    state: {
      ...want.state,
      final_result: entry.result,
      current,
    },
  };
};

export function useResultPages(want: Want): ResultPages {
  const history = want.history?.resultHistory;
  const live = want.state?.final_result;

  const pages = useMemo<ResultPage[]>(() => {
    const now: ResultPage = { want, isPast: false };
    // Newest first, and each page a different answer from the one in front of
    // it — so "turn back" always means "something else".
    //
    // The newest kept answer is usually the one the card is already showing:
    // the engine recorded it the cycle it arrived. And the engine keeps a new
    // entry whenever an answer's supporting fields move, not only its result —
    // the same song once more with its artist now known, the same reservation
    // with and without the full list beside it. Those are better-described
    // copies of one answer, and as pages they are the same card twice. The
    // newest copy is kept, because it is the most completely described.
    const entries: ResultHistoryEntry[] = [];
    let ahead: unknown = live;
    for (const e of [...(history ?? [])].reverse()) {
      if (same(e.result, ahead)) continue;
      entries.push(e);
      ahead = e.result;
    }
    return [
      now,
      ...entries.map(e => ({
        want: asWant(want, e),
        isPast: true,
        at: e.about || e.timestamp,
        key: outputEntryKey(e),
      })),
    ];
  }, [want, history, live]);

  // Held, not derived: the want is refetched every few seconds by the poll, and
  // a page number derived from it would snap back to the front of the stack
  // mid-read. Clamped below instead of on set, because a new answer arriving
  // while you are three pages back must not leave you off the end.
  const [page, setPage] = useState(0);
  const at = Math.min(page, pages.length - 1);

  /**
   * The deal itself, in two halves.
   *
   * A page swap on its own read as a slideshow — the same card showing
   * different words — and a flip read as this card's other side rather than as
   * the next card. So the top face is pushed off the deck and the one under it
   * rises into place, which is how a hand of cards is actually handled.
   *
   * Only one answer is ever mounted, which is what makes the two-step
   * necessary rather than decorative: a real deal has both cards on screen,
   * and for a want card a face is a live plugin tree. The page is swapped in
   * the gap, where the outgoing card is already out of frame.
   */
  const [turn, setTurn] = useState<{ dir: number; phase: 'out' | 'in' } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Where the turn starts from, read outside the state updater: scheduling
  // timers inside one would fire them twice under StrictMode's double
  // invocation, and a page turn is not idempotent.
  const atRef = useRef(at);
  atRef.current = at;

  /** Deal `d` pages; the page dealt to, or null when there was no deal. */
  const turnTo = useCallback((d: number): number | null => {
    const last = pages.length - 1;
    const from = Math.min(atRef.current, last);
    const to = Math.min(Math.max(0, from + d), last);
    // Nothing behind or in front: no deal, and no animation of one either —
    // a card dealt off that lands on the same answer says the stack moved when
    // it did not.
    if (to === from) return null;
    // One deal at a time. A held key repeats faster than the pair of
    // animations, and starting a second deal mid-way left the face stuck
    // off-frame where the first had pushed it.
    if (timers.current.length > 0) return null;
    setTurn({ dir: d, phase: 'out' });
    timers.current = [
      window.setTimeout(() => {
        setPage(to);
        setTurn({ dir: d, phase: 'in' });
      }, TURN_OUT_MS),
      window.setTimeout(() => {
        setTurn(null);
        timers.current = [];
      }, TURN_OUT_MS + TURN_IN_MS),
    ];
    return to;
  }, [pages.length]);

  // In step with the board's answer balls (resultPageStore): say which past
  // answer this card is turned back to, so its ball lights; and turn to the
  // answer a ball asks for when it is tapped. A want's cards — the float
  // card, the panel's — turn together, so its board shows one answer lit.
  const cardId = useId();
  const wantId = want.metadata?.id || want.id || '';
  const shownKey = pages[at]?.isPast ? pages[at].key : undefined;
  useEffect(() => {
    useResultPageStore.getState().setShown(cardId, wantId && shownKey ? { wantId, key: shownKey } : null);
  }, [cardId, wantId, shownKey]);
  useEffect(() => () => useResultPageStore.getState().setShown(cardId, null), [cardId]);

  const request = useResultPageStore(s => s.request);
  const heard = useRef(0);
  useEffect(() => {
    if (!request || request.version === heard.current || request.wantId !== wantId) return;
    // A card opened by the tap itself still hears it; one opened later does not.
    if (Date.now() - request.at > 2000) return;
    heard.current = request.version;
    let to = request.key === null ? 0 : pages.findIndex(p => p.key === request.key);
    if (to < 0) {
      // Not a page of its own: a copy of the answer in front of it (see the
      // dedupe above), so the page showing that same answer.
      const entry = (history ?? []).find(e => outputEntryKey(e) === request.key);
      if (!entry) return;
      to = pages.findIndex(p => same(p.want.state?.final_result, entry.result));
      if (to < 0) return;
    }
    turnTo(to - atRef.current);
  }, [request, wantId, pages, history, turnTo]);

  // Turned by hand (the pager, a swipe): the want's other cards follow — not
  // this one, which is already dealing.
  const turnByHand = useCallback((d: number) => {
    const to = turnTo(d);
    if (to === null || !wantId) return;
    const store = useResultPageStore.getState();
    store.turnTo(wantId, pages[to]?.isPast ? pages[to].key ?? null : null);
    heard.current = store.request?.version ?? heard.current;
  }, [turnTo, wantId, pages]);

  return {
    pages,
    page: at,
    turn: turnByHand,
    current: pages[at],
    // 'next' is the deal — the card you are leaving goes off to the left —
    // and it belongs to the RIGHT-hand press, which is the one that advances.
    // Going deeper into the deck (dir > 0, further back in time) is the same
    // motion run backwards. See the note on these classes in styles/index.css.
    turnClass: turn
      ? `mw-card-turn mw-card-turn-${turn.dir > 0 ? 'prev' : 'next'}-${turn.phase}`
      : '',
  };
}
