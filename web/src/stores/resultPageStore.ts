import { create } from 'zustand';

/**
 * Which past answer a want card is turned back to, and asks to turn one to
 * a given answer — the card's stack of answers (useResultPages) and the
 * board's answer balls, kept in step.
 *
 * Every card of a want — the float card, the one embedded in the panel —
 * says what page it shows (`shown`, keyed by the card: one closing takes only
 * its own away). The board lights the balls of those
 * answers. And a ball tapped, or one card of a want turned by hand, asks
 * (`request`) every card of that want to turn to that answer — null for the
 * front; `version` makes asking twice for the same answer still an
 * ask, and `at` lets a card that opens because of the tap still hear it.
 */
export interface ShownAnswer {
  wantId: string;
  /** The answer's key — outputEntryKey, as the board's balls name it. */
  key: string;
}

interface ResultPageStore {
  shown: Record<string, ShownAnswer>;
  setShown: (cardId: string, a: ShownAnswer | null) => void;
  request: { wantId: string; key: string | null; version: number; at: number } | null;
  turnTo: (wantId: string, key: string | null) => void;
}

export const useResultPageStore = create<ResultPageStore>((set) => ({
  shown: {},
  setShown: (cardId, a) => set((s) => {
    const cur = s.shown[cardId];
    if (!a) {
      if (!cur) return s;
      const { [cardId]: _gone, ...rest } = s.shown;
      return { shown: rest };
    }
    if (cur && cur.wantId === a.wantId && cur.key === a.key) return s;
    return { shown: { ...s.shown, [cardId]: a } };
  }),
  request: null,
  turnTo: (wantId, key) => set((s) => ({
    request: { wantId, key, version: (s.request?.version ?? 0) + 1, at: Date.now() },
  })),
}));
