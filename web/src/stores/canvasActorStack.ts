/**
 * Who answers a given input on the canvas — one shared registry of actors
 * instead of a fresh ad-hoc coexistence agreement for every key.
 *
 * The board is always standing on, or near, one of a small number of THINGS —
 * a want, a thing, a relation road's mark, a constellation line's mark — or
 * has a modal question of its own raised over all of them (a prompt) — and
 * each of those can have an opinion about more than one input: Confirm,
 * pick-up, a Y-button jump, whichever comes next. Modelling that as one pool
 * per input name (a 'confirm' stack, a separate 'pickUp' stack, and so on)
 * means every feature that answers several inputs registers itself several
 * times and keeps them all in sync by hand. Modelling it as one pool of
 * ACTORS — each naming what kind of thing it is and which of the inputs it
 * currently answers — means a feature registers itself once per render, and
 * "who wins Confirm" and "who wins pick-up" both fall out of the same
 * ranked list rather than needing their own.
 *
 * Reaching for useInputActions' own captureInput to settle a collision was
 * the wrong tool regardless of which input: that flag claims a key
 * exclusively for as long as a whole registration stays enabled — nearly all
 * of canvas mode, typically — so it silently mutes every OTHER registration's
 * use of that key rather than only stepping in on the one tile where two
 * actors actually overlap. The fix is to resolve the collision at the moment
 * it happens, by a ranking that means something rather than a number each
 * call site guesses at.
 *
 * Usage:
 *   setCanvasActor('relationMark', activeMark && { kind: 'relationRoad', actions: {
 *     confirm: () => openRelationMarkAtCursor(),
 *   } });
 *   // ...and whoever owns the actual Confirm keybinding:
 *   runCanvasAction('confirm');
 */

import { record as recordInput } from '@/utils/inputTap';

/**
 * Every kind of thing that can act as a canvas actor, strongest first.
 *
 * 'lock' outranks even a prompt, and answers by doing nothing. It is the board
 * saying "not now": something is mid-flight and an input that would start a
 * second one has to be dropped rather than queued or half-applied. The one
 * today is the character travelling — a Z-mode hop, an aimed jump — where an
 * arrow pressed mid-journey used to walk them off the path they were animating
 * along. A lock is pushed when the journey starts and pulled when it lands
 * (see cursorManGeometry's flight bookkeeping), so it can never outlive the
 * thing it was protecting.
 *
 * 'prompt' outranks everything underfoot: a modal question the board itself
 * raised (name this constellation, confirm this move) is not competing for
 * the tile CursorMan happens to be standing on, it is standing in front of
 * the whole board, so its Confirm answer wins regardless of what a want,
 * thing, or mark below it would have offered. Only ever registered for as
 * long as that question is actually on screen — see ConstellationNamePrompt.
 *
 * 'mode' is next: a board-wide state the user is holding a button to stay in
 * (aim mode, see useCanvasAim). Not a question, so not a prompt — but while it
 * is on, a Confirm belongs to the mode and not to the tile underfoot, for the
 * same reason a prompt's does. It is the answer to "how do I stop the detail
 * panel opening over my aim" that does NOT involve captureInput: a mode
 * outranking a want here settles that one press, where the capture flag would
 * mute every other registration's use of every key for as long as the mode
 * lasted. That distinction is the whole reason this file exists.
 *
 * Below that, a want outranks a thing for the same reason it already does
 * everywhere else underfoot is reported (see useCursorManController's
 * commitCursorManTo: "Focus still goes to a want first and a thing only when
 * there is no want") — this list continues that one rule rather than
 * inventing a second. A relation road or constellation line's mark only wins
 * an input when nothing with its own want/thing identity is also offering
 * that same input, which is exactly the case an adjacent-pair endpoint isn't
 * and a themed line's own empty-ground midpoint cell is.
 */
