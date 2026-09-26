import { useEffect, useRef } from 'react';
import { useCardOverlayStore } from './cardOverlayStore';
import { useWantStore } from './wantStore';
import { playSound } from '@/utils/sounds';

/** What an action overlay opening and closing sounds like. One definition. */
const soundOverlay = (open: boolean) => playSound(open ? 'sparkle' : 'handoverOut');

/**
 * A card's action overlay opening and closing, said out loud — wherever it
 * happens, and whatever kind of card it is.
 *
 * The overlay has two homes: want cards keep theirs in wantStore
 * (quickActionsWantId, which predates the shared one and carries want-specific
 * state), everything else in cardOverlayStore. It also has many doors — Start
 * on a card in the grid, Start on the copy embedded in a detail panel, a
 * right-click, a long-press. Sounding it at each door meant seven or eight
 * call sites, and in practice only one of them had a sound: pressing Start in
 * the panel spoke, pressing Start on the very same card out in the grid did
 * not.
 *
 * So it is sounded from the fact instead of from the door. Both stores hold the
 * same fact — which card, if any, is showing its actions — and a transition of
 * either is the event. That is the same shape the hamburger menu uses (see
 * Header), and for the same reason: too many ways in to trust them all.
 *
 * Install once, at startup (main.tsx). Subscriptions live for the life of the
 * page, so there is nothing to tear down.
 */
export function installCardOverlaySounds(): void {
  const sound = soundOverlay;

  // Only the null ↔ non-null crossing. Moving the overlay straight from one
  // card to another is still "an overlay is open" and should not re-fire; the
  // ids differ but the fact has not changed.
  let entityOpen = useCardOverlayStore.getState().openCardId !== null;
  useCardOverlayStore.subscribe((s) => {
    const open = s.openCardId !== null;
    if (open === entityOpen) return;
    entityOpen = open;
    sound(open);
  });

  let wantOpen = useWantStore.getState().quickActionsWantId !== null;
  useWantStore.subscribe((s) => {
    const open = s.quickActionsWantId !== null;
    if (open === wantOpen) return;
    wantOpen = open;
    sound(open);
  });
}

/**
 * The same event, for an overlay whose open/closed lives in component state.
 *
 * Cards that keep theirs in one of the two stores above are all covered at once
 * by the subscriptions there. The sidebar's field cards keep theirs locally —
 * there is one overlay per field and they never need coordinating — so there is
 * no shared fact to watch, and they were the one kind of card whose actions
 * appeared in silence.
 *
 * Same idea in a smaller frame: sounded from the fact rather than from the
 * door, which for these cards is a right-click, a long-press, a gamepad
 * confirm, and every item in the overlay itself, each of which closes it.
 * Thirteen call sites in StateFieldCard alone, so the door was never the place.
 *
 * The ref starts at the current value, so a card that mounts with its overlay
 * already open (the gamepad's `activated` hand-off does exactly that) does not
 * announce a transition that did not happen.
 */
export function useCardOverlaySound(open: boolean): void {
  const prev = useRef(open);
  useEffect(() => {
    if (open === prev.current) return;
    prev.current = open;
    soundOverlay(open);
  }, [open]);
}
