import { create } from 'zustand';

/** One thing chosen as a starting point for a new want. */
export interface SeedThing {
  /** thing.yaml section key (e.g. "stations"). */
  catalogKey: string;
  /** data subtype of the value (e.g. "station") — used to match want types. */
  subtype: string;
  /** the thing itself (e.g. "渋谷"). */
  value: string;
  /** ThingRecord id, so the source card can be shown and returned to. */
  sourceMemoId: string;
  /** icon/color for showing the source thing chip without re-resolving. */
  icon: string;
  color: string;
}

/** A thing chosen as the starting point for a new want. Raised from the
 *  Thing page's card overlay, consumed by the Dashboard which opens the Add Want
 *  form filtered to want types that accept this value's subtype. */
export interface WantSeed extends SeedThing {
  /**
   * The rest of the selection, when more than one thing started this.
   *
   * The first thing stays where it always was, so every caller that seeds one
   * value — and every part of the form that reads one — keeps working unchanged;
   * this is what a board selection of several tiles adds on top. Order is the
   * order they were ticked, and it is meaningful: the first value is the one
   * that claims a type's declared `seed-param`.
   */
  more?: SeedThing[];
  /**
   * Where on the board the want should land, when the caller knows — the
   * constellation prompt passes the cell between the things it was made
   * from. Absent: next to the character, as the plain Add press places it.
   */
  at?: { x: number; y: number };
  /** bumps each request so re-seeding the same value re-triggers effects. */
  nonce: number;
}

/** Every thing this seed carries, first one included. */
export function seedThings(seed: WantSeed): SeedThing[] {
  return [seed, ...(seed.more ?? [])];
}

interface WantSeedStore {
  seed: WantSeed | null;
  requestSeed: (seed: Omit<WantSeed, 'nonce'>) => void;
  consume: () => void;
}

export const useWantSeedStore = create<WantSeedStore>((set) => ({
  seed: null,
  requestSeed: (seed) => set({ seed: { ...seed, nonce: Date.now() } }),
  consume: () => set({ seed: null }),
}));
