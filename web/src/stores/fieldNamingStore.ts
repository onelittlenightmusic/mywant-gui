import { create } from 'zustand';

/** A pending request to open the unified Aura naming editor on a specific
 *  want's field — raised when X is pressed on a want tile (naming its
 *  final-result *source* field), consumed by that field's card in the sidebar. */
interface FieldNamingRequest {
  wantId: string;
  /** The source field to name — the want's finalResultField (may be dot-noted;
   *  the card matches on the top-level segment). */
  field: string;
  /** Bumps each request so re-requesting the same field re-triggers the effect. */
  nonce: number;
}

interface FieldNamingStore {
  request: FieldNamingRequest | null;
  /** Ask the sidebar's card for `field` on `wantId` to open its Aura editor. */
  requestNaming: (wantId: string, field: string) => void;
  /** Called by the field card once it has opened its editor. */
  consume: () => void;
}

export const useFieldNamingStore = create<FieldNamingStore>((set) => ({
  request: null,
  requestNaming: (wantId, field) => set({ request: { wantId, field, nonce: Date.now() } }),
  consume: () => set({ request: null }),
}));
