import { useCallback, useRef } from 'react';
import { Want } from '@/types/want';
import type { WantTypeListItem } from '@/types/wantType';
import { playSound } from '@/utils/sounds';
import { CANVAS_LABEL_X, CANVAS_LABEL_Y } from '@/utils/wantPlacement';
import type { SidebarTab } from './useGuiStateSync';

/**
 * Selecting a want, wherever the selection came from.
 *
 * A click on a list card, a step onto a canvas tile, a child inside an open
 * bubble, the minimap, a draft — six doors onto the same act, and every one of
 * them ends by telling the sidebar which want to show and remembering it as
 * the last one looked at. `handleViewWant` is the general case the others
 * specialise: it is the only one that has to decide between opening the panel
 * and toggling it shut, because it is the only one a click on an
 * already-selected card can reach.
 *
 * `openCanvasDetails` / `detailsAskedFor` / `setDetailsRequestedFor` are read
 * through refs rather than taken as plain values: this hook is called early
 * (its `onViewWant` is itself a dependency of the canvas's own cursor-focus
 * hook), before the detail-panel hooks that own those three have run. The
 * refs are filled in once those hooks return — see the assignments beside
 * their calls in Dashboard.
 */
export interface WantViewApi {
  wants: Want[];
  selectedWant: Want | null;
  sidebar: { selectItem: (w: Want) => void; clearSelection: () => void };
  expandedChain: Want[];
  setExpandedChain: (chain: Want[]) => void;
  childWantsByParentId: Map<string, Want[]>;
  sidebarWantTypes: WantTypeListItem[];
  canvasMode: boolean;
  canvasPositionMapRef: React.MutableRefObject<ReadonlyMap<string, { x: number; y: number }>>;
  initCursorManPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  setCursorManPos: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
  lastLocalCursorMoveRef: React.MutableRefObject<number>;
  setLastSelectedWantId: (id: string | null) => void;
  focusWantInDashboard: (wantId: string, smooth?: boolean) => void;
  setSidebarInitialTab: (t: SidebarTab) => void;
  setSidebarTabVersion: React.Dispatch<React.SetStateAction<number>>;
  drafts: Want[];
  setMinimapOpen: (open: boolean) => void;

  // — read through a ref-mirror; filled in after the detail-panel hooks run —
  detailsAskedFor: (id: string | null | undefined) => boolean;
  setDetailsRequestedFor: (id: string | null) => void;
  openCanvasDetails: (forWantId?: string) => void;
}

