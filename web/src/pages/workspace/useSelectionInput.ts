import { useRef } from 'react';
import { Want } from '@/types/want';
import { atCell } from '@/utils/cellOf';
import { CANVAS_ACTIONS, runCanvasAction } from '@/stores/canvasActorStack';
import { useCanvasActor } from '@/hooks/useCanvasActor';
import { useInputActions } from '@/hooks/useInputActions';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useWantStore } from '@/stores/wantStore';
import type { BoardHandle } from './boardLink';
import type { WantFormHandle } from '@/components/forms/WantForm';

export type FormSituation = 'closed' | 'type-selection' | 'fields' | 'select-mode' | 'batch-action';

/**
 * Confirm, cancel, and "what else can I do with this".
 *
 * The three presses that mean something wherever you are — A/Enter, B/Escape,
 * and Start — and the one rule that decides what they act on: whatever is
 * currently the subject. That is the type picker while the form is choosing a
 * type, the ticked wants in select mode, the tile underfoot on the board, and
 * the selected card otherwise.
 *
 * Escape is the interesting one. It is a stack, unwound in the order things
 * were put on it — the rotation guide, then a carried tile, then a maximised
 * card, then a confirmation, then the batch bar, then an open balloon, then
 * select mode, then the selection, then the form. Each layer returns rather
 * than falling through, so one press undoes exactly one thing.
 */
export interface SelectionInputApi {
  canvasMode: boolean;
  isCanvasDragging: boolean;
  isSelectMode: boolean;
  setIsSelectMode: (on: boolean) => void;
  formSituation: FormSituation;
  setFormSituation: (s: FormSituation) => void;
  selectedWant: Want | null;
  selectedWantIds: Set<string>;
  setSelectedWantIds: (ids: Set<string>) => void;
  setLastSelectedWantId: (id: string | null) => void;
  maximizedWantId: string | null;
  /** The open balloon's ancestry; Escape shuts it before the selection. */
  expandedChain: Want[];
  setExpandedChain: (chain: Want[]) => void;
  showBatchConfirmation: boolean;
  setShowBatchConfirmation: (v: boolean) => void;
  batchFocusIdx: number;
  setBatchFocusIdx: React.Dispatch<React.SetStateAction<number>>;
  setBatchAction: (a: 'start' | 'stop' | 'delete' | null) => void;

  sidebar: { showForm: boolean; closeForm: () => void; clearSelection: () => void };
  wantFormRef: React.RefObject<WantFormHandle>;
  wantCanvasRef: React.RefObject<BoardHandle>;
  isCanvasDraggingRef: React.MutableRefObject<boolean>;
  setIsCanvasDragging: (on: boolean) => void;
  cursorManPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  cursorManFocusedWantIdRef: React.MutableRefObject<string | null>;

  /** Surfaces that bind Start for themselves and must not be talked over. */
  characterBubbleOpen: boolean;
  arrangeReviewOpen: boolean;
  inputHandedOver: boolean;
  openCharacterBubble: () => void;

  onCloseModals: () => void;
  onSelectWant: (id: string) => void;
  /** The same tick, on the other kind of tile. */
  onSelectThing?: (id: string) => void;
  onMaximizeChange: (id: string | null) => void;
}

const BATCH_ACTIONS = ['start', 'stop', 'delete'] as const;

