import { create } from 'zustand';

/**
 * A constellation waiting to be named.
 *
 * Setting a thing down beside another says the two belong together, but it does
 * not say what they are — and a constellation is a name someone gave to a
 * handful of values, so it cannot be made without one. The board raises this;
 * the canvas asks, in the same inline field the batch bar uses when a selection
 * is grouped by hand.
 *
 * It lives in a store rather than in a return value because a thing can be moved
 * two ways — dragged, or walked with Shift and the arrows — and both should
 * arrive at the same question.
 */
/** One choice in the connection menu beyond grouping — see ConstellationPrompt.actions. */
export interface PromptAction {
  id: string;
  label: string;
  title: string;
  icon: 'connect' | 'fill';
  /** Runs once the menu has closed. Resolves false when there was nothing to
   *  offer, which the menu answers with a bump. */
  run: () => Promise<boolean>;
}

export interface ConstellationPrompt {
  /** The thing that was just moved. */
  thingId: string;
  /** What it was set down beside — the other founding member. */
  anchorId: string;
  /**
   * Everyone this question is about, in the order they were put together.
   *
   * Setting one thing beside another is two of them, and that is what this
   * was: a pair, named by the two fields above. Tying a wire (Y) is any
   * number, and it was being chopped into consecutive pairs before it got
   * here — which is a fair reading for "are these a constellation" and the
   * wrong one for everything else, because three things tied together are one
   * group and one want, not two of each.
   *
   * So the members travel whole. The pair above is the first two of them and
   * is what anchors the bubble on screen; a caller with only two need not set
   * this at all.
   */
  members?: string[];
  /**
   * What is being put together. Things (the default) are offered a group to
   * join, a new one, or a want made of them; wants are offered a group, a new
   * one, or a connection — a value flowing from one to the other (`onConnect`).
   */
  kind?: 'thing' | 'want' | 'mixed';
  /**
   * Where each member stands, when the prompt cannot look it up itself — a
   * want's cell lives in the board's position map, not the thing placements
   * the prompt reads. Used to anchor the bubble between the first two.
   */
  cells?: Record<string, { x: number; y: number }>;
  /**
   * The choices this pair has besides a group — what the menu offers after the
   * groups and New, by what was put together: two wants can be connected (a
   * value flowing from one to the other), a want and a thing can have the
   * value fill a parameter. Two things need none here: their other choice, a
   * want made of them, is the prompt's own (see ConstellationNamePrompt).
   */
  actions?: PromptAction[];
  /** What to put in the field to start with: the value it was set beside. */
  suggested: string;
  /**
   * Every existing constellation of this kind, by name — the picker's choices. Empty
   * when there are none yet, which is when the prompt has nothing to offer but
   * a new name.
   */
  existingGroups: string[];
  /**
   * The group the neighbour it landed beside already belongs to, if any. The
   * prompt opens on this choice pre-selected rather than on "new", because the
   * board already has an opinion — the user is confirming it, not starting
   * from a blank field.
   */
  preselected?: string;
}

interface ConstellationPromptStore {
  pending: ConstellationPrompt | null;
  ask: (prompt: ConstellationPrompt) => void;
  dismiss: () => void;
}

export const useConstellationPromptStore = create<ConstellationPromptStore>((set) => ({
  pending: null,
  ask: (prompt) => set({ pending: prompt }),
  dismiss: () => set({ pending: null }),
}));
