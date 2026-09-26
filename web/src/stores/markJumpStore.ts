import { create } from 'zustand';

/**
 * Where a mark leads.
 *
 * A thing and a want are both places on the board, so going to either means the
 * same thing: stand on it. A global key is not on the board at all — it lives in
 * the Global panel, and that is where its mark goes.
 */
/**
 * Which line the character walks to get there, when there is one.
 *
 * A Z hop travels an edge the board has already drawn, and the walk should
 * trace it: a road turns one corner, a constellation line runs straight. Absent
 * — a mark pressed on a card, a neighbour hop across open ground — means there
 * is no drawn line to follow and the default shape will do.
 */
export type MarkJumpRoute = 'road' | 'line';

/** `then: 'y'` — once there, press Y on it (Y mode; see yModeStore). */
export type MarkJump =
  | { kind: 'thing'; id: string; name: string; route?: MarkJumpRoute; then?: 'y' }
  | { kind: 'want'; id: string; name: string; route?: MarkJumpRoute; then?: 'y' }
  | { kind: 'global'; key: string };

/**
 * "Take me to that."
 *
 * A card that recognises what it is holding wears a mark (see MarkButton), and
 * pressing the mark should arrive at the thing itself — the tile on the board,
 * the want that feeds this field, the global card this value is published to.
 * The card cannot do that on its own: the board, the character, the camera and
 * the Global panel all live in Dashboard, and the card asking may not even be
 * on the same page yet.
 *
 * So the ask is left here and Dashboard answers it. A plain store rather than a
 * prop chain because the request has to survive the navigation the press may
 * have started — nothing in React's tree does.
 */
interface MarkJumpStore {
  /** What was asked for, or null when nothing is pending. */
  request: MarkJump | null;
  requestJump: (target: MarkJump) => void;
  /** Answered (or given up on) — clears the ask so it is not repeated. */
  consume: () => void;
}

export const useMarkJumpStore = create<MarkJumpStore>((set) => ({
  request: null,
  requestJump: (target) => set({ request: target }),
  consume: () => set({ request: null }),
}));
