import { useCardInnerFocusStore, isAnyCardInnerFocused } from './cardInnerFocusStore';
import { useMinimapFocusStore } from './minimapFocusStore';
import {
  useSidebarFocusStore,
  isInSidebarSurface,
  focusSidebarPanel,
} from './sidebarFocusStore';
import { giveStickToBoard, isStickWithPanel } from './stickOwner';
import { warpFreeCursorToElement, FREE_CURSOR_ITEM_ATTR } from '@/hooks/useFreeCursorNav';
import { playSound } from '@/utils/sounds';

/**
 * Where the keys are, as one value — and the only way to move them.
 *
 * There are four places input can be, and there always have been. What was
 * missing was somewhere to say so: the fact lived as three separate booleans in
 * three stores, OR-ed together at the point of reading. Nothing could say "the
 * panel has it" without also being able to say, in the same breath, that the
 * minimap did too — and handing the keys to the minimap did not take them off
 * the panel, so that pair really did occur. A single owner cannot be in two
 * places, which is the whole reason for naming it.
 *
 * The other half is the moving. A handover was four or five things done in
 * order — release the last owner, move the stick, take DOM focus, bring the
 * roaming cursor, sound the note — and each caller composed them itself. Every
 * such list is a list that can be got wrong somewhere, and was: a grid left
 * holding the exclusive input slot after focus had gone, a camera left aimed at
 * a place its owner had stopped watching. They are written once here, per
 * transition, and callers name the destination instead.
 *
 * The analogue stick is NOT one of the things this owns, though every
 * transition moves it. It has a single owner of its own already (see
 * stickOwner), and it is a different resource: the minimap holds the keys
 * while the stick stays with the board, because the stick is still being read
 * by the canvas — it is moving the camera instead of the character. A panel
 * being clicked takes the stick without taking the keys, for the same reason,
 * and those two calls in RightSidebar are deliberately not routed through
 * here.
 */
export type FocusOwner = 'board' | 'panel' | 'card' | 'minimap';

/**
 * Where the keys can be SENT.
 *
 * 'card' is missing on purpose. A card takes the keys by being operated — a
 * click landing in a field, an edit beginning — and gives them up itself, even
 * when it is unmounted mid-edit (see cardInnerFocusStore.release). Nothing
 * hands them to it from outside, so offering it as a destination would be
 * offering a move nobody can make.
 */
export type FocusDestination = Exclude<FocusOwner, 'card'>;

interface MoveOptions {
  /**
   * Whether the user asked for this.
   *
   * A press on B, on a Map button, on a card: deliberate. Those sound, and they
   * bring the roaming cursor along, because the user is following the keys with
   * their eyes and the cursor is the only thing that says where they went.
   *
   * The state changing underneath is not: walking onto a tile releases the panel
   * on every arrival, and a release that sounded would chirp several times a
   * second while simply walking around. Those also let go of DOM focus, since
   * nothing is coming to take it — where a deliberate move back to the board
   * leaves it for the grid, which focuses the selected card itself.
   */
  deliberate?: boolean;
}

/**
 * The order, written once.
 *
 * Inside-out. A card being operated is the innermost thing on screen and
 * answers first; the minimap outranks the panel because it is drawn over it.
 * The order only decides leftovers — a transition takes the keys off the last
 * owner — but leftovers are exactly what a poll of the live DOM will
 * occasionally show you mid-move, so it is fixed rather than incidental.
 *
 * What the panel counts as holding is the one thing that differs between the
 * two questions below, so it is the one thing passed in. Everything else about
 * arbitration is the same fact asked twice, and was written out twice before.
 */
function ownerWhere(panelHolds: () => boolean): FocusOwner {
  if (isAnyCardInnerFocused()) return 'card';
  if (useMinimapFocusStore.getState().focused) return 'minimap';
  if (panelHolds()) return 'panel';
  return 'board';
}

/**
 * Who has the keys right now.
 *
 * Read rather than stored, for three of the four. `panel` is a reading of
 * document.activeElement and `card` is a claim the card itself drops, and that
 * is what keeps this answer in step with the screen instead of with whichever
 * writer spoke last — the property that removed five separate races when the
 * sidebar's flag was first derived instead of set. Storing an owner here would
 * put every one of them back.
 *
 * The minimap is the exception and has to be announced: it takes no DOM focus,
 * being a picture rather than a set of controls, so there is nothing about it to
 * read back.
 *
 * Module-local: the only thing that needs this answer without React so far is
 * the transition below, which reads it to know which way the handover note
 * should sound. Export it when a poll loop wants it.
 */
function readFocusOwner(): FocusOwner {
  return ownerWhere(() => useSidebarFocusStore.getState().focused);
}