export const CANVAS_ACTOR_KIND_ORDER = [
  'lock',
  'prompt',
  'mode',
  // A crowded cell the character stands on, its tiles fanned out around them
  // (guiex's stackFanStore): a direction toward one of them picks it, before
  // the board reads the direction as a move. Below a held mode — Z's cluster
  // owns its directions while it is up — and above everything underfoot.
  'stack',
  'want',
  'thing',
  'relationRoad',
  'constellationLine',
] as const;
export type CanvasActorKind = typeof CANVAS_ACTOR_KIND_ORDER[number];

/**
 * The inputs actors can be asked to answer, named once rather than typed out
 * fresh (and possibly misspelled) at every call site. Not exhaustive — any
 * string works as an action name — but a caller reaching for one of these
 * should use the constant.
 */
export const CANVAS_ACTIONS = {
  /** Enter / gamepad A. */
  CONFIRM: 'confirm',
  /** Shift going down, or A held on a gamepad / the software pad. */
  PICK_UP: 'pickUp',
  /** Gamepad Y (or keyboard y) — the general "Y action". */
  Y_BUTTON: 'yButton',
  /** Gamepad L2 (or keyboard z) — Z mode's jump-cluster overlay. */
  Z_BUTTON: 'zButton',
  /**
   * Gamepad X / keyboard x — a want's own button, where it acts ON that want.
   *
   * X is otherwise board-wide: a press goes to every reaching want that named
   * the button (useWantInputDispatcher), which is right for an effect — "do the
   * thing this board can do" — and wrong for a button that acts on one card.
   * Pressing X to remember what a card is showing has to ask THAT card, so the
   * want underfoot is offered the press first and every other claimant only
   * gets its turn when nothing underfoot wanted it.
   *
   * Through the stack rather than through the dispatcher's own guard, so the
   * ranking that already decides Confirm decides this too: a character
   * mid-flight (lock) or a modal question (prompt) takes X off the board
   * without either of them knowing X exists.
   */
  BUTTON_X: 'buttonX',
  /**
   * Shift+Enter, or the pad's Start — "show me what can be done with this".
   *
   * The one input whose answer depends on a surface rather than on a tile: a
   * detail panel that is open is what the question is about, whether or not it
   * currently holds the keys. That ranking used to live in two registrations'
   * `enabled` flags (the page's stood down when input was handed over, the
   * panel's needed to be focused), and between them was a gap: a panel open
   * with the keys still on the board had nobody answering, so the press fell
   * through to the board's own reading and opened the character bubble instead
   * of the card's actions.
   *
   * A handler returning false is "I had nothing to show", which is how the
   * board gets its turn — a panel with no card in it does not swallow the
   * press.
   */
  CONTEXT_MENU: 'contextMenu',
  /**
   * Keyboard h / gamepad R3 — the history of what is underfoot: a want's
   * column of answers, focused (guiex AnswerBallsLayer). Pressed again inside
   * the column, it is how you leave it.
   */
  HISTORY: 'history',
  /**
   * A direction — arrow key, D-pad, software pad. The one action that carries
   * an argument, because a direction is what it is about; everything else here
   * is a button that either happened or did not.
   *
   * Offered by a mode that reads directions itself (Z mode's cluster jumps
   * along them) so the board can ask before walking the character. That ask is
   * what replaced the cluster's captureInput: the flag silenced every key
   * app-wide for as long as the cluster was up, where this settles the one
   * press that two of them both wanted.
   */
  NAVIGATE: 'navigate',
} as const;

/** What one actor offers, per input name. A handler returning explicit
 *  `false` means "asked, but there was nothing to actually do" — same as not
 *  offering the action at all, so the next-ranked actor gets a turn.
 *  Anything else (true, or nothing returned) counts as handled. */
export type CanvasActorActions = Partial<Record<string, (arg?: unknown) => boolean | void>>;

export interface CanvasActor {
  kind: CanvasActorKind;
  actions: CanvasActorActions;
}

/** Lower is stronger. A kind absent from the list (should not happen — every
 *  caller uses the shared union type) ranks weakest rather than throwing. */
function kindRank(kind: CanvasActorKind): number {
  const i = CANVAS_ACTOR_KIND_ORDER.indexOf(kind);
  return i === -1 ? CANVAS_ACTOR_KIND_ORDER.length : i;
}

