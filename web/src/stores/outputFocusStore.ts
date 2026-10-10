import { create } from 'zustand';

/**
 * "Show this want's answer": one of its outputs (engine result history) to
 * open in the detail sidebar's History › Outputs and light up.
 *
 * Asked by the board when a want's answer — drawn as a ball beside it — is
 * tapped; answered by WantDetailsSidebar, which opens that tab when the want
 * it is showing is the one asked about. `version` makes asking twice for the
 * same answer still an ask.
 */
interface OutputFocusStore {
  wantId: string | null;
  /** The answer's id, or its timestamp for an answer recorded before ids. */
  entryKey: string | null;
  version: number;
  focus: (wantId: string, entryKey: string) => void;
}

export const useOutputFocusStore = create<OutputFocusStore>((set) => ({
  wantId: null,
  entryKey: null,
  version: 0,
  focus: (wantId, entryKey) => set((s) => ({ wantId, entryKey, version: s.version + 1 })),
}));

/** How an answer is named here and by the board's answer balls. */
export function outputEntryKey(entry: { id?: string; timestamp: string }): string {
  return entry.id || entry.timestamp;
}
