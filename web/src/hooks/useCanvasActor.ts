import { useInputActions, type UseInputActionsOptions } from './useInputActions';
import {
  setCanvasActor, isTopCanvasActor, CANVAS_ACTIONS,
  type CanvasActorKind, type CanvasActorActions,
} from '@/stores/canvasActorStack';

/**
 * useInputActions for a canvas actor — a want, a thing, a relation road's
 * mark, whichever — whose Confirm/pick-up/Y-button might collide with
 * another actor's on the same tile.
 *
 * Composed on top of useInputActions rather than built into it: that hook is
 * the one nearly every interactive surface in the app already depends on,
 * and giving every one of its callers a stake in canvas actor ranking would
 * be a change to foundation code far wider than the one problem this solves.
 * A wrapper gets the same ergonomics — a caller names what it IS and what it
 * offers, nothing else — without touching what everything else already
 * relies on.
 *
 * What it does: registers `{ kind, actions }` on the shared canvas actor
 * stack every render (see canvasActorStack), then binds each action the
 * caller actually offers through useInputActions as normal — except the
 * bound callback checks isTopCanvasActor first and is a no-op if this actor
 * has been out-ranked. Every actor on a given tile can freely bind the same
 * key this way; only the highest-ranked one's handler ever actually runs,
 * with no central dispatcher required and no captureInput exclusivity that
 * would have muted every other key this same registration touches.
 *
 * `id` should be stable for the life of the actor — a feature name is fine;
 * two instances of the same feature are not expected to coexist. Pass
 * `kind: null` to report "I'm not currently an actor at all" (steps out of
 * the stack entirely) rather than merely offering no actions.
 *
 * Returns whatever the underlying useInputActions call returns (currently
 * `isButtonXHeld`/`isButtonYHeld`), for the rare caller that needs to read a
 * physical hold state alongside the guarded action itself. Z mode's own hold
 * is not one of these — it is the module-level isZHeld().
 */
export function useCanvasActor(
  id: string,
  kind: CanvasActorKind | null,
  actions: CanvasActorActions,
  options?: Omit<UseInputActionsOptions, 'onConfirm' | 'onPickUp' | 'onYButton' | 'onZButton'>,
): ReturnType<typeof useInputActions> {
  // Plain assignment, not an effect: cheap enough (a handful of actors, at
  // most) to just recompute every render, the same way the refs elsewhere in
  // this file's sibling hooks stay current without their own effects.
  setCanvasActor(id, kind ? { kind, actions } : null);

  const guarded = (action: string, fn: (() => boolean | void) | undefined) =>
    fn ? () => { if (isTopCanvasActor(action, id)) fn(); } : undefined;

  return useInputActions({
    ...options,
    onConfirm: guarded(CANVAS_ACTIONS.CONFIRM, actions[CANVAS_ACTIONS.CONFIRM]),
    onPickUp: guarded(CANVAS_ACTIONS.PICK_UP, actions[CANVAS_ACTIONS.PICK_UP]),
    onYButton: guarded(CANVAS_ACTIONS.Y_BUTTON, actions[CANVAS_ACTIONS.Y_BUTTON]),
    onZButton: guarded(CANVAS_ACTIONS.Z_BUTTON, actions[CANVAS_ACTIONS.Z_BUTTON]),
  });
}