const actors = new Map<string, CanvasActor>();

/**
 * Report what a feature is right now — null clears it. Call every render;
 * cheap enough (a handful of actors, at most) that recomputing beats trying
 * to diff.
 */
export function setCanvasActor(id: string, actor: CanvasActor | null): void {
  if (actor) actors.set(id, actor);
  else actors.delete(id);
}

/** Every live actor, strongest kind first. Ties (two actors of the same
 *  kind, which should not happen in practice) keep Map insertion order. */
function rankedActors(): CanvasActor[] {
  return rankedEntries().map(([, actor]) => actor);
}

/** The same order, with the ids kept — the input tap wants to name a winner. */
function rankedEntries(): Array<[string, CanvasActor]> {
  return Array.from(actors.entries())
    .sort(([, a], [, b]) => kindRank(a.kind) - kindRank(b.kind));
}

/**
 * Is a HELD MODE currently answering this input?
 *
 * Asked by the input layer, about directions, on behalf of the gamepad — and
 * the asymmetry it fixes is worth stating. A keyboard press carries a target,
 * so "was this typed into the sidebar" is answered about the press itself. A
 * pad press carries nothing, so the same question can only be asked of
 * whatever happens to hold focus — and the detail panel opens by itself when
 * the character walks onto a tile. Holding Y over a tile therefore meant the
 * D-pad was dropped before the board could be asked, while the arrow keys went
 * straight through: the same gesture behaved differently in each hand.
 *
 * A mode is the answer because a mode is being HELD. The user has a button down
 * and a ring on screen; the directions are that ring's for as long as that
 * lasts, wherever focus happens to sit. Modes are also the only actors that
 * exist for a held moment rather than for as long as a tile is underfoot, which
 * is what keeps this from handing the board every direction forever.
 */
export function heldModeAnswers(action: string): boolean {
  for (const actor of rankedActors()) {
    // Deliberately not 'lock'. This question is "should the pad's direction
    // skip the focus guards and reach the board", and a lock's answer is that
    // the BOARD must not move — not that a panel with the keys should stop
    // scrolling. A lock still wins the moment the board is actually asked
    // (runCanvasAction), which is where its job is.
    // A fan underfoot ('stack') too: the detail panel opens by itself on
    // landing and takes focus, which would drop the pad's pick of the very
    // tile beside it. Its handler declines a direction with nothing to pick,
    // so a press that is a move still moves.
    if (actor.kind !== 'mode' && actor.kind !== 'prompt' && actor.kind !== 'stack') continue;
    if (actor.actions[action]) return true;
  }
  return false;
}

/**
 * The id of the actor that would currently answer `action`, or null if none
 * of them do. What a feature's own UI (a prompt bubble, say) checks before
 * showing itself, so it never promises an input it has actually been
 * out-ranked for.
 */
export function topCanvasActorFor(action: string): string | null {
  for (const [id, actor] of Array.from(actors.entries()).sort(
    (a, b) => kindRank(a[1].kind) - kindRank(b[1].kind),
  )) {
    if (actor.actions[action]) return id;
  }
  return null;
}

/** Whether `id` is the actor that would currently answer `action`. */
export function isTopCanvasActor(action: string, id: string): boolean {
  return topCanvasActorFor(action) === id;
}

/**
 * Ask the ranked actors for `action` in turn; the first one that both
 * offers it and actually does something (does not return `false`) wins.
 * What that action's one keyboard/gamepad binding calls.
 */
export function runCanvasAction(action: string, arg?: unknown): boolean {
  for (const [id, actor] of rankedEntries()) {
    const handler = actor.actions[action];
    if (!handler) continue;
    const result = handler(arg);
    if (result !== false) {
      // Which actor actually took it, and who was ahead of it in the queue.
      // The whole class of bug this registry exists to prevent looks like
      // "the wrong thing answered", and that is invisible without this.
      recordInput('canvas-action', action, `→ ${id} (${actor.kind})`);
      return true;
    }
  }
  recordInput('canvas-action', action, 'unanswered');
  return false;
}