/**
 * The same question, asked on behalf of the roaming cursor.
 *
 * One clause differs, and it is not an inconsistency: the cursor is driven by
 * the STICK, so the panel counts as holding it when it holds the stick, not
 * when it holds the keys. The two really do come apart — the minimap takes the
 * keys while the stick deliberately stays with the board, because the canvas is
 * still reading it to move the camera — and a cursor confined by the wrong one
 * would be confined to a surface that is not moving it.
 *
 * Asked as ownership rather than "is one on screen": the detail panel opens by
 * itself when the character walks onto a want, and treating that as a reason to
 * confine anything is what used to take the stick out of the user's hand
 * mid-walk (see stickOwner).
 */
export function readCursorOwner(): FocusOwner {
  return ownerWhere(isStickWithPanel);
}

/** The same answer, for anything that renders from it. */
export function useFocusOwner(): FocusOwner {
  const card = useCardInnerFocusStore(s => s.activeWantId !== null);
  const minimap = useMinimapFocusStore(s => s.focused);
  const panel = useSidebarFocusStore(s => s.focused);
  if (card) return 'card';
  if (minimap) return 'minimap';
  if (panel) return 'panel';
  return 'board';
}

/**
 * Have the keys been handed away from the board / the list?
 *
 * The one predicate the greying-out is drawn from, everywhere. A surface that
 * dimmed when focus went to the panel but not when it went to the minimap would
 * be telling the user something untrue about where their keypresses are going,
 * and from the board's point of view the three are the same fact: not here.
 */
export function useInputHandedOver(): boolean {
  return useFocusOwner() !== 'board';
}

/**
 * Take the keys off everyone the destination is not.
 *
 * Asked by destination rather than by who holds them, because the four are not
 * four exclusive boxes: a card being operated is INSIDE the panel, so a move
 * out to the board has to release both, and asking "who owns it?" would get the
 * answer 'card' and leave the panel still holding the keys behind it.
 *
 * Guarded rather than unconditional. Walking onto a tile releases the panel on
 * every arrival, and telling the minimap to let go of something it never had,
 * sixty times a walk, reaches into the input layer for nothing.
 *
 * Leaving 'card' is missing on purpose here too: a card cannot be made to let
 * go from outside, and it drops its own claim even when it is unmounted
 * mid-edit (see cardInnerFocusStore.release).
 */
function leave(to: FocusDestination, deliberate: boolean): void {
  if (to !== 'panel' && useSidebarFocusStore.getState().focused) {
    useSidebarFocusStore.getState().exit();
    // Let go of the focus that enforces it, too — but only when nothing is
    // coming to take it. Both halves matter: the flag decides whether the
    // panel's card grids hold the exclusive input capture slot, while DOM focus
    // decides where the keys are actually routed. Clearing one and not the
    // other leaves input owned by a panel that no longer thinks it owns it,
    // which is the state where Enter does nothing and only the mouse works.
    if (!deliberate) {
      const ae = document.activeElement as HTMLElement | null;
      if (isInSidebarSurface(ae)) ae?.blur();
    }
  }
  if (to !== 'minimap' && useMinimapFocusStore.getState().focused) {
    useMinimapFocusStore.getState().exit();
  }
}

/**
 * Move the keys. The one transition.
 *
 * Returns whether the move happened, so a caller can fall back to its own
 * meaning for the press when it did not — pressing A with no panel beside you
 * still means whatever A meant.
 */
