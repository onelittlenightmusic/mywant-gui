import { create } from 'zustand';

/**
 * The parameter the board is currently pointing at.
 *
 * A want's form puts its parameters on the ground as dots. Standing on one has
 * to say which parameter it is, and the only place that can answer legibly is
 * the card in the want's own detail — so the board names the parameter here and
 * the card lights up.
 *
 * A store rather than a prop because the two ends are far apart: the dot is in
 * the canvas, the card is in the sidebar, and nothing on the path between them
 * has any business knowing about either.
 */
interface ParamSpotlight {
  wantId: string;
  param: string;
}

interface ParamSpotlightStore {
  spotlight: ParamSpotlight | null;
  /** Point at a parameter, or clear when the cursor steps off. */
  setSpotlight: (s: ParamSpotlight | null) => void;
}

export const useParamSpotlightStore = create<ParamSpotlightStore>((set) => ({
  spotlight: null,
  setSpotlight: (s) =>
    set((prev) => {
      const a = prev.spotlight, b = s;
      if (a === b || (a && b && a.wantId === b.wantId && a.param === b.param)) return prev;
      return { spotlight: b };
    }),
}));
