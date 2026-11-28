import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Which tab a detail panel is on — a want's, a thing's, a character's — told
 * by the panel as it changes, and a tab asked of it from outside (a link, the
 * browser going back to one). An extension keeps its address by this (the
 * board's /canvas/want/<id>/<tab>); the panels only say and listen.
 */
export type PanelTabKind = 'want' | 'thing' | 'character';

interface PanelTabStore {
  /** The tab each panel last said it is on, by `${kind}:${id}`. */
  shown: Record<string, string>;
  /** A tab asked of a panel; `v` tells an ask for the same tab again apart. */
  asked: { kind: PanelTabKind; id: string; tab: string; v: number } | null;
  report: (kind: PanelTabKind, id: string, tab: string) => void;
  ask: (kind: PanelTabKind, id: string, tab: string) => void;
}

export const usePanelTabStore = create<PanelTabStore>((set) => ({
  shown: {},
  asked: null,
  report: (kind, id, tab) => set(s => (s.shown[`${kind}:${id}`] === tab ? s : { shown: { ...s.shown, [`${kind}:${id}`]: tab } })),
  ask: (kind, id, tab) => set(s => ({ asked: { kind, id, tab, v: (s.asked?.v ?? 0) + 1 } })),
}));

/**
 * A panel's side of it: says which tab it is on, and goes to one asked of it
 * that it has (`tabs`).
 */
export function usePanelTab(
  kind: PanelTabKind, id: string | undefined, tab: string,
  setTab: (tab: string) => void, tabs: readonly string[],
): void {
  useEffect(() => { if (id) usePanelTabStore.getState().report(kind, id, tab); }, [kind, id, tab]);
  const asked = usePanelTabStore(s => s.asked);
  useEffect(() => {
    if (!asked || !id || asked.kind !== kind || asked.id !== id || !tabs.includes(asked.tab)) return;
    setTab(asked.tab);
    // Spent: coming back to it another time is not asking again.
    usePanelTabStore.setState({ asked: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked?.v, id]);
}
