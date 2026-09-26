import { useCallback, useRef } from 'react';
import { Want } from '@/types/want';
import type { ThingRecord } from '@/types/thing';
import { useInputActions } from '@/hooks/useInputActions';
import { handOverToSidebar, handBackFromMinimap } from '@/stores/focusOwner';
import { setCanvasActor, runCanvasAction, CANVAS_ACTIONS, type CanvasActorKind } from '@/stores/canvasActorStack';
import type { BoardHandle } from './boardLink';

/**
 * Who the detail panel is for, and how you get into it.
 *
 * Two questions that look like one. "Is there something to look inside?" is
 * answered from where attention is — the tile underfoot on the board, the
 * focused card in the list. "Is the panel actually up?" is answered from the
 * panel, and on a roomy layout the two disagree for about a second after
 * landing on a tile, because the canvas only publishes what is underfoot once
 * its landing animation has finished. Enter is bound to the second question,
 * which is why it is a separate value and not a convenience.
 *
 * The phone is the other reason this is not simple: there the sheet is most of
 * the screen, so it waits to be asked for, and everything here has an
 * `isMobileLayout` branch saying so.
 */
export interface DetailTargetApi {
  canvasMode: boolean;
  isSelectMode: boolean;
  isMobileLayout: boolean;
  isCanvasDragging: boolean;
  formSituation: string;
  selectedWant: Want | null;
  /** Wants that can hold a tile, including canvas-expanded children. */
  regularWants: Want[];
  sidebar: { showGlobal: boolean };

  /** What the character is standing on. */
  cursorFocusedWantId: string | null;
  cursorFocusedThingId: string | null;
  /** The folded group the character is standing at, when a form stands on it. */
  cursorGroupName: string | null;
  thingRecords: ThingRecord[];
  /** True only while a request names the very thing on screen. */
  detailsAskedFor: (id: string | null | undefined) => boolean;
  detailsDismissed: boolean;
  setDetailsRequestedFor: (id: string | null) => void;
  setDetailsDismissed: (v: boolean) => void;

  /** Surfaces that are already holding the keys. */
  inputHandedOver: boolean;
  characterBubbleOpen: boolean;
  arrangeReviewOpen: boolean;
  minimapFocused: boolean;
  /** A board being looked at pushes the phone's sheet aside for the duration. */
  canvasUnderReview: boolean;
  /** The sidebar is showing a thing form rather than a want. */
  addingThing: boolean;
  editingThing: ThingRecord | null;

  wantCanvasRef: React.RefObject<BoardHandle>;
  onViewWant: (want: Want, opts: { toggle: boolean }) => void;
}