export function useSelectionInput(api: SelectionInputApi) {
  const {
    canvasMode, isCanvasDragging, isSelectMode, formSituation, selectedWant,
    maximizedWantId, expandedChain, characterBubbleOpen, arrangeReviewOpen,
    inputHandedOver, sidebar,
  } = api;

  const apiRef = useRef(api);
  apiRef.current = api;

  // ============================================================
  // Input priority model:
  //   captureInput — type-selection, header menu, card overlays, canvas drag
  //     > default broadcast
  //         keyboard: blocked by ignoreWhenInSidebar when sidebar has focus
  //         gamepad:  all listeners fire; guards apply
  //
  // When formSituation === 'type-selection' this owns ALL directional input
  // (keyboard capture + gamepad exclusive) so the routing decision is made
  // here, from the page's own state, not WantForm's render cycle.
  // ============================================================

  // Type-selection: capture arrow keys from any focus state (including INPUT)
  // and route directly to the inventory picker via WantForm's imperative handle.
  useInputActions({
    enabled: formSituation === 'type-selection',
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onNavigate:    (dir) => { if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') apiRef.current.wantFormRef.current?.navigateInventory(dir); },
    onConfirm:     ()    => { apiRef.current.wantFormRef.current?.confirmInventory(); },
    onCancel:      ()    => { apiRef.current.onCloseModals(); },
    onContextMenu: ()    => { apiRef.current.wantFormRef.current?.showInventoryContextMenu(); },
  });

  // Select-mode: Enter/Space/Gamepad A toggles the checkbox on the tile
  // underfoot — whichever kind of tile that is.
  //
  // The want first, then the thing, because that is the order the rest of the
  // board resolves them in: a thing loses the panel to a want it shares a cell
  // with (see useCursorManController's focusedThing), so it should lose the
  // tick to one too. Standing on a thing alone was simply unanswered before —
  // the mouse could tick it and Enter could not, which is the sort of gap a
  // player reads as the thing not being selectable at all.
  //
  // List mode: handled via useHierarchicalKeyboardNavigation onConfirm.
  // Escape/B button is handled by useEscapeKey below.
  //
  // Through the actor stack, not as a bare binding. Confirm on the board is
  // contested — a want under the character answers it by opening its detail,
  // a thing by opening its own — and the stack is what ranks those ('mode'
  // above 'want' above 'thing'). Bound plainly, this was one more listener
  // among them: standing on a thing, Enter went to the thing's own actor and
  // opened its panel, which is exactly the press select mode needed. Select
  // mode is a mode, so it says so and outranks them, the way Z and aim do.
  // useCanvasActor, not setCanvasActor: registering an actor only says where a
  // press would RANK — it binds nothing, and something else has to dispatch
  // through the stack for a ranking to matter. On the board that dispatcher is
  // useBoardNavigation's `onConfirm: runCanvasAction(CONFIRM)`, and it is
  // `enabled: canvasMode && formSituation === 'closed'` — so in select mode,
  // whose whole existence is formSituation !== 'closed', NOTHING dispatches.
  // Written as a bare registration this was therefore a correct ranking with
  // no press ever arriving to be ranked, and Enter went dead.
  //
  // So select mode carries its own binding. No double-fire: the shared
  // dispatcher is off for exactly the situations this covers. The 'mode' kind
  // still earns its keep against the other modes — Z, aim, throw — which can
  // be held while select mode is on, and which the guard below arbitrates
  // between.
  useCanvasActor(
    'selectMode',
    formSituation === 'select-mode' && canvasMode ? 'mode' : null,
    { [CANVAS_ACTIONS.CONFIRM]: () => { tickUnderfoot(); return true; } },
    { enabled: formSituation === 'select-mode' && canvasMode },
  );

  function tickUnderfoot() {
      const a = apiRef.current;
      const wantId = a.cursorManFocusedWantIdRef.current;
      if (wantId) { a.onSelectWant(wantId); return; }
      // Asked of the board at press time — "what thing is on my cell?" —
      // rather than read off the focus bookkeeping. That bookkeeping is
      // recomputed when the character MOVES, so a thing that arrived under a
      // standing character (slid there, or was placed there) was not in it,
      // and Enter had nothing to tick. The cell is the question; the board can
      // answer it whenever it is asked.
      const me = a.cursorManPosRef.current;
      if (!me) return;
      const things = a.wantCanvasRef.current?.getThingPositions?.();
      if (!things) return;
      for (const [id, p] of things) {
        if (atCell(p, me.x, me.y)) { a.onSelectThing?.(id); return; }
      }
  }

  const handleEscapeKey = () => {
    const a = apiRef.current;
    if (a.wantCanvasRef.current?.isRotationGuideActive()) {
      a.wantCanvasRef.current.exitRotationGuide();
      return;
    }
    if (a.isCanvasDraggingRef.current) {
      a.isCanvasDraggingRef.current = false;
      a.setIsCanvasDragging(false);
      a.wantCanvasRef.current?.cancelKeyboardDrag();
      return;
    }
    // If a card is maximized/expanded, collapse it first before deselecting.
    if (a.maximizedWantId) { a.onMaximizeChange(null); return; }
    if (a.showBatchConfirmation) a.setShowBatchConfirmation(false);
    else if (a.formSituation === 'batch-action') { a.setFormSituation('select-mode'); }
    else if (a.expandedChain.length > 0) a.setExpandedChain([]);
    // Select mode: Escape always exits immediately (before clearing selectedWant)
    else if (a.isSelectMode) { a.setSelectedWantIds(new Set()); a.setIsSelectMode(false); a.setFormSituation('closed'); }
    else if (a.selectedWant) {
      a.setLastSelectedWantId(a.selectedWant.metadata?.id || a.selectedWant.id || null);
      a.sidebar.clearSelection();
    }
    // The same close B makes (onCancel above), not a bare closeForm.
    //
    // Closing the panel and leaving formSituation where it was is a trap with
    // no way out: the board's Confirm dispatcher and the detail panel's own
    // offer are both gated on it being 'closed', so an Add Want dismissed with
    // Escape left every tile on the board unable to answer Enter — for the
    // rest of the session, with nothing on screen to say why.
    else if (a.sidebar.showForm) a.onCloseModals();
  };
  useEscapeKey({
    onEscape: handleEscapeKey,
    enabled: !!selectedWant || sidebar.showForm || isSelectMode
      || formSituation === 'batch-action' || expandedChain.length > 0
      || isCanvasDragging || !!maximizedWantId,
  });

  // Context menu (Shift+Enter / Gamepad Start)
  // In select-mode with selections → batch-action overlay; on a want tile →
  // that card's QuickActions; on empty canvas ground → the character bubble.
  useInputActions({
    // Not while the detail panel has the keys. This is the page's answer to
    // Shift+Enter and it names the *selected want* — so with focus down in the
    // panel's field cards it opened the want card's actions over the top of
    // the field whose actions were being asked for. Every other page-level
    // binding already stands down here (see useDashboardNav, useGridFocus);
    // this one was written before that was a rule and never joined it.
    enabled: !characterBubbleOpen && !arrangeReviewOpen && !inputHandedOver, // the bubble binds its own Start-to-close
    onContextMenu: () => {
      // Whoever the press is really about answers first — an open detail panel
      // outranks the tile underfoot (CANVAS_ACTIONS.CONTEXT_MENU). Everything
      // below is the BOARD's reading of Start, which is what is left when the
      // stack has nothing to show.
      if (runCanvasAction(CANVAS_ACTIONS.CONTEXT_MENU)) return;
      const a = apiRef.current;
      if (a.isSelectMode && a.selectedWantIds.size > 0) {
        a.setBatchFocusIdx(0);
        a.setFormSituation('batch-action');
        return;
      }
      const id = a.selectedWant?.metadata?.id || a.selectedWant?.id;
      if (!id) {
        a.openCharacterBubble();
        return;
      }
      // selectedWant is sidebar selection, not canvas focus: it survives on
      // empty ground when the selection came from a click/grid/minimap, or in
      // select mode. cursorManFocusedWantIdRef is the actual tile underfoot.
      if (a.canvasMode && a.cursorManPosRef.current && a.cursorManFocusedWantIdRef.current === null) {
        a.openCharacterBubble();
        return;
      }
      const { quickActionsWantId, setQuickActionsWantId } = useWantStore.getState();
      setQuickActionsWantId(quickActionsWantId === id ? null : id);
    },
  });

  // Batch-action mode: Left/Right navigate Start/Stop/Delete; Enter confirms; Escape/Select returns
  useInputActions({
    enabled: formSituation === 'batch-action',
    captureInput: true,
    onNavigate: (dir) => {
      const a = apiRef.current;
      if (dir === 'left')  a.setBatchFocusIdx(i => (i + 2) % 3);
      if (dir === 'right') a.setBatchFocusIdx(i => (i + 1) % 3);
    },
    onTabForward: () => {
      apiRef.current.setBatchFocusIdx(i => (i + 1) % 3);
    },
    onTabBackward: () => {
      apiRef.current.setBatchFocusIdx(i => (i + 2) % 3);
    },
    onConfirm: () => {
      const a = apiRef.current;
      const action = BATCH_ACTIONS[a.batchFocusIdx];
      if (!action || a.selectedWantIds.size === 0) return;
      a.setBatchAction(action);
      a.setShowBatchConfirmation(true);
      a.setFormSituation('select-mode');
    },
    onCancel: () => { apiRef.current.setFormSituation('select-mode'); },
    onMenuToggle: () => { apiRef.current.setFormSituation('select-mode'); },
  });
}