export function moveFocusTo(to: FocusDestination, opts: MoveOptions = {}): boolean {
  const deliberate = opts.deliberate ?? true;
  const from = readFocusOwner();

  // The panel is the one destination that can refuse. Ask before letting go of
  // anything, so a press with nothing to enter leaves the keys where they were
  // rather than dropping them on the floor between two owners.
  const panel = to === 'panel'
    ? document.querySelector<HTMLElement>('[data-sidebar="true"][data-sidebar-open="true"]')
    : null;
  if (to === 'panel' && !panel) return false;

  leave(to, deliberate);

  if (to === 'board') {
    giveStickToBoard();
    // Nothing on the board holds DOM focus — it is driven by the roaming cursor
    // and the character, not by a focused element — so any focus still sitting
    // inside the sidebar surface is stale the moment the keys leave. Drop it
    // here, unconditionally: a lingering focus re-arms the panel's exclusive
    // input claim (and the 200ms focus poll flips `focused` back to true),
    // which is exactly how Escape from a capture-holding tab — a card grid, a
    // scroll list — used to route nowhere. RightSidebar also blurs by hand
    // after this call; that becomes a harmless no-op.
    const ae = document.activeElement as HTMLElement | null;
    if (isInSidebarSurface(ae)) ae?.blur();
    if (deliberate) {
      // Bring the cursor back with the keys, to the card they belong to.
      // Leaving it parked in the panel meant the grid had the input while the
      // one thing that says where input IS sat over on the panel, still
      // highlighting a field. A card outside a panel, specifically: some pages
      // embed a copy of the card in the panel, and warping to that one would be
      // landing where we just left.
      const cards = document.querySelectorAll<HTMLElement>('[data-keyboard-nav-selected="true"]');
      const card = Array.from(cards).find(el => !el.closest('[data-sidebar="true"]'));
      // Nothing to go back to on the board, where the character is the cursor
      // and the roaming one is not in play at all.
      if (card) warpFreeCursorToElement(card);
    }
  } else if (to === 'panel') {
    useSidebarFocusStore.getState().enter();
    // Taken here, at the point of intent, rather than left to an effect in
    // RightSidebar — two of those are mounted at once sharing one flag, and
    // whether the open one's effect re-ran for a given press depended on which
    // of its dependencies had changed. The ask evaporated often enough to leave
    // the flag true with focus still on <body>.
    focusSidebarPanel();
    if (deliberate) {
      // The panel's own card is what the panel is about, so that is where the
      // cursor lands too — the same place DOM focus goes.
      const landing = panel!.querySelector<HTMLElement>('[data-sidebar-primary="true"]')
        ?? panel!.querySelector<HTMLElement>(`[${FREE_CURSOR_ITEM_ATTR}]`)
        ?? panel!;
      warpFreeCursorToElement(landing);
    }
  } else {
    useMinimapFocusStore.getState().enter();
  }

  // One note per direction, said here so the move has one voice wherever it is
  // triggered from — and so it cannot sound for a move that did not happen.
  if (deliberate && from !== to) playSound(to === 'board' ? 'handoverOut' : 'handoverIn');
  return true;
}

/**
 * Give the keys back, but only if you are the one holding them.
 *
 * Leaving is not moving. A minimap being unmounted, a form closing, a panel
 * going off screen: each has to put the keys back if it had them, and must not
 * touch them if it did not — the alternative is a component speaking for a
 * surface that is legitimately in use, which is what a closed form calling
 * exit() unconditionally used to do to whichever panel was actually up.
 *
 * Both places that needed this were hand-rolling the check with a ref before it
 * had a name. Silent, because nobody asked for it: the state moved out from
 * under the keys rather than the user handing them anywhere.
 */
export function resignFocus(from: FocusOwner): void {
  // That surface's own hold, not who readFocusOwner would name. A card being
  // operated answers first there, and a minimap unmounting while one is would
  // then decide it had nothing to give back — leaving its flag set with no
  // minimap left to hold it, which is the state where the board reads that flag
  // and never moves the character again.
  if (from === 'panel') {
    if (!useSidebarFocusStore.getState().focused) return;
    useSidebarFocusStore.getState().exit();       // hands the stick back with it
  } else if (from === 'minimap') {
    if (!useMinimapFocusStore.getState().focused) return;
    useMinimapFocusStore.getState().exit();
  }
  // Only its own part, never the other surface's: a component going away is not
  // evidence about anyone else, and the panel's flag is a reading of real focus
  // that would come straight back anyway.
}

/*
 * The named moves.
 *
 * The same four gestures the app has always had, now spelled as destinations.
 * They are kept as names because that is how the ninety-odd call sites read, and
 * because each one is a thing a user does rather than a state a program is in:
 * "go into the panel" and "come back out" are not the same move in opposite
 * directions to the person pressing the button, even though they are to the
 * machine underneath.
 */

/** Hand the keys to whatever detail panel is on screen. A / Enter on a card. */
export function handOverToSidebar(): boolean {
  return moveFocusTo('panel');
}

/**
 * The same, for a panel that is still on its way in.
 *
 * The plain move reads the DOM once and gives up when there is no open panel,
 * which is right for a press on a card — the panel is either there or the press
 * means something else. It is wrong for handing focus BACK to a panel we have
 * just caused to reappear: the state that reopens it has been set, React has not
 * rendered it, and on a phone the sheet then animates in. Keeps asking until it
 * lands, or until the frames run out and there was evidently nothing to go back
 * to.
 */
export function handOverToSidebarWhenReady(maxFrames = 60): void {
  let left = maxFrames;
  const tick = () => {
    if (moveFocusTo('panel')) return;
    if (--left > 0) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Take the keys back out to the card grid. B / Escape on a panel. */
export function handBackToGrid(): void {
  moveFocusTo('board');
}

/**
 * Let the panel go because the state moved on, not because anyone asked.
 *
 * Walking onto another tile does this on every arrival, which is why it is the
 * silent one.
 */
export function releaseSidebarFocus(): void {
  moveFocusTo('board', { deliberate: false });
}

/** Hand the keys to the minimap. The overlay's Map button. */
export function handOverToMinimap(): void {
  moveFocusTo('minimap');
}

/** Take them back out to the board. B / Escape on the minimap. */
export function handBackFromMinimap(): void {
  moveFocusTo('board');
}
