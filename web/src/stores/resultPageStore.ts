import { create } from 'zustand';

/**
 * Which of a want's answers is in focus — the one place that says it.
 *
 * Every way of moving through a want's answers writes here, and only here: a
 * card turned by hand (a swipe on the float card, the pager, ← → in the card),
 * an answer ball tapped on the board, the keys walking a want's column. And
 * everything that shows a want's answers reads here, and only here: every
 * card of the want — the float card, the panel's, the one on its tile — turns
 * to the answer in focus (useResultPages), and the board lights its ball and
 * makes it what Y is about (AnswerBallsLayer). So no two of them can show two
 * different answers of one want.
 *
 * `focus` is per want: the past answer it is turned to (its outputEntryKey, as
 * the board's balls name it), or none for the front — the answer it gives now.
 * `active` is the answer last brought into focus on purpose, which the board's
 * gestures are about (Y ties it, captures into it) until it is let go —
 * walking off, a press elsewhere — while the cards stay where they are.
 *
 * And across pages: a card is not always drawn by the page the board is on —
 * the phone app draws its float card and its panel in small web views of
 * their own, a second tab may show the same board — so every page of the GUI
 * says what it brings into focus to the others (BroadcastChannel), and a page
 * just opened asks them where the focus is. One focus, wherever it is shown.
 */
export interface AnswerFocus {
  wantId: string;
  /** The answer's key — outputEntryKey, as the board's balls name it. */
  key: string;
}

interface ResultPageStore {
  focus: Record<string, string>;
  active: AnswerFocus | null;
  /** Bring a want's answer into focus — null for its front. */
  setFocus: (wantId: string, key: string | null) => void;
  /** Let the active answer go; every card stays where it is. */
  release: () => void;
}

type Shared = Pick<ResultPageStore, 'focus' | 'active'>;
/**
 * `state`: the focus changed here — taken by every other page. `ask`: a page
 * just opened. `tell`: the answer to it, from a page that has a focus — taken
 * only by a page that has none yet, so two pages just opened cannot clear one
 * another's.
 */
type Message =
  | { from: string; kind: 'state' | 'tell'; state: Shared }
  | { from: string; kind: 'ask' };

const self = Math.random().toString(36).slice(2);
const channel: BroadcastChannel | null = (() => {
  try { return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('mywant-answer-focus'); } catch { return null; }
})();
const say = (state: Shared, kind: 'state' | 'tell' = 'state') => {
  try { channel?.postMessage({ from: self, kind, state } satisfies Message); } catch { /* closed */ }
};
const isEmpty = (s: Shared) => !s.active && Object.keys(s.focus).length === 0;

export const useResultPageStore = create<ResultPageStore>((set, get) => ({
  focus: {},
  active: null,
  setFocus: (wantId, key) => { setFocus(set, wantId, key); say(pick(get())); },
  release: () => {
    if (!get().active) return;
    set({ active: null });
    say(pick(get()));
  },
}));

const pick = (s: ResultPageStore): Shared => ({ focus: s.focus, active: s.active });

function setFocus(set: (fn: (s: ResultPageStore) => Partial<ResultPageStore> | ResultPageStore) => void, wantId: string, key: string | null) {
  set((s) => {
    if (!wantId) return s;
    if (key === null) {
      if (!(wantId in s.focus)) return s;
      const { [wantId]: _gone, ...rest } = s.focus;
      return { focus: rest, active: s.active?.wantId === wantId ? null : s.active };
    }
    const same = s.focus[wantId] === key && s.active?.wantId === wantId && s.active.key === key;
    if (same) return s;
    return { focus: { ...s.focus, [wantId]: key }, active: { wantId, key } };
  });
}

// What the other pages say is taken as it is, and not said again; a page that
// asks is told.
if (channel) {
  channel.onmessage = (e: MessageEvent<Message>) => {
    const m = e.data;
    if (!m || m.from === self) return;
    const here = pick(useResultPageStore.getState());
    if (m.kind === 'ask') { if (!isEmpty(here)) say(here, 'tell'); return; }
    if (!m.state || (m.kind === 'tell' && !isEmpty(here))) return;
    useResultPageStore.setState({ focus: m.state.focus ?? {}, active: m.state.active ?? null });
  };
  try { channel.postMessage({ from: self, kind: 'ask' } satisfies Message); } catch { /* closed */ }
}