export function useDetailTarget(api: DetailTargetApi) {
  const {
    canvasMode, isSelectMode, isMobileLayout, isCanvasDragging, formSituation,
    selectedWant, regularWants, sidebar,
    cursorFocusedWantId, cursorFocusedThingId, cursorGroupName, thingRecords,
    detailsAskedFor, detailsDismissed,
    inputHandedOver, characterBubbleOpen, arrangeReviewOpen, minimapFocused,
    canvasUnderReview, addingThing, editingThing,
  } = api;

  const apiRef = useRef(api);
  apiRef.current = api;

  const cursorThingRecord = (!selectedWant && !sidebar.showGlobal && cursorFocusedThingId
                             && !detailsDismissed
                             && (!isMobileLayout || detailsAskedFor(cursorFocusedThingId)))
    ? thingRecords.find(r => r.id === cursorFocusedThingId) ?? null
    : null;

  /**
   * The group the panel is showing, when the character is standing at one.
   *
   * Ahead of the want and the thing: standing at a folded group puts you on
   * or beside its members, and what you walked up to is the group. Asked for on
   * a phone, dismissed by closing — exactly as a thing is. The request is
   * named `group:<name>` so it cannot match a want or thing id.
   */
  const cursorGroupShown = (canvasMode && !isSelectMode && !!cursorGroupName && !sidebar.showGlobal
                            && !detailsDismissed
                            && (!isMobileLayout || detailsAskedFor(`group:${cursorGroupName}`)))
    ? cursorGroupName
    : null;

  // ── Taking the "open details" offer ───────────────────────────────────────
  // Whether there is anything to offer it for. Select mode is excluded: there
  // A already means "tick this one", and the board is being used to choose
  // rather than to read.
  const hasCanvasDetailTarget = canvasMode && !isSelectMode
    && (!!cursorFocusedWantId || !!cursorFocusedThingId || !!cursorGroupName);

  /**
   * The want the list has focused.
   *
   * On this page focusing IS selecting: useHierarchicalKeyboardNavigation's
   * onNavigate calls handleViewWant for a real want (and only sets
   * focusedSlotId for the virtual add/archive tiles), so the sidebar is already
   * open by the time a card is focused. That makes selectedWant the right
   * source here — focusedSlotId is null for every actual want.
   */
  const listFocusedWantId = (!canvasMode && selectedWant)
    ? (selectedWant.metadata?.id || selectedWant.id || null)
    : null;
  const hasListDetailTarget = !canvasMode && !isSelectMode && !!listFocusedWantId
    && formSituation === 'closed';

  // Dimming the list behind the selected card, and lifting that card through
  // the dim, used to be spelled out here. Both are HandoverScrim's now: the
  // want list is one card grid among a dozen, and this was the only one that
  // dimmed. It finds the card by data-keyboard-nav-selected, which WantGrid
  // already sets, so nothing here has to say which one it is.

  /**
   * Look inside — the second beat, wherever the ask came from.
   *
   * `forWantId` names the want when the caller already knows it, which a click
   * does: it is the card under the finger. Left out, the target is inferred
   * from where the character is standing, which is right for a key press and
   * for the button beside the tile.
   *
   * The inference is not right for a click on the board, though, and that is
   * why the parameter exists: clicking a canvas tile selects it without moving
   * the character, so a second click inferring cursorFocusedWantId would have
   * asked to look inside whichever tile the character happened to be on and
   * dragged the panel over to it.
   */
  const openCanvasDetails = useCallback((forWantId?: string) => {
    const a = apiRef.current;
    // A group underfoot is what the panel is about (see cursorGroupShown).
    if (!forWantId && a.canvasMode && a.cursorGroupName) {
      a.setDetailsRequestedFor(`group:${a.cursorGroupName}`);
      a.setDetailsDismissed(false);
      requestAnimationFrame(() => handOverToSidebar());
      return;
    }
    const targetWantId = forWantId ?? a.cursorFocusedWantId ?? listFocusedWantId;
    a.setDetailsRequestedFor(targetWantId ?? a.cursorFocusedThingId ?? null);
    a.setDetailsDismissed(false);
    if (targetWantId) {
      const want = a.regularWants.find(w => (w.metadata?.id || w.id) === targetWantId);
      const openId = a.selectedWant?.metadata?.id || a.selectedWant?.id;
      // Already open on roomier layouts, where the sidebar follows the
      // character; on a phone this press is what opens it. handleViewWant
      // toggles, so calling it on the want already shown would close it.
      if (want && openId !== targetWantId) a.onViewWant(want, { toggle: false });
    }
    // No sound here either — see useDashboardNav. handleViewWant still sounds
    // the panel *opening* when this press is what opened it (the phone), which
    // is a different event from the keys moving into it.
    // The same handover every other page's card grid does now. This used to be
    // spelled out here — the flag, then the focus — and the shared version grew
    // a third step (bringing the roaming cursor along) that the board would
    // otherwise have missed. Deferred so a panel this press just opened exists
    // to be handed to.
    requestAnimationFrame(() => handOverToSidebar());
  }, [listFocusedWantId]);

  /**
   * Hand the keys to the detail sidebar — what Enter and gamepad A do wherever
   * the character is standing, on the board and in the list alike.
   *
   * This used to be one of two buttons floating beside the tile. The row said
   * out loud what a key already did, cost an anchor measured every frame, and
   * needed its own capture to arm a choice — for a choice that was never really
   * one: "look inside" is the only way further in, and modifying a want happens
   * *after* you are inside it, on the card embedded in the panel. So Enter now
   * always means this, and the second Enter — pressed on that embedded card —
   * is what reaches the want's own controls (see StateSectionCard).
   */
  /**
   * Whether a detail sidebar is actually on screen right now.
   *
   * Enter's job is "hand input to the panel", so this — not where the character
   * is standing — is what should decide whether Enter has anything to do.
   * `hasCanvasDetailTarget` is derived from cursorFocusedWantId, which the
   * canvas only publishes once its landing animation has finished; measuring in
   * Chrome showed a window of over a second after arriving on a tile where the
   * sidebar was already open but that state was still null, and Enter did
   * nothing at all. Standing on something is still enough on the phone, where
   * the panel waits to be asked for — hence the either/or.
   */
  const detailSidebarOnScreen = !!selectedWant || !!cursorThingRecord || !!cursorGroupShown;

  const canOpenDetails = !isSelectMode && !inputHandedOver && !characterBubbleOpen && !arrangeReviewOpen
    && formSituation === 'closed' && !isCanvasDragging
    && ((canvasMode && (detailSidebarOnScreen || hasCanvasDetailTarget))
        || hasListDetailTarget);

  /**
   * Registered on the shared canvas actor stack (see canvasActorStack) with
   * its REAL action — opening the panel — not a marker: the stack's own
   * ranked loop (runCanvasAction) already guarantees only the single
   * highest-ranked actor's action ever runs for a given Confirm press, so a
   * second, independent "did I win?" check here would only be restating that
   * same decision a second time from a second listener, which is exactly the
   * kind of parallel-listener drift that let a stray Enter reach this panel
   * after a modal prompt (ConstellationNamePrompt) had already answered the
   * same press. One winner is decided once, in one place, by the stack
   * itself.
   *
   * Kind is 'thing' only when a thing is underfoot and no want is — the same
   * want-beats-thing rule commitCursorManTo already applies to what the panel
   * itself shows. Everywhere else this offer is standing in for a want: the
   * canvas want case, and the list, where the only target there is one.
   */
  const detailKind: CanvasActorKind = (canvasMode && !cursorFocusedWantId && cursorFocusedThingId) ? 'thing' : 'want';
  setCanvasActor('detailPanel', canOpenDetails ? {
    kind: detailKind,
    actions: { [CANVAS_ACTIONS.CONFIRM]: () => { openCanvasDetails(); return true; } },
  } : null);
  /**
   * The canvas already has one shared Confirm dispatcher — useBoardNavigation's
   * `onConfirm: () => runCanvasAction(CANVAS_ACTIONS.CONFIRM)` — so canvas mode
   * needs nothing here; that binding alone reaches this hook's action above
   * through the stack. This listener exists only for the list, which has no
   * canvas actor stack of its own to arbitrate (nothing else there registers
   * as an actor) but still asks the same one question the same one way,
   * rather than a second, parallel way of deciding to open the panel.
   * `enabled` excludes canvasMode so the same press is never dispatched
   * through runCanvasAction twice.
   */
  useInputActions({
    enabled: canOpenDetails && !canvasMode,
    onConfirm: () => { runCanvasAction(CANVAS_ACTIONS.CONFIRM); },
    // The sidebar guard would suppress this whenever DOM focus happens to sit
    // inside the open panel — which on the roomier layouts it often does, since
    // the panel opens by itself when you land on a tile — and then Enter, whose
    // whole job is to hand that panel the keys, would have been dropped before
    // reaching this handler.
    //
    // `inputHandedOver` is the authority on who owns input here — the same one
    // the greying-out reads, and derived rather than announced. So gate on that
    // and not on where focus physically is. ignoreWhenInputFocused stays on, so
    // Enter in a text field still belongs to the field.
    ignoreWhenInSidebar: false,
  });

  /**
   * The minimap holding the keys: arrows drive the camera, B/Escape hands them
   * back. The character does not move — that is the point of the state, and it
   * falls out of WantCanvas's canvasFocused being false while it is on.
   *
   * Bound here rather than in WantMinimap because what an arrow moves is the
   * CAMERA, which lives in WantCanvas, and this is where that ref is held. The
   * minimap draws the frame and binds nothing but the way out.
   *
   * No onConfirm — A does nothing in this state. Binding it would claim the
   * exclusive capture slot for a handler that ignores A, which swallows every A
   * press app-wide (the failure WantMinimap's own comment records).
   */
  useInputActions({
    enabled: minimapFocused,
    captureInput: true,
    onNavigate: (dir) => {
      if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') {
        apiRef.current.wantCanvasRef.current?.panCamera(dir);
      }
    },
    /**
     * Done panning. On a phone that also means the map has finished its job and
     * is in the way of what it was used to find: it closes, and the board — with
     * the destination marked on it and the question about it — is what is left.
     * See handleMinimapMapClick, which is the same ending reached by tapping.
     */
    onCancel: handBackFromMinimap,
  });

  // Whether the detail sheet/panel is on screen. Named because two things read
  // it: the panel itself, and the phone's corner card, which exists only for as
  // long as this is false — see CanvasFocusFloatCard.
  const detailPanelOpen = (sidebar.showGlobal
    || addingThing
    || !!editingThing
    || !!cursorGroupShown
    || ((!!selectedWant || !!cursorThingRecord)
        && (!isMobileLayout
            || detailsAskedFor(selectedWant?.metadata?.id || selectedWant?.id)
            || detailsAskedFor(cursorThingRecord?.id))))
    // A board under review is a question about the board, and on a phone this
    // sheet IS the screen — leaving it up would ask the user to approve
    // something they cannot see. It stands aside for the length of the review
    // and comes back on its own, which is why this reads a state rather than
    // being closed and reopened by hand. Wide enough to show both and it simply
    // stays, greyed, behind the question. See canvasReviewStore.
    && !(isMobileLayout && canvasUnderReview);

  return {
    cursorThingRecord,
    cursorGroupShown,
    hasCanvasDetailTarget,
    listFocusedWantId,
    hasListDetailTarget,
    openCanvasDetails,
    detailSidebarOnScreen,
    detailPanelOpen,
  };
}