export function useWantView(api: WantViewApi) {
  const apiRef = useRef(api);
  apiRef.current = api;

  /**
   * @param opts.toggle  Whether selecting the already-selected want CLOSES it.
   *   True for a click, which is how you dismiss a card you opened. False when
   *   the character lands on a tile: a landing means "show me this one", never
   *   "hide it".
   *
   *   That distinction is load-bearing. `selectedWant` here is read through the
   *   ref-mirror rather than closed over, so walking between wants faster than
   *   React re-renders never leaves it stale — arrive on A, step to B, come
   *   straight back to A, and a stale closure would have said A is still
   *   selected, toggling the panel shut while the character stands on it.
   */
  const handleViewWant = useCallback((
    want: Want | { id: string; parentId?: string },
    opts?: {
      toggle?: boolean;
      /**
       * How the want came to be shown, which decides what it sounds like.
       *
       * 'open' (the default) is a card being opened — a click, a press — and
       * gets the opening whoosh. 'navigate' is the highlight stepping from one
       * card to the next, which is not an opening at all: the panel follows the
       * highlight here, so every step played the whoosh and walking across the
       * list sounded like opening a dozen cards.
       *
       * A step says nothing here because the handler that moved the highlight
       * has already ticked (gridMove, as every other card page does). It has
       * to be that way round: a step can land on a slot or a bubble child
       * without coming through this function at all, and those steps sound the
       * same as any other.
       */
      via?: 'open' | 'navigate';
    },
  ) => {
    const a = apiRef.current;
    const toggle = opts?.toggle ?? true;
    const wantToView = 'metadata' in want ? want : a.wants.find(w => (w.metadata?.id === want.id) || (w.id === want.id));
    if (wantToView) {
      const wantToViewId = wantToView.metadata?.id || wantToView.id;
      const currentSelectedId = a.selectedWant?.metadata?.id || a.selectedWant?.id;

      if (toggle && currentSelectedId === wantToViewId) {
        // Clicking the card you are already on is the press. The first click
        // walks onto the card, the second looks inside — the same two beats as
        // landing on a tile and then pressing A, and the same two beats whether
        // it is a finger or a mouse.
        //
        // This used to be the phone's rule only (`isMobileLayout &&`), because
        // touch is the input with no Enter key. But the beats are not about the
        // keyboard: on a desktop the first click already opened the panel, and
        // the second — the one that should have walked INTO the panel — instead
        // fell through to the clear below, so clicking twice on a card put the
        // highlight out. The difference between the two layouts is only where
        // the panel comes from (the phone's sheet opens on the second beat, the
        // desktop's is already there), and openCanvasDetails handles both.
        //
        // Only until the panel has actually been asked for; after that, clicking
        // the card again means what it always did — a third click dismisses.
        if (!a.detailsAskedFor(wantToViewId)) { a.openCanvasDetails(wantToViewId); return; }
        // Otherwise: clicking the already selected want clears the selection.
        // Dismissing spends the request, exactly as the panel's own Close does
        // (see onClose) — otherwise the next visit to this same card would find
        // its old request still standing and skip straight from "selected" to
        // "dismissed", losing the look-inside beat for good.
        playSound('cardClose');
        a.setDetailsRequestedFor(null);
        a.sidebar.clearSelection();
        a.setExpandedChain([]);
        return;
      }

      // gridMove, not the opening whoosh: this is a card being selected, which
      // is the same event a click on any other card page makes. 'navigate' stays
      // silent because the handler that moved the highlight already ticked.
      if (opts?.via !== 'navigate') playSound('gridMove');
      a.sidebar.selectItem(wantToView);
      // The tab stays where the user left it. Landing on a tile selects a want,
      // which is not a request to look at its Results — and on the board the
      // panel follows the character, so forcing 'results' here meant one step
      // off a tile and back threw away the tab you had opened. The tabs that
      // don't exist on every want are handled by the panel itself.
      const wantId = wantToView.metadata?.id || wantToView.id;
      if (wantId) {
        a.setLastSelectedWantId(wantId);
        a.focusWantInDashboard(wantId);
      }
      // List mode: track canvas position so CursorMan is ready when switching to canvas,
      // and persist to backend so other tabs (canvas mode) can follow via ETag polling.
      if (!a.canvasMode) {
        const cx = parseInt(wantToView.metadata?.labels?.[CANVAS_LABEL_X] ?? '', 10);
        const cy = parseInt(wantToView.metadata?.labels?.[CANVAS_LABEL_Y] ?? '', 10);
        const labelPos = !isNaN(cx) && !isNaN(cy) ? { x: cx, y: cy } : null;
        const wantIdForPos = wantToView.metadata?.id || wantToView.id;
        const pos = labelPos ?? (wantIdForPos ? a.canvasPositionMapRef.current.get(wantIdForPos) ?? null : null);
        console.debug('[CursorSync] list→canvas', { wantId: wantIdForPos, labelPos, cacheSize: a.canvasPositionMapRef.current.size, pos });
        if (pos) {
          a.initCursorManPosRef.current = pos;
          a.setCursorManPos(pos);
          a.lastLocalCursorMoveRef.current = Date.now();
        }
      }
      a.setExpandedChain([]);
    }
  }, []);

  // Called from WantChildrenBubble when a child want is clicked
  const handleBubbleChildClick = useCallback((want: Want) => {
    const a = apiRef.current;
    const wantId = want.metadata?.id || want.id;
    const currentSelectedId = a.selectedWant?.metadata?.id || a.selectedWant?.id;

    // Toggle logic
    if (currentSelectedId === wantId) {
      a.sidebar.clearSelection();
      a.setExpandedChain([]);
      return;
    }

    a.sidebar.selectItem(want);
    if (wantId) a.setLastSelectedWantId(wantId);
    // Check if this child has children and extend/trim chain accordingly
    const hasChildren = a.wants.some(w =>
      w.metadata?.ownerReferences?.some(ref => ref.id === wantId)
    );
    if (hasChildren) {
      // Append to expandedChain if not already at the end
      const prev = a.expandedChain;
      const existingIdx = prev.findIndex(w => (w.metadata?.id || w.id) === wantId);
      if (existingIdx !== -1) {
        // Already in chain — trim to this point (collapse deeper)
        a.setExpandedChain(prev.slice(0, existingIdx + 1));
      } else {
        a.setExpandedChain([...prev, want]);
      }
    }
    // If no children, keep the chain as-is (parent bubble stays open)
  }, []);

  // Called from keyboard navigation when up/down should enter the open balloon
  const handleEnterBubble = useCallback(() => {
    const a = apiRef.current;
    if (a.expandedChain.length === 0) return;
    const parentWant = a.expandedChain[0];
    const parentId = parentWant?.metadata?.id || parentWant?.id || '';
    const children = a.childWantsByParentId.get(parentId) ?? [];
    if (children.length > 0) handleBubbleChildClick(children[0]);
  }, [handleBubbleChildClick]);

  /** Open a want in the right sidebar at the given tab.
   *  toggle=true (default): clicking the already-selected want collapses the sidebar.
   *  bumpVersion=true: increments sidebarTabVersion so the tab re-mounts. */
  const openWantSidebar = useCallback((
    want: Want,
    tab: SidebarTab,
    { toggle = true, bumpVersion = false }: { toggle?: boolean; bumpVersion?: boolean } = {},
  ) => {
    const a = apiRef.current;
    const wantId = want.metadata?.id || want.id;
    if (toggle && (a.selectedWant?.metadata?.id || a.selectedWant?.id) === wantId) {
      a.sidebar.clearSelection();
      a.setExpandedChain([]);
      return;
    }
    a.sidebar.selectItem(want);
    a.setSidebarInitialTab(tab);
    if (bumpVersion) a.setSidebarTabVersion(v => v + 1);
    if (wantId) { a.setLastSelectedWantId(wantId); a.focusWantInDashboard(wantId); }
  }, []);

  const handleViewAgents  = useCallback((want: Want) => openWantSidebar(want, 'history'), [openWantSidebar]);
  const handleViewResults = useCallback((want: Want) => openWantSidebar(want, 'results', { bumpVersion: true }), [openWantSidebar]);
  const handleViewChat    = useCallback((want: Want) => openWantSidebar(want, 'chat', { toggle: false, bumpVersion: true }), [openWantSidebar]);

  const handleDraftClick = useCallback((want: Want) => {
    const a = apiRef.current;
    const wantId = want.metadata?.id || want.id;
    const currentSelectedId = a.selectedWant?.metadata?.id || a.selectedWant?.id;
    if (currentSelectedId === wantId) {
      a.sidebar.clearSelection();
      return;
    }
    a.sidebar.selectItem(want);
    if (wantId) a.setLastSelectedWantId(wantId);
  }, []);

  const handleMinimapClick = useCallback((wantId: string) => {
    const a = apiRef.current;
    a.focusWantInDashboard(wantId);
    // A phone: focusWantInDashboard stands aside there (it is also what the
    // shared state sync calls, which must not scroll a phone's list under the
    // finger), so the tap that asked for this card scrolls to it and lands on
    // it itself — what pressing a card in the map is for.
    if (window.innerWidth < 640) {
      document.querySelector(`[data-want-id="${CSS.escape(wantId)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const want = a.wants.find(w => (w.metadata?.id === wantId) || (w.id === wantId));
      if (want) handleViewWant(want, { toggle: false, via: 'navigate' });
    }

    // Close minimap on mobile after selection
    if (window.innerWidth < 1024) {
      a.setMinimapOpen(false);
    }
  }, [handleViewWant]);

  const handleMinimapDoubleClick = useCallback((wantId: string) => {
    const a = apiRef.current;
    handleMinimapClick(wantId);
    const want = a.wants.find(w => (w.metadata?.id === wantId) || (w.id === wantId));
    if (want) handleViewWant(want);

    // Minimap "double-tap" transfers real focus to this want — the canvas's own
    // CursorMan should follow along to the same tile, same as the reverse
    // (list→canvas) sync handleViewWant already does for list mode.
    if (a.canvasMode && want) {
      const cx = parseInt(want.metadata?.labels?.[CANVAS_LABEL_X] ?? '', 10);
      const cy = parseInt(want.metadata?.labels?.[CANVAS_LABEL_Y] ?? '', 10);
      if (!isNaN(cx) && !isNaN(cy)) {
        a.initCursorManPosRef.current = { x: cx, y: cy };
        a.setCursorManPos({ x: cx, y: cy });
        a.lastLocalCursorMoveRef.current = Date.now();
      }
    }
  }, [handleMinimapClick, handleViewWant]);

  const handleMinimapDraftClick = useCallback((draftId: string) => {
    const a = apiRef.current;
    const element = document.querySelector(`[data-draft-id="${draftId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Also activate the draft (same behavior as clicking the draft card)
    const draftWant = a.drafts.find(d => (d.metadata?.id || d.id) === draftId);
    if (draftWant) handleDraftClick(draftWant);

    // Close minimap on mobile after selection
    if (window.innerWidth < 1024) {
      a.setMinimapOpen(false);
    }
  }, [handleDraftClick]);

  return {
    handleViewWant,
    handleBubbleChildClick,
    handleEnterBubble,
    openWantSidebar,
    handleViewAgents,
    handleViewResults,
    handleViewChat,
    handleDraftClick,
    handleMinimapClick,
    handleMinimapDoubleClick,
    handleMinimapDraftClick,
  };
}
