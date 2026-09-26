import { useCallback, useEffect, useRef } from 'react';
import { Want } from '@/types/want';
import { apiClient } from '@/api/client';
import { send } from '@/api/outbox';
import { onSSEReconnect } from '@/api/sseClient';
import { useSSEEvent } from '@/hooks/useSSEEvent';
import { applicable } from '@/stores/guiStateSync';
import { getExt } from '@/utils/ext';
import { claimLocal } from '@/stores/guiStateSync';
import { useCharacterStore } from '@/stores/characterStore';
import { useGuiStateFlushStore } from '@/stores/guiStateFlushStore';
import type { BoardHandle } from './boardLink';
import type { WantFormHandle } from '@/components/forms/WantForm';

export type FormSituation = 'closed' | 'type-selection' | 'fields' | 'select-mode' | 'batch-action';
export type SidebarTab = 'settings' | 'results' | 'wiring' | 'expose' | 'import' | 'history' | 'versions' | 'chat';

/**
 * The one conversation with /api/v1/gui/state.
 *
 * Which want the panel is on, where this character stands, how far the board is
 * zoomed, what phase the Add Want form is in — all of it is shared state, kept
 * on the server so a second tab, a phone, or the CLI sees the same workspace.
 * Reading it and writing it back are two halves of one problem and used to be
 * three hundred lines apart.
 *
 * The hard part is not the requests; it is deciding, for each key, whether the
 * snapshot that just arrived is newer than what this tab already knows. Three
 * different answers are in use and each is written out where it applies:
 * round-trip agreement (`lastAcked*`), recency (`selectedWantChangedAtRef`),
 * and plain ownership (`standingOnWant`).
 */
export interface GuiStateSyncApi {
  /** The wants this tab knows about, for resolving a persisted selection. */
  wants: Want[];
  /** The right-hand panel, which this both reads from and drives. */
  sidebar: {
    selectedItem: Want | null;
    showForm: boolean;
    showGlobal: boolean;
    selectItem: (w: Want) => void;
    clearSelection: () => void;
    openForm: () => void;
    toggleGlobal: () => void;
  };

  // — live values the write-back sends —
  canvasMode: boolean;
  canvasScale: number;
  canvasCenterX: number | undefined;
  canvasCenterY: number | undefined;
  cursorManPos: { x: number; y: number } | null;
  maximizedWantId: string | null;
  formSituation: FormSituation;
  sidebarInitialTab: SidebarTab;
  myCharacterId: string | null;

  // — the same values read from the poll's async body —
  canvasModeRef: React.MutableRefObject<boolean>;
  cursorManPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  canvasCenterXRef: React.MutableRefObject<number | undefined>;
  canvasCenterYRef: React.MutableRefObject<number | undefined>;
  canvasScaleRef: React.MutableRefObject<number>;
  myCharacterIdRef: React.MutableRefObject<string | null>;
  /** The tile underfoot — the board owns the panel while this is set. */
  cursorManFocusedWantIdRef: React.MutableRefObject<string | null>;

  // — refs shared with the rest of the workspace —
  /** Whether the first snapshot has landed. Nothing is placed or written before it. */
  hasSyncedGuiStateRef: React.MutableRefObject<boolean>;
  /** A form opened from a seed suppresses the one-time selection restore. */
  suppressWantRestoreRef: React.MutableRefObject<boolean>;
  /** Restore-point for the next canvas entry. */
  initCursorManPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  hasLoadedCharacterViewportRef: React.MutableRefObject<boolean>;
  /** Wants known before a create, so the new one can be recognised. */
  prevWantIdsRef: React.MutableRefObject<Set<string>>;
  /** Where a want created from the CLI-opened form should land. */
  pendingCanvasPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  wantCanvasRef: React.RefObject<BoardHandle>;
  wantFormRef: React.RefObject<WantFormHandle>;

  // — what an arriving snapshot is allowed to change —
  setCursorManPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  setCanvasScale: (s: number) => void;
  clampScale: (s: number) => number;
  setMaximizedWantId: (id: string | null) => void;
  setFormSituation: (s: FormSituation) => void;
  setIsSelectMode: (on: boolean) => void;
  setFocusGlobalParamKey: (k: string | null) => void;
  setSidebarInitialTab: (t: SidebarTab) => void;
  setSidebarTabVersion: React.Dispatch<React.SetStateAction<number>>;
  setInitialFormTypeId: (id: string | undefined) => void;
  setInitialFormItemType: (t: 'want-type' | 'recipe') => void;
  setOwnerWant: (w: Want | null) => void;

