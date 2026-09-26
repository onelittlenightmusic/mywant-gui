import { create } from 'zustand';

/** A want type chosen from the Want Types page to start an Add Want with —
 *  opens the Dashboard's Add Want form with this type preselected (fields
 *  phase). Mirrors wantSeedStore, but seeds by type instead of a thing. */
interface AddWantTypeStore {
  typeId: string | null;
  /**
   * The cell the new want should land on, when the caller knows one.
   *
   * An Add Want opened by hand lands where the character is standing, which is
   * the right answer for a press with no place attached to it. The board's own
   * suggestion has one: the offer is drawn on a free cell, and that cell IS the
   * offer — accepting it and having the want appear somewhere else entirely
   * makes the drawing a lie. Absent, the usual rule applies.
   */
  at: { x: number; y: number } | null;
  /**
   * What the new want should already declare.
   *
   * The board's suggestion knows the whole move, not just its type: "a reminder
   * fed by that route's departure" is a want spec, and the wire is part of what
   * is being asked for rather than a chore that follows it. Handed to the form
   * so the want is created carrying it — the engine arranges the provider's
   * half from the declaration (see the engine's wirePhase).
   */
  params: Record<string, unknown> | null;
  imports: Record<string, string> | null;
  nonce: number;
  open: (
    typeId: string,
    opts?: {
      at?: { x: number; y: number } | null;
      params?: Record<string, unknown> | null;
      imports?: Record<string, string> | null;
    },
  ) => void;
  consume: () => void;
}

export const useAddWantTypeStore = create<AddWantTypeStore>((set) => ({
  typeId: null,
  at: null,
  params: null,
  imports: null,
  nonce: 0,
  open: (typeId, opts = {}) => set({
    typeId,
    at: opts.at ?? null,
    params: opts.params ?? null,
    imports: opts.imports ?? null,
    nonce: Date.now(),
  }),
  consume: () => set({ typeId: null, at: null, params: null, imports: null }),
}));