  /** Middle of the board, for a character with nowhere remembered to stand. */
  canvasMiddle: () => { x: number; y: number };
  /** Bring a want into view after a remote selection. */
  focusWantInDashboard: (wantId: string, smooth?: boolean) => void;
}

export function useGuiStateSync(api: GuiStateSyncApi) {
  const { wants, sidebar } = api;

  // Everything else is read through the mirror: the poll body runs long after
  // the render that created it, and several of these are defined below the
  // call site.
  const apiRef = useRef(api);
  apiRef.current = api;

  // GUI state sync via /api/v1/gui/state.
  // Each tab tracks its own lastSeqRef. When the server seq advances, apply the new state.
  // This enables multi-tab sync: all tabs independently notice the seq change and apply it.
  const lastGuiSeqRef = useRef<number>(0);
  const isIncomingRef = useRef(false);
  const lastSyncedStateRef = useRef<Record<string, any>>({});
  // The state object this tab most recently sent to the server. Read by both
  // the write-back effect (to skip redundant writes) and pollGUIState (to
  // recognise its own in-flight write and not be reverted by a poll that
  // predates it).
  const lastWriteRef = useRef<Record<string, any>>({});

  const lastGuiETagRef = useRef<string | undefined>(undefined);

  // Cursor-dirty guard: tracks the last cursor position acknowledged by the server.
  // When the local cursor has moved ahead of this (i.e. the user is dragging and the
  // debounce hasn't fired yet), incoming server cursor values are ignored so the
  // dragged position is never overwritten by a stale server state triggered by an
  // unrelated field write from another tab.
  const lastAckedCursorPosRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * The same guard for the zoom, for exactly the same reason.
   *
   * The saved scale used to be applied on every state arrival, and state
   * arrives constantly — a cursor moving, a want ticking. Zooming writes back
   * on a debounce, so any of those updates in the gap carried the OLD scale and
   * stamped it over the one just set by the wheel: the board snapped back a
   * step and the readout, honestly, reported the snapped-back value. Incoming
   * scale is ignored while the local one is ahead of the last round-trip.
   */
  const lastAckedScaleRef = useRef<number | null>(null);
  /**
   * And the same guard again for which want the panel is on.
   *
   * Selecting a want writes back, but a poll issued before that write landed
   * still carries the PREVIOUS want, and it arrives with a seq this tab has not
   * seen — so the `seq <= lastGuiSeq` check waves it through and it re-selects
   * the tile the character just stepped off. The panel then ran one tile behind:
   * walk from a robot to the tile next door and it kept showing the robot, walk
   * back and it showed the neighbour. Incoming selection is ignored while the
   * local one is ahead of the last round-trip, exactly as for the cursor above.
   *
   * null until the first write acks, so a reload still restores the saved
   * selection; once local and acked agree, a genuine remote/CLI selection
   * applies as before.
   */
  const lastAckedSidebarWantRef = useRef<string | null>(null);
  /** The selection as this tab knows it, readable from the poll's async body. */
  const selectedWantIdRef = useRef<string>('');
  /**
   * When this tab last changed the selection itself.
   *
   * `standingOnWant` says the board's own choice outranks the server's, and
   * gives the reason: only this tab walks this character, so a landing is the
   * most recent word and any `sidebar_*` the server can offer was written
   * before it. Picking a card off the list is the same act by a different
   * hand — and had no such guard, so it lost to the poll exactly as walking
   * used to. Measured: a click, the ring arriving 870ms later, and gone again
   * 505ms after that, with no pointer event anywhere near the disappearance.
   *
   * Round-trip bookkeeping cannot fix it, for the reason written below: a write
   * is acked the moment it lands, which marks this tab in sync while responses
   * read from BEFORE it are still on their way back. So the answer is the same
   * one the board got — recency, not agreement.
   */
  const selectedWantChangedAtRef = useRef(0);
  /** The last (want, tab) applied from a snapshot, so a repeat does not re-yank. */
  const lastAppliedSidebarTabRef = useRef<string>('');
  useEffect(() => {
    const next = sidebar.selectedItem?.metadata?.id ?? '';
    if (next !== selectedWantIdRef.current) selectedWantChangedAtRef.current = Date.now();
    selectedWantIdRef.current = next;
  }, [sidebar.selectedItem]);

  // CLI-driven form control: track previous server values so we only react
  // when the value actually changes (eTag-based, no nonces needed).
  // On first poll we establish a baseline without processing — this prevents
  // stale server state from opening the form on page reload.
  const prevCliAddFormOpenRef = useRef<boolean | undefined>(undefined);
  const prevCliAddFormTypeRef = useRef<string | undefined>(undefined);
  const cliFormStateInitializedRef = useRef<boolean>(false);

  const pollGUIState = useCallback(async () => {
    const a = apiRef.current;
    try {
      const { data, etag } = await apiClient.getGUIStateConditional(lastGuiETagRef.current);
      if (etag) lastGuiETagRef.current = etag;
      if (!data) return; // 304 — nothing changed
      const { seq, state: raw } = data;
      if (seq <= lastGuiSeqRef.current) return;

      // What of this snapshot is the server's to say.
      //
      // Anything this tab has changed and is still waiting to have confirmed is
      // dropped here, once, for every key alike — so the branches below no
      // longer each need their own answer to "but what if the user just did
      // something". They read a key that is absent as "the server has nothing
      // to say about this", which is exactly what it means. A key returns to
      // the server the moment the server agrees with it — see
      // stores/guiStateSync.
      const cur = applicable(raw) as typeof raw;

        // Set flag to prevent this incoming change from triggering a write-back
        isIncomingRef.current = true;
        lastGuiSeqRef.current = seq;
        // The raw snapshot, not the filtered view: this is what the
        // write-back compares against to decide whether anything changed.
        lastSyncedStateRef.current = raw;

        // Compute own character ID once — used for all per-character key lookups below
        const ownCharId = useCharacterStore.getState().myCharacterId;

        // First state to arrive: this is when a reload can finally place the
        // character where it was left. The canvas-mode effect deliberately
        // skipped placement because on a /canvas reload it runs before any of
        // this is known.
        const isFirstSync = !a.hasSyncedGuiStateRef.current;
        a.hasSyncedGuiStateRef.current = true;
        if (isFirstSync && a.canvasModeRef.current && a.cursorManPosRef.current === null) {
          const sx = ownCharId ? cur[`canvas_cursor_x_${ownCharId}`] : cur['canvas_cursor_x'];
          const sy = ownCharId ? cur[`canvas_cursor_y_${ownCharId}`] : cur['canvas_cursor_y'];
          const restored = (typeof sx === 'number' && typeof sy === 'number')
            ? { x: sx, y: sy }
            : a.canvasMiddle();
          a.setCursorManPos(restored);
          a.wantCanvasRef.current?.syncCursorManPos(restored);
        }

        // Apply canvas scale & position — per-character keys take precedence
        {
          // Scale only. The saved CAMERA CENTRE is deliberately not restored:
          // the character's own position is restored just below, and the canvas
          // opens on the character, so a second remembered viewpoint could only
          // disagree with it. It did — the centre re-applies whenever the canvas
          // bounds shift, which happens as wants finish loading, so it landed
          // after the open-on-character scroll and pulled the view off the
          // character every time. One remembered place is enough, and it should
          // be where you are.
          // Under ext.canvas since the view became the canvas's own; the flat
          // key is what a server that has not been written to since holds.
          const scaleKey = ownCharId ? `canvas_scale_${ownCharId}` : 'canvas_scale';
          const extScale = getExt(cur.ext, 'canvas', ownCharId ?? '_', 'scale');
          const savedScale = (typeof extScale === 'number' ? extScale : cur[scaleKey]) as number | undefined;
          if (savedScale !== undefined && savedScale > 0) {
            const acked = lastAckedScaleRef.current;
            const localDirty = acked !== null && a.canvasScaleRef.current !== acked;
            if (!localDirty) {
              lastAckedScaleRef.current = savedScale;
              // Within this device's zoom range: a scale saved on a desktop (or
              // before the phone's floor was raised) must not come back further
              // out than this screen is allowed to go.
              a.setCanvasScale(a.clampScale(savedScale));
            }
            a.hasLoadedCharacterViewportRef.current = true;
          }
        }
        // Restore CursorMan position — per-character keys, so a different
        // character (another browser session, or a CLI/background-agent
        // driven character) can never clobber this one's saved position.
        const cursorXKey = ownCharId ? `canvas_cursor_x_${ownCharId}` : 'canvas_cursor_x';
        const cursorYKey = ownCharId ? `canvas_cursor_y_${ownCharId}` : 'canvas_cursor_y';
        const savedCursorX = cur[cursorXKey] as number | undefined;
        const savedCursorY = cur[cursorYKey] as number | undefined;
        if (savedCursorX !== undefined && savedCursorY !== undefined) {
          // Update restore-point so it's available on next canvas-mode entry
          a.initCursorManPosRef.current = { x: savedCursorX, y: savedCursorY };
          // Live sync (same-device multi-window): apply to active canvas cursor
          const newPos = { x: savedCursorX, y: savedCursorY };
          console.debug('[CursorSync] poll received', { seq, x: savedCursorX, y: savedCursorY });
          a.setCursorManPos(prev => {
            if (prev === null) { console.debug('[CursorSync] skip: not in canvas mode'); return prev; }
            if (prev.x === savedCursorX && prev.y === savedCursorY) { console.debug('[CursorSync] skip: same pos'); return prev; }
            // Dirty guard: local cursor is still moving ahead of last server-ack, skip.
            const acked = lastAckedCursorPosRef.current;
            if (acked !== null && (prev.x !== acked.x || prev.y !== acked.y)) {
              console.debug('[CursorSync] skip: local cursor is dirty (ahead of last ack)', { prev, acked });
              return prev;
            }
            console.debug('[CursorSync] applying', newPos);
            a.wantCanvasRef.current?.syncCursorManPos(newPos);
            return newPos;
          });
        }

        // Apply maximized want card — per-character
        const savedExpandedWantId = cur[ownCharId ? `expanded_want_id_${ownCharId}` : 'expanded_want_id'] as string | undefined;
        if (savedExpandedWantId !== undefined) {
          a.setMaximizedWantId(savedExpandedWantId || null);
        }

        // Apply form situation — per-character
        // formSituation decides which useInputActions hook exclusively captures
        // input (the type-selection handler vs WantForm's fields handler), so a
        // stale value here does not just look wrong — it routes button presses
        // to the wrong component. Local state is authoritative while a write of
        // ours is still in flight: applying a poll that predates it would revert
        // a transition the user already made and hand capture back to the wrong
        // phase.
        //
        // Only skip the value we ourselves last wrote. Anything genuinely
        // different is a real remote change (another tab, or the CLI driving
        // the form) and is applied as before.
        const formSituationKey = ownCharId ? `form_situation_${ownCharId}` : 'form_situation';
        const savedFormSituation = cur[formSituationKey] as string | undefined;
        const inFlightFormSituation =
          (lastWriteRef.current as Record<string, unknown>)[formSituationKey];
        const formSituationIsStale =
          inFlightFormSituation !== undefined && savedFormSituation !== inFlightFormSituation;
        // A form phase with no form is a contradiction, and not a harmless one.
        //
        // 'fields' and 'type-selection' say WantForm is on screen and owns the
        // keys; both the board's Confirm dispatcher and a tile's own offer are
        // gated on the phase being 'closed'. So a phase left behind by a form
        // that is not there silences Enter on every tile — and because the
        // phase is persisted per character, it silences it across reloads, on
        // every device, with nothing on screen to say why and no press that
        // can clear it.
        //
        // Whether the form is open is a fact this side can see, so it decides.
        const formIsOpen = a.sidebar.showForm;
        const restored = (!formIsOpen && (savedFormSituation === 'fields' || savedFormSituation === 'type-selection'))
          ? 'closed'
          : savedFormSituation;
        if (!formSituationIsStale && (restored === 'type-selection' || restored === 'fields' || restored === 'closed' || restored === 'select-mode' || restored === 'batch-action')) {
          a.setFormSituation(restored as FormSituation);
          if (restored === 'select-mode' || restored === 'batch-action') a.setIsSelectMode(true);
          else a.setIsSelectMode(false);
        }

        // Open Global sidebar (CLI-driven: mywant-gui show global)
        const openGlobalSidebar = cur['open_global_sidebar'] as boolean | undefined;
        const focusGlobalKey = cur['focus_global_param_key'] as string | undefined;
        if (openGlobalSidebar) {
          if (!a.sidebar.showGlobal) a.sidebar.toggleGlobal();
          if (focusGlobalKey) {
            a.setFocusGlobalParamKey(focusGlobalKey);
            setTimeout(() => a.setFocusGlobalParamKey(null), 800);
          }
        }

        // Apply sidebar state — per-character
        const sidebarOpen = cur[ownCharId ? `sidebar_open_${ownCharId}` : 'sidebar_open'] as boolean | undefined;
        const sidebarWantId = cur[ownCharId ? `sidebar_want_id_${ownCharId}` : 'sidebar_want_id'] as string | undefined;
        const sidebarTab = cur[ownCharId ? `sidebar_active_tab_${ownCharId}` : 'sidebar_active_tab'] as string | undefined;
        /**
         * The board owns this character's panel while it is standing on a tile.
         *
         * Not a race guard — a statement about who decides. Only this tab walks
         * this character, so a landing is the most recent word on what the panel
         * is for, and any `sidebar_*` the server can offer was written before it.
         * Read literally, a poll that predates the landing shut a panel the
         * character was still standing on, a second or two after arriving; the
         * step-off/step-on of walking across two adjacent tiles writes exactly
         * the `open:false` that comes back to close the panel behind you.
         *
         * Round-trip bookkeeping cannot fix that. A write is acked the moment it
         * lands, which marks this tab "in sync" while responses read from before
         * it are still on their way back — so the panel is at its most vulnerable
         * exactly when it has just been opened.
         *
         * Standing on nothing hands the panel back: a remote close, or a CLI
         * `show want`, then applies as it always did.
         */
        const standingOnWant = a.canvasModeRef.current && a.cursorManFocusedWantIdRef.current !== null;
        // Long enough to outlast the responses already in flight when the
        // choice was made — a couple of poll cycles — and short enough that a
        // genuine remote change (another tab, `mywant gui show want`) still
        // lands a moment later rather than being lost.
        const justChosenHere = Date.now() - selectedWantChangedAtRef.current < 4000;
        // Local selection ahead of what this tab and the server last agreed on:
        // the poll read the server before the local change got there, so its
        // selection is stale and must not be applied. See lastAckedSidebarWantRef.
        //
        // Every branch that does NOT skip records the agreement, including the
        // ones that apply nothing — leaving the mark unset anywhere means the
        // next poll finds "never agreed", reads that as "not ahead", and is free
        // to act on stale state.
        const ackedSidebarWant = lastAckedSidebarWantRef.current;
        const sidebarLocallyDirty =
          ackedSidebarWant !== null && selectedWantIdRef.current !== ackedSidebarWant;
        if (standingOnWant) {
          // nothing: the tile underfoot is what the panel is for
        } else if (justChosenHere) {
          // nothing: this tab has just said what the panel is for, and no
          // snapshot the server can hand back was read after that
        } else if (sidebarLocallyDirty) {
          // nothing: the panel is already on the want this tab chose
        } else if (sidebarOpen && sidebarWantId && !a.suppressWantRestoreRef.current) {
          const target = a.wants.find(w => (w.metadata?.id === sidebarWantId) || (w.id === sidebarWantId));
          // Known even when it cannot be shown yet: the want may not be in this
          // tab's list, but the server's answer has been read either way.
          lastAckedSidebarWantRef.current = sidebarWantId;
          if (target) {
            a.sidebar.selectItem(target);
            const validTabs = ['settings', 'results', 'history', 'chat'] as const;
            type ValidTab = typeof validTabs[number];
            const tab = validTabs.includes(sidebarTab as ValidTab) ? sidebarTab as ValidTab : undefined;
            // Only (re)apply the tab when the persisted (want, tab) actually
            // changed — a genuine remote/CLI switch — so an unchanged poll never
            // yanks the user back to `results` after switching tabs locally.
            const tabKey = `${sidebarWantId}::${tab ?? ''}`;
            if (lastAppliedSidebarTabRef.current !== tabKey) {
              lastAppliedSidebarTabRef.current = tabKey;
              if (tab) a.setSidebarInitialTab(tab);
              a.setSidebarTabVersion(v => v + 1);
            }

            // Center the want in the dashboard if it's a new selection or explicitly requested via CLI.
            // This ensures synchronization across multiple tabs and from the CLI.
            const currentId = a.sidebar.selectedItem?.metadata?.id || a.sidebar.selectedItem?.id;
            const isNewSelection = sidebarWantId !== currentId;

            if (isNewSelection || cur['source'] === 'cli') {
              setTimeout(() => {
                apiRef.current.focusWantInDashboard(sidebarWantId);
              }, 100);
            }
          }
        } else if (sidebarOpen === false) {
          a.sidebar.clearSelection();
          lastAckedSidebarWantRef.current = '';
        } else {
          // The server has nothing to say about the panel yet (the key is absent,
          // or the restore is suppressed). Still an agreement — "shut, as far as
          // both of us know" — so the first local selection counts as ahead.
          lastAckedSidebarWantRef.current = '';
        }

        // CLI-driven Add Want form control (eTag-based: react on value change, no nonces).
        // add_form_open and add_form_type are idempotent state fields. When the form
        // closes, the browser writes add_form_open:false back to the server so that a
        // subsequent page reload sees the correct closed state.
        const cliAddFormOpen = cur['add_form_open'] as boolean | undefined;
        const cliAddFormType = cur['add_form_type'] as string | undefined;

        if (!cliFormStateInitializedRef.current) {
          // First poll: establish baseline from current server state, no processing.
          // This prevents leftover state from a previous session from reopening the form.
          cliFormStateInitializedRef.current = true;
          prevCliAddFormOpenRef.current = cliAddFormOpen;
          prevCliAddFormTypeRef.current = cliAddFormType;
        } else {
          // React only when value actually changes (CLI sent a new command).
          if (cliAddFormOpen === true && prevCliAddFormOpenRef.current !== true) {
            a.setInitialFormTypeId(undefined);
            a.setInitialFormItemType('want-type');
            a.setOwnerWant(null);
            a.sidebar.openForm();
            // Mirror handleCreateWant: place near the player's own character.
            // Use refs (not state) to avoid stale closure in this useCallback.
            const _px = a.cursorManPosRef.current?.x ?? a.canvasCenterXRef.current;
            const _py = a.cursorManPosRef.current?.y ?? a.canvasCenterYRef.current;
            if (_px !== undefined && _py !== undefined) {
              a.prevWantIdsRef.current = new Set(a.wants.map(w => w.metadata?.id || w.id || '').filter(Boolean));
              a.pendingCanvasPosRef.current = { x: Math.round(_px), y: Math.round(_py) };
            }
          }
          if (cliAddFormType && cliAddFormType !== prevCliAddFormTypeRef.current) {
            // Type was set by CLI — select it in the open form via imperative handle.
            if (a.sidebar.showForm) {
              a.wantFormRef.current?.selectType(cliAddFormType);
            }
          }
          prevCliAddFormOpenRef.current = cliAddFormOpen;
          prevCliAddFormTypeRef.current = cliAddFormType;
        }

        // Clear flag after React has had a chance to process the state updates
        setTimeout(() => {
          isIncomingRef.current = false;
        }, 100);
    } catch {
      // server may be temporarily unavailable
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wants, sidebar]);

  // The server broadcasts `gui_state` on every write; nobody was listening,
  // which is the only reason this was a poll. The mount read is what a reload
  // restores from.
  useEffect(() => { void pollGUIState(); }, []);
  useSSEEvent('gui_state', () => { void pollGUIState(); });
  useEffect(() => onSSEReconnect(() => { void pollGUIState(); }), []);

  // Combined GUI write-back effect.
  // Distinguishes between immediate actions (selection) and continuous ones (scale/pan).
  const guiWriteBackMountedRef = useRef(false);
  useEffect(() => {
    const a = apiRef.current;
    if (!guiWriteBackMountedRef.current) {
      guiWriteBackMountedRef.current = true;
      return;
    }

    const { canvasScale, canvasCenterX, canvasCenterY, cursorManPos, maximizedWantId,
            formSituation, sidebarInitialTab, canvasMode, myCharacterId } = a;

    // What we are about to send is what we will accept back.
    lastAckedScaleRef.current = canvasScale;
    // The board's own view — how far this character's camera is zoomed and
    // where it points. The canvas keeps it under ext.canvas.<character> (see
    // utils/ext): mywant stores it without reading it, and it merges, so two
    // characters' cameras never overwrite each other.
    //
    // Only from the board. The list page has no camera, and its still one
    // (workspace/boardLink) would write zoom 1 over the one you left.
    const vpKeys = canvasMode ? {
      ext: { canvas: { [myCharacterId ?? '_']: {
        scale:    canvasScale,
        center_x: a.canvasCenterXRef.current ?? canvasCenterX ?? null,
        center_y: a.canvasCenterYRef.current ?? canvasCenterY ?? null,
      } } },
    } : {};
    // The flat keys the view used to be kept under, cleared once they are
    // seen: what they held lives under ext now.
    const legacyVpKeys = myCharacterId
      ? [`canvas_scale_${myCharacterId}`, `canvas_center_x_${myCharacterId}`, `canvas_center_y_${myCharacterId}`, `canvas_mode_${myCharacterId}`]
      : ['canvas_scale', 'canvas_center_x', 'canvas_center_y', 'canvas_mode'];
    const legacyClear = Object.fromEntries(legacyVpKeys
      .filter(k => k in ((lastSyncedStateRef.current ?? {}) as Record<string, unknown>))
      .map(k => [k, null]));
    // Per-character focus keys — sidebar/card/form focus is independent per character
    const focusKeys = myCharacterId ? {
      [`sidebar_open_${myCharacterId}`]:       !!a.sidebar.selectedItem,
      [`sidebar_want_id_${myCharacterId}`]:    a.sidebar.selectedItem?.metadata?.id ?? '',
      [`sidebar_active_tab_${myCharacterId}`]: sidebarInitialTab,
      [`expanded_want_id_${myCharacterId}`]:   maximizedWantId ?? '',
      [`form_situation_${myCharacterId}`]:     formSituation,
    } : {
      sidebar_open:       !!a.sidebar.selectedItem,
      sidebar_want_id:    a.sidebar.selectedItem?.metadata?.id ?? '',
      sidebar_active_tab: sidebarInitialTab,
      expanded_want_id:   maximizedWantId ?? '',
      form_situation:     formSituation,
    };
    // Per-character cursor keys — each character's canvas position is independent,
    // so a different character's writes (another browser session, or a CLI/
    // background-agent driven character) never clobber this one's.
    const cursorKey = myCharacterId ? {
      x: `canvas_cursor_x_${myCharacterId}`,
      y: `canvas_cursor_y_${myCharacterId}`,
    } : { x: 'canvas_cursor_x', y: 'canvas_cursor_y' };
    const cursorKeys = {
      [cursorKey.x]: cursorManPos?.x ?? canvasCenterX ?? 0,
      [cursorKey.y]: cursorManPos?.y ?? canvasCenterY ?? 0,
    };
    const nextState = {
      ...focusKeys,
      ...legacyClear,
      ...vpKeys,
      ...cursorKeys,
    };

    // Never write before the first read. On a /canvas reload this effect runs
    // with default values (cursor at the board middle, sidebar shut) that were
    // never the user's — and because a first write counts as a discrete action
    // it goes out immediately, overwriting the saved position with the default
    // before the fetch that would have restored it even lands.
    if (!a.hasSyncedGuiStateRef.current) return;

    // Skip if state is identical to what we last wrote or what we just received from sync
    const isSameAsLastWrite = JSON.stringify(nextState) === JSON.stringify(lastWriteRef.current);
    const isSameAsSynced = JSON.stringify(nextState) === JSON.stringify(lastSyncedStateRef.current);
    if (isSameAsLastWrite || (isIncomingRef.current && isSameAsSynced)) return;

    // Selection or search query change: write IMMEDIATELY to "claim" the state
    const sidebarWantKey    = myCharacterId ? `sidebar_want_id_${myCharacterId}`  : 'sidebar_want_id';
    const sidebarOpenKey    = myCharacterId ? `sidebar_open_${myCharacterId}`     : 'sidebar_open';
    const expandedWantKey   = myCharacterId ? `expanded_want_id_${myCharacterId}` : 'expanded_want_id';
    const formSituationKey  = myCharacterId ? `form_situation_${myCharacterId}`   : 'form_situation';
    const isDiscreteAction =
      (nextState as Record<string, unknown>)[sidebarWantKey]  !== (lastWriteRef.current as Record<string, unknown>)[sidebarWantKey] ||
      (nextState as Record<string, unknown>)[sidebarOpenKey]  !== (lastWriteRef.current as Record<string, unknown>)[sidebarOpenKey] ||
      (nextState as Record<string, unknown>)[expandedWantKey] !== (lastWriteRef.current as Record<string, unknown>)[expandedWantKey] ||
      // formSituation drives which useInputActions hook exclusively captures
      // gamepad input (the type-selection hook vs WantForm's fields hook — see
      // WantForm's isTypeSelectionPhase). Until this ships to the server,
      // pollGUIState's periodic read-back can reapply the STALE prior value
      // (this key wasn't in this effect's dependency array at all, so a
      // formSituation-only change such as type-selection → fields never used
      // to trigger a write here), silently reverting the local transition and
      // handing gamepad capture back to the wrong phase's hook — which read
      // as "the confirm/tab-forward button does nothing" despite the UI
      // already showing the fields form. Treating it as discrete (immediate
      // write, no debounce) closes that race window.
      (nextState as Record<string, unknown>)[formSituationKey] !== (lastWriteRef.current as Record<string, unknown>)[formSituationKey];

    const performWrite = () => {
      // What we have asked for. This is the mark that makes a later run of the
      // effect skip an identical state, and it is set when the ASKING happens,
      // not when the server agrees — the two used to be the same moment, and
      // the write was rolled back out of here when it failed so the change
      // could be re-sent. Nothing needs rolling back now: the outbox does not
      // give up, so a change recorded here is one that will arrive.
      lastWriteRef.current = nextState;

      // An inactive cursor used to clear this character's saved position
      // (null means DeleteState server-side). It must not: these keys are the
      // board's memory of where this character stood, and stepping off the
      // board — going to the worlds page to switch, say — is not the same as
      // never having been on it. Clearing them here is what made a world
      // switch lose the position: the server restored it, and this wrote the
      // deletion straight back over it.
      //
      // Live presence does not depend on these. It is a separate channel with
      // a TTL (GET /api/v1/cursors, see handlers_cursors.go's hasLiveCursor),
      // so a character who stops publishing simply stops being live — nothing
      // has to be erased for that to happen.
      const serverPayload: Record<string, unknown> = { ...nextState, source: 'frontend' };
      if (cursorManPos === null) {
        delete serverPayload[cursorKey.x];
        delete serverPayload[cursorKey.y];
      }

      send('gui-state', 'view state', async () => {
        // The state may have arrived from elsewhere while this was queued.
        if (isIncomingRef.current && JSON.stringify(nextState) === JSON.stringify(lastSyncedStateRef.current)) return;
        // If-Match, so the server can reject a write made against a version
        // that has since moved on. Read at each attempt, not captured: a 412
        // corrects the baseline below, and the retry must use the corrected one.
        try {
          const { seq } = await apiClient.updateGUIState(serverPayload, lastGuiSeqRef.current);
          lastGuiSeqRef.current = seq;
          lastAckedSidebarWantRef.current =
            (nextState as Record<string, unknown>)[sidebarWantKey] as string;
          lastAckedCursorPosRef.current = cursorManPos !== null
            ? { x: cursorManPos.x, y: cursorManPos.y }
            : null;
        } catch (err: any) {
          // 412: another tab wrote between our last read and this write. Take
          // the server's version as the new baseline and let the outbox try
          // again with it — it counts 412 as "not now" rather than "no".
          if (err?.status === 412 && typeof err.serverSeq === 'number' && !isNaN(err.serverSeq)) {
            lastGuiSeqRef.current = err.serverSeq;
          }
          throw err;
        }
      });
    };

    // Claimed the moment the change happens, whatever kind of key it is and
    // whenever the write actually goes out. This is what stops a reply that
    // was already in flight from overwriting it — see stores/guiStateSync.
    claimLocal(nextState as Record<string, unknown>);

    if (isDiscreteAction) {
      performWrite();
      return;
    }

    // Continuous actions (scale, pan): still coalesced, because they arrive by
    // the dozen and the server only needs where they ended up. The delay is no
    // longer felt: the value is local from the moment it changed, and the write
    // is only the telling.
    const timer = setTimeout(performWrite, 800);
    return () => clearTimeout(timer);
  }, [api.sidebar.selectedItem, api.sidebarInitialTab, api.canvasScale, api.canvasCenterX,
      api.canvasCenterY, api.cursorManPos, api.maximizedWantId, api.canvasMode,
      api.formSituation, api.myCharacterId]);

  // Let a world switch force this character's position out before it happens.
  // The 800ms debounce above is right for a cursor in motion and wrong at the
  // moment a world closes — see guiStateFlushStore.
  const setGuiStateFlush = useGuiStateFlushStore(s => s.setFlush);
  useEffect(() => {
    setGuiStateFlush(async () => {
      const pos = apiRef.current.cursorManPosRef.current;
      if (!pos) return;
      const charId = apiRef.current.myCharacterIdRef.current;
      const xKey = charId ? `canvas_cursor_x_${charId}` : 'canvas_cursor_x';
      const yKey = charId ? `canvas_cursor_y_${charId}` : 'canvas_cursor_y';
      try {
        const { seq } = await apiClient.updateGUIState(
          { [xKey]: pos.x, [yKey]: pos.y, source: 'frontend' },
          lastGuiSeqRef.current,
        );
        lastGuiSeqRef.current = seq;
        lastAckedCursorPosRef.current = { x: pos.x, y: pos.y };
      } catch {
        // A failed flush is not a reason to refuse to change worlds; the worst
        // case is the position this world remembers being one move stale.
      }
    });
    return () => setGuiStateFlush(null);
  }, [setGuiStateFlush]);

  // Write-back: when the Add Want form closes (user action), reset add_form_open and
  // add_form_type on the server so a subsequent page reload finds them in a clean state.
  // This makes add_form_open idempotent state (like the camera's zoom) rather than a command.
  const prevShowFormRef = useRef<boolean>(false);
  useEffect(() => {
    if (prevShowFormRef.current && !sidebar.showForm) {
      // Form just transitioned from open → closed
      apiClient.updateGUIState({ add_form_open: false, add_form_type: '', source: 'frontend' }, lastGuiSeqRef.current)
        .then(({ seq }) => { lastGuiSeqRef.current = seq; })
        .catch((err: any) => {
          if (typeof err?.serverSeq === 'number' && !isNaN(err.serverSeq)) {
            lastGuiSeqRef.current = err.serverSeq;
          }
        });
    }
    prevShowFormRef.current = sidebar.showForm;
  }, [sidebar.showForm]);

  return {
    /**
     * The last raw snapshot the server sent.
     *
     * Exposed because entering the canvas has to ask it where this character
     * was left, and asking the state itself is the only reliable answer — a
     * ref filled by an earlier poll may have been written under a different
     * (or no) character id and never corrected, since later polls answer 304.
     */
    lastSyncedStateRef,
  };
}
