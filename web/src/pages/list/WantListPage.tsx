import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Waypoints } from 'lucide-react';
import { useConstellationFilter } from '@/components/sidebar/ConstellationFilterPanel';
import { postToHost, HostFramedPanel, useHostFocusedCard, hostPanelId, useHostPanel } from '@/lib/nativeHost';
import { usePageMinimap } from '@/components/dashboard/ItemMinimap';
import { useThingStore } from '@/stores/thingStore';
import { requestThingEdit } from '@/stores/thingEditStore';
import { WantCard } from '@/components/dashboard/WantCard/WantCard';
import { ThingCard } from '@/components/dashboard/ThingCard';
import { useMarkJumpStore } from '@/stores/markJumpStore';
import { hasExtensionRoute } from '@/extensions/registry';
import { classNames } from '@/utils/helpers';


// Components
import { useAppHeader } from '@/hooks/useAppHeader';
import { useTabHopStore } from '@/stores/tabHopStore';
import { WantMinimap } from '@/components/dashboard/WantMinimap';
import { DragOverlay } from '@/components/dashboard/DragOverlay';
import { WeatherEffect } from '@/components/dashboard/WeatherEffect';
import { WantListView } from './WantListView';
import { useWorkspaceShortcuts } from '../workspace/useWorkspaceShortcuts';
import { useListNavigation } from './useListNavigation';
import { useSelectionInput } from '../workspace/useSelectionInput';
import { useListReorder } from './useListReorder';
import { useDetailTarget } from '../workspace/useDetailTarget';
import { useWorkspaceSidebar } from '../workspace/useWorkspaceSidebar';
import { useWorkspace } from '../workspace/useWorkspace';
import { useNoBoard } from '../workspace/boardLink';
import { WorkspaceHeaderOverlay, WorkspaceModals } from '../workspace/WorkspaceChrome';

/**
 * The want list: every want as a card, in the order you put them.
 *
 * Shares its workspace (useWorkspace) with the canvas page. There is no board
 * here, so the workspace is handed a still one (useNoBoard).
 */
export const WantListPage: React.FC<{
  /**
   * Run as one corner card on its own (/panel/card/<want|thing>/<id>), inside
   * an app's native card frame (lib/nativeHost, nativeCardPage): the card,
   * filling the page, its board-side actions handed to the app.
   */
  card?: boolean;
}> = ({ card = false }) => {
  const board = useNoBoard();
  /** The constellation filter's panel (the header's Filter). */
  const [filterOpen, setFilterOpen] = React.useState(false);
  const constellationFilter = useConstellationFilter('want');
  const panelRoute = useParams<{ kind?: string; id?: string }>();
  // Run as one of the workspace's panels inside an app's sheet
  // (/dashboard?__panel=<id>, lib/nativeHost): the same workspace, the panel
  // opened from the address, and no list drawn — the panel is the page. The
  // board's panels open here too, so a sheet does not load a board behind.
  const panelId = hostPanelId();
  const panel = !!panelId;
  const panelThingId = panelId?.startsWith('thing:') ? panelId.slice(6) : null;
  // A panel opened on its own page is told where the character stands (x, y):
  // a thing is pinned there, or lined up from there.
  if (panel && board.cursorManPosRef.current === null) {
    const q = new URLSearchParams(location.search);
    if (q.has('x') && q.has('y')) board.cursorManPosRef.current = { x: Number(q.get('x')), y: Number(q.get('y')) };
  }
  const { isCanvasDragging, setIsCanvasDragging, isCanvasDraggingRef, wantCanvasRef, cursorManPosRef, cursorManFocusedWantIdRef, canvasCenterX, canvasCenterY } = board;
  const ws = useWorkspace({ board });
  const {
    wants, loading, error, fetchWants, suspendWant, resumeWant,
    stopWant, startWant, clearError, reorderWant, 
    sidebar, expandedChain, setExpandedChain, gridColumns, setGridColumns, lastSelectedWantId,
    setLastSelectedWantId, sidebarInitialTab, setSidebarInitialTab, sidebarTabVersion, formSituation, setFormSituation, 
    expandedParents, 
    maximizedWantId, selectedLabel, setSelectedLabel, labelOwners, setLabelOwners, labelUsers, setLabelUsers,
    allLabels, isSelectMode, setIsSelectMode, selectedWantIds, setSelectedWantIds, selectedThingIds, 
    cardListScrollRef, minimapOpen, setMinimapOpen, radarMode, setRadarMode, 
    weatherCondition, weatherIntensity,
    isDarkMode, sidebarWantTypes, canvasMode, setCanvasMode, 
    isMobileLayout, isMobileCanvas, focusGlobalParamKey, setFocusGlobalParamKey, canvasModeRef,
    wantMinimapRef, drafts, regularWants, 
    selectedWant, wantsForGrid, 
    
    showBatchConfirmation, 
    
    setBatchAction, setShowBatchConfirmation, 
    handleDirectDeleteWant, handleDraftDelete, 
    handleShowReactionConfirmation, handleSuspendWant, handleResumeWant, handleArchiveWant, handleUnarchiveWant, handleSaveRecipeFromWant, 
    seriesWants, filteredWants, setFilteredWants,
    archiveOpen, setArchiveOpen, setArchivedNavWants, focusedSlotId, setFocusedSlotId, hierarchicalWants,
    currentHierarchicalWant, correlationHighlights, headerState, setHeaderState, fetchLabels, handleToggleSelectMode, handleSelectWant,
    handleSelectThing, batchFocusIdx, setBatchFocusIdx, setDetailsRequestedFor, detailsDismissed,
    setDetailsDismissed, detailsAskedFor, editingThing, consumeThingEdit, addingThing, setAddingThing, thingRecords, deleteThingRecord,
    handleAddWantFromThing, openCanvasDetailsRef, editingWant, initialFormTypeId, 
    initialFormItemType, wantFormRef, handleCreateWant, handleEditWant,
    handleViewWant, handleBubbleChildClick, handleEnterBubble, handleViewAgents, handleViewResults,
    handleViewChat, handleDraftClick, handleMinimapClick, handleMinimapDoubleClick, handleMinimapDraftClick, 
    handleLabelClick, inputHandedOver, minimapFocused, handleRecommendationSelectFromSidebar, handleToggleExpand, 
    handleLabelDropped, handleWantDropped, isGlobalDragOver, handleGlobalDragEnter, handleGlobalDragOver, handleGlobalDragLeave, handleGlobalDrop, handleMaximizeChange,
    handleCloseModals,
  } = ws;

  // Walking the card grid — reading order, not space. See list/useListNavigation.
  useListNavigation({
    canvasMode,
    isSelectMode,
    hierarchicalWants,
    currentHierarchicalWant,
    filteredWants,
    wants,
    expandedChain,
    expandedParents,
    lastSelectedWantId,
    gridColumns,
    archiveOpen,
    setArchiveOpen,
    focusedSlotId,
    setFocusedSlotId,
    sidebar,
    setDetailsRequestedFor,
    setDetailsDismissed,
    onViewWant: handleViewWant,
    onBubbleChildClick: handleBubbleChildClick,
    onToggleExpand: handleToggleExpand,
    onCreateWant: handleCreateWant,
    onSelectWant: handleSelectWant,
    onEnterBubble: handleEnterBubble,
  });

  // Confirm, cancel and "what else can I do with this" — the three presses that
  // mean something wherever you are. See workspace/useSelectionInput.
  useSelectionInput({
    canvasMode,
    onSelectThing: handleSelectThing,
    isCanvasDragging,
    isSelectMode,
    setIsSelectMode,
    formSituation,
    setFormSituation,
    selectedWant,
    selectedWantIds,
    setSelectedWantIds,
    setLastSelectedWantId,
    maximizedWantId,
    expandedChain,
    setExpandedChain,
    showBatchConfirmation,
    setShowBatchConfirmation,
    batchFocusIdx,
    setBatchFocusIdx,
    setBatchAction,
    sidebar,
    wantFormRef,
    wantCanvasRef,
    isCanvasDraggingRef,
    setIsCanvasDragging,
    cursorManPosRef,
    cursorManFocusedWantIdRef,
    characterBubbleOpen: false,
    arrangeReviewOpen: false,
    inputHandedOver,
    openCharacterBubble: () => {},
    onCloseModals: handleCloseModals,
    onSelectWant: handleSelectWant,
    onMaximizeChange: handleMaximizeChange,
  });

  const wantGridContainerRef = useRef<HTMLDivElement | null>(null);

  // Putting the cards in the order you want them, and the Cmd+Shift+arrow that
  // means "as far as it goes" on either page. See list/useListReorder.
  const reorder = useListReorder({
    canvasMode,
    canvasModeRef,
    isCanvasDraggingRef,
    filteredWants,
    selectedWant,
    containerRef: wantGridContainerRef,
    onCommit: reorderWant,
    onCanvasWarp: (dir) => { wantCanvasRef.current?.warpKeyboardDragCursor(dir); },
  });

  // The single-letter keys, and what they mean anywhere in the workspace.
  // See workspace/useWorkspaceShortcuts.
  useWorkspaceShortcuts({
    sidebar,
    isSelectMode,
    hasBatchSelection: isSelectMode && (selectedWantIds.size > 0 || selectedThingIds.size > 0),
    canvasMode,
    selectedWant,
    filteredWants,
    setSelectedWantIds,
    setRadarMode,
    setCanvasMode,
    onCreateWant: handleCreateWant,
    onToggleSelectMode: handleToggleSelectMode,
  });

  // Drive the global CursorMan tab-hop picker (mounted in App.tsx): B+L1/R1
  // opens it only in the idle dashboard state — when a sidebar/form is focused
  // that chord
  // instead cycles its sub-tabs (WantDetailsSidebar). Other pages keep the store
  // at its default (enabled), so tab-hop works everywhere else too. Reset to
  // enabled on unmount so leaving the dashboard never leaves it stuck off.

  const tabHopIdle = formSituation === 'closed' && !sidebar.selectedItem && !isCanvasDragging && !maximizedWantId && !isSelectMode;
  useEffect(() => {
    useTabHopStore.getState().setEnabled(tabHopIdle);
  }, [tabHopIdle]);
  useEffect(() => () => { useTabHopStore.getState().setEnabled(true); }, []);

  // Who the detail panel is for, and how you get into it. Two questions that
  // look like one — see workspace/useDetailTarget.
  const {
    cursorThingRecord,
    
    
    
    
    openCanvasDetails,
    
    detailPanelOpen,
  } = useDetailTarget({
    cursorGroupName: null,
    canvasMode,
    isSelectMode,
    isMobileLayout,
    isCanvasDragging,
    formSituation,
    selectedWant,
    regularWants,
    sidebar,
    cursorFocusedWantId: null,
    // A thing's panel on its own page (/panel/thing/<id>) is that thing's.
    cursorFocusedThingId: panelThingId,
    thingRecords,
    detailsAskedFor,
    detailsDismissed,
    setDetailsRequestedFor,
    setDetailsDismissed,
    inputHandedOver,
    characterBubbleOpen: false,
    arrangeReviewOpen: false,
    minimapFocused,
    canvasUnderReview: false,
    addingThing,
    editingThing,
    wantCanvasRef,
    onViewWant: handleViewWant,
  });
  openCanvasDetailsRef.current = openCanvasDetails;

  // Detail/Global sidebar rides the app-root RightSidebar shell (Layout →
  // AppSidebarHost) like every other page, so it persists across navigation.
  // What the right-hand panel shows, and what closing it means.
  // See workspace/useWorkspaceSidebar.
  useWorkspaceSidebar({
    filterOpen,
    onCloseFilter: () => setFilterOpen(false),
    sidebar,
    selectedWant,
    cursorThingRecord,
    cursorGroup: null,
    addingThing,
    setAddingThing,
    editingThing,
    consumeThingEdit,
    detailPanelOpen,
    isMobileCanvas,
    isDarkMode,
    expandedChain,
    setExpandedChain,
    headerState,
    sidebarWantTypes,
    setDetailsRequestedFor,
    setDetailsDismissed,
    sidebarInitialTab,
    setSidebarInitialTab,
    sidebarTabVersion,
    seriesWants,
    setHeaderState,
    onRecommendationSelect: handleRecommendationSelectFromSidebar,
    onDeleteWant: handleDirectDeleteWant,
    onSaveRecipe: handleSaveRecipeFromWant,
    startWant,
    stopWant,
    suspendWant,
    resumeWant,
    wants,
    loading,
    filteredWants,
    allLabels,
    selectedLabel,
    setSelectedLabel,
    labelOwners,
    setLabelOwners,
    labelUsers,
    setLabelUsers,
    onLabelClick: handleLabelClick,
    onViewWant: handleViewWant,
    fetchLabels,
    fetchWants,
    radarMode,
    setRadarMode,
    focusGlobalParamKey,
    cursorManPosRef,
    canvasCenterX,
    canvasCenterY,
    onAddWantFromThing: handleAddWantFromThing,
    deleteThingRecord,
  });

  useAppHeader({
    onCreateWant: handleCreateWant,
    // A toggle, like Add Want: the press that opened the panel closes it.
    onCreateThing: () => setAddingThing(v => !v),
    isAddThingActive: addingThing,
    isAddWantActive: sidebar.showForm && !initialFormTypeId && initialFormItemType === 'want-type' && !editingWant,
    showSelectMode: isSelectMode,
    onToggleSelectMode: handleToggleSelectMode,
    showMinimap: minimapOpen,
    onMinimapToggle: () => setMinimapOpen(!minimapOpen),
    showGlobalState: sidebar.showGlobal,
    onGlobalStateToggle: sidebar.toggleGlobal,
    // No pad here: the pad drives a character, and the list has none.
    // Same "only where there's a board" gate as the pad — the lamp reads
    // CursorMan's drag mode, which doesn't exist in list mode either.
    showZModeLamp: false,
    // Narrow the list to constellations (ConstellationFilterPanel): lit while
    // its panel is open or a filter is on.
    pageAction: {
      label: 'Filter',
      icon: Waypoints,
      onClick: () => setFilterOpen(v => !v),
      // Lit while its panel is open, as every panel's button is. A filter in
      // effect with the panel closed says so another way — the button's
      // colour here, a filled glyph in an app — or it looked stuck pressed.
      active: filterOpen,
      toneClass: constellationFilter ? 'text-sky-500 dark:text-sky-400' : undefined,
      hostIcon: constellationFilter ? 'WaypointsFilled' : undefined,
      tooltip: constellationFilter ? '星座で絞り込み中' : '星座で絞り込む',
    },
  });

  // A mark pressed while the list is showing. The Global panel is here, so a
  // global mark is answered here; a want or a thing is a place on the board,
  // and the board answers those (canvas/useBoardCamera) once it is showing.
  const markJumpRequest = useMarkJumpStore(s => s.request);
  useEffect(() => {
    if (!markJumpRequest) return;
    if (markJumpRequest.kind !== 'global') {
      if (hasExtensionRoute('/canvas')) { setCanvasMode(true); return; }
      // No board in this build: a want is shown here, in the list, and a
      // thing on its own page.
      if (markJumpRequest.kind === 'want') {
        const id = markJumpRequest.id;
        const want = wants.find(w => (w.metadata?.id || w.id) === id);
        if (want) handleViewWant(want, { toggle: false });
      } else {
        ws.navigate('/thing');
      }
      useMarkJumpStore.getState().consume();
      return;
    }
    if (!sidebar.showGlobal) sidebar.toggleGlobal();
    setFocusGlobalParamKey(markJumpRequest.key);
    setTimeout(() => setFocusGlobalParamKey(null), 1500);
    useMarkJumpStore.getState().consume();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markJumpRequest]);

  // A thing's card page needs the things, which this page loads only on a
  // board (usePanelRequests).
  const fetchThings = useThingStore(st => st.fetchThings);
  useEffect(() => {
    if ((card || panel) && thingRecords.length === 0) void fetchThings();
  }, [card, panel, thingRecords.length, fetchThings]);

  // The list's focused card wears the app's native buttons (lib/nativeHost).
  useHostFocusedCard(!panel && !card);

  // The map: in the page, or in an app on a phone the app's own sheet, whose
  // presses come back here (usePageMinimap — every page's map works so).
  const minimap = usePageMinimap(minimapOpen, setMinimapOpen, {
    pick: handleMinimapClick,
    open: handleMinimapDoubleClick,
    draft: handleMinimapDraftClick,
  });

  // The panel the address names, opened once what it names is loaded
  // (useHostPanel — every panel page works so). The route to it is the
  // workspace's to give (useWorkspaceSidebar, WorkspaceModals).
  useHostPanel(undefined, (id) => {
    const [kind, ...rest] = id.split(':');
    const arg = rest.join(':');
    const wantById = (wid: string) => wants.find(w => (w.metadata?.id || w.id) === wid);
    switch (kind) {
      case 'global': if (!sidebar.showGlobal) sidebar.toggleGlobal(); return;
      case 'filter': setFilterOpen(true); return;
      case 'add-thing': setAddingThing(true); return;
      case 'add-want': {
        const parent = arg ? wantById(arg) : undefined;
        if (arg && !parent) return false;
        if (!sidebar.showForm) handleCreateWant(parent);
        return;
      }
      case 'edit-want': {
        const w = wantById(arg);
        if (!w) return false;
        if (!sidebar.showForm) handleEditWant(w);
        return;
      }
      case 'edit-thing': {
        const t = thingRecords.find(r => r.id === arg);
        if (!t) return false;
        requestThingEdit(t);
        return;
      }
      case 'thing': setDetailsRequestedFor(arg); return;
      case 'want': {
        const w = wantById(arg);
        if (!w) return false;
        handleViewWant(w, { toggle: false });
        setDetailsRequestedFor(arg);
        return;
      }
    }
  }, `${wants.length}:${thingRecords.length}`);

  // A form's panel page draws the form (WorkspaceModals holds it); the
  // others' panels are AppSidebarHost's.
  if (panel) {
    if (panelId === '__minimap') return (
      <WantMinimap
        // Not filteredWants: the list fills that in as it draws, and this page
        // draws no list.
        wants={regularWants}
        drafts={drafts}
        selectedWantId={selectedWant?.metadata?.id || selectedWant?.id}
        onWantClick={(id) => minimap.send('pick', id)}
        onWantDoubleClick={(id) => minimap.send('open', id)}
        onDraftClick={(id) => minimap.send('draft', id)}
        isOpen
      />
    );
    return panelId!.startsWith('add-want') || panelId!.startsWith('edit-want')
      ? <WorkspaceModals ws={ws} canvasPlacementPos={null} />
      : null;
  }

  if (card) {
    const kind = panelRoute.kind === 'thing' ? 'thing' as const : 'want' as const;
    const id = panelRoute.id ?? '';
    // What belongs to the board — opening its details, editing, the agents
    // view — goes to the app, which hands it to the board's page.
    const act = (a: string) => postToHost({ type: 'card-act', act: a, kind, id });
    const maximizedCard = new URLSearchParams(location.search).has('max');
    if (kind === 'thing') {
      const t = thingRecords.find(r => r.id === id);
      return (
        <HostCardFrame>
          {t && (
            <ThingCard
              record={t}
              selected
              className="!scale-100 !h-full"
              onView={() => act('open')}
              onAddWant={() => act('add-want')}
              onDelete={(r) => { void deleteThingRecord(r); }}
            />
          )}
        </HostCardFrame>
      );
    }
    const w = wants.find(x => (x.metadata?.id || x.id) === id);
    // Maximized, the card places itself over the whole page; a scaled frame
    // around it would be what it measured instead (a transform holds fixed
    // children), so it gets the page as it is.
    const Frame = maximizedCard ? HostCardPage : HostCardFrame;
    return (
      <Frame>
        {w && (
          <WantCard
            want={w}
            selected
            selectedWant={w}
            onView={() => act('open')}
            className="!scale-100 !h-full"
            onViewAgents={() => act('agents')}
            onViewResults={() => act('results')}
            onViewChat={() => act('chat')}
            onEdit={() => act('edit')}
            onDelete={handleDirectDeleteWant}
            onSuspend={handleSuspendWant}
            onResume={handleResumeWant}
            onShowReactionConfirmation={handleShowReactionConfirmation}
            index={0}
            stackCount={0}
            expandedParents={expandedParents}
            onToggleExpand={handleToggleExpand}
            // Maximizing is the app's: it opens the card full screen, natively,
            // as this same page with ?max=1 — where the card is drawn
            // maximized, and putting it back asks the app to close it.
            maximizedWantId={maximizedCard ? id : null}
            onMaximizeChange={(mid) => act(mid ? 'maximize' : 'unmaximize')}
            isSelectMode={false}
            onCreateWant={handleCreateWant}
            canvasMode
            confirmEntersInnerFocus
          />
        )}
      </Frame>
    );
  }

  return (
    <>
      <WorkspaceHeaderOverlay ws={ws} />
      <main
        className="flex-1 flex overflow-hidden bg-transparent relative"
        onDragEnter={handleGlobalDragEnter}
        onDragOver={handleGlobalDragOver}
        onDragLeave={handleGlobalDragLeave}
        onDrop={handleGlobalDrop}
      >
        {/* Weather over the list (the board draws its own) */}
        <WeatherEffect condition={weatherCondition} intensity={weatherIntensity} />
        <div
          ref={cardListScrollRef}
          className={classNames(
            "host-scroll-edges flex-1 flex flex-col overflow-hidden transition-colors duration-200 overflow-y-auto lg:pr-[480px]",
            isGlobalDragOver && "bg-blue-50 dark:bg-blue-900/20 border-4 border-dashed border-blue-400 border-inset"
          )}
        >
          <WantListView
            error={error}
            onClearError={clearError}
            roomForSheet={!!selectedWant || sidebar.showGlobal}
            grid={{
              // Narrowed to the chosen constellations, if any.
              wants: constellationFilter
                ? wantsForGrid.filter(w => constellationFilter.has(w.metadata?.id || w.id || ''))
                : wantsForGrid,
              drafts: drafts,
              onDraftClick: handleDraftClick,
              onDraftDelete: handleDraftDelete,
              loading: loading,
              selectedWant: selectedWant,
              onViewWant: handleViewWant,
              onViewAgentsWant: handleViewAgents,
              onViewResultsWant: handleViewResults,
              onViewChatWant: handleViewChat,
              onEditWant: handleEditWant,
              onDeleteWant: handleDirectDeleteWant,
              onSuspendWant: handleSuspendWant,
              onResumeWant: handleResumeWant,
              onGetFilteredWants: setFilteredWants,
              expandedParents: expandedParents,
              onToggleExpand: handleToggleExpand,
              maximizedWantId: maximizedWantId,
              onMaximizeChange: handleMaximizeChange,
              onCreateWant: handleCreateWant,
              onLabelDropped: handleLabelDropped,
              onWantDropped: handleWantDropped,
              onShowReactionConfirmation: handleShowReactionConfirmation,
              isSelectMode: isSelectMode,
              selectedWantIds: selectedWantIds,
              onSelectWant: handleSelectWant,
              correlationHighlights: correlationHighlights,
              expandedChain: expandedChain,
              allWants: regularWants,
              onBubbleChildClick: handleBubbleChildClick,
              onBubbleClose: () => setExpandedChain([]),
              onOpenBalloon: (want) => setExpandedChain([want]),
              onCloseBalloon: () => setExpandedChain([]),
              onGridColumnsChange: setGridColumns,
              onArchiveWant: handleArchiveWant,
              onUnarchiveWant: handleUnarchiveWant,
              archiveOpen: archiveOpen,
              onToggleArchive: () => setArchiveOpen(v => !v),
              focusedSlotId: focusedSlotId,
              onGetArchivedWants: setArchivedNavWants,
              reorderContainerRef: wantGridContainerRef,
              reorderIndicator: reorder.indicator,
              reorderContainerProps: reorder.containerProps,
              reorderReportGap: reorder.reportDragOverGap,
              reorderCommitDrop: reorder.commitDrop,
              reorderStartDrag: reorder.startDrag,
              reorderEndDrag: reorder.endDrag,
              getIsKbReorderSource: reorder.isKbDragSource,
            }}
          />
        </div>
      </main>
      <WantMinimap
        ref={wantMinimapRef}
        wants={filteredWants}
        drafts={drafts}
        selectedWantId={selectedWant?.metadata?.id || selectedWant?.id}
        onWantClick={handleMinimapClick}
        onWantDoubleClick={handleMinimapDoubleClick}
        onDraftClick={handleMinimapDraftClick}
        isOpen={minimap.drawHere}
      />
      <WorkspaceModals ws={ws} canvasPlacementPos={null} />
      <DragOverlay ghostState={reorder.ghost} />
    </>
  );
};

/**
 * A corner card filling its page: drawn at the size the board draws its
 * corner cards before shrinking them (CanvasFocusFloatCard, 420×260), and
 * shrunk to the page's width — the app's frame is that shape.
 */
const HostCardFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [size, setSize] = React.useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden bg-white dark:bg-gray-900">
      <HostFramedPanel.Provider value={true}>
      {/* 420 wide, shrunk to the page's width, and as tall as the page is at
          that scale: the frame may be another shape (a sheet's card row). */}
      <div style={{ width: 420, height: size.h * 420 / size.w, transform: `scale(${size.w / 420})`, transformOrigin: 'top left' }}>
        {children}
      </div>
      </HostFramedPanel.Provider>
    </div>
  );
};

/** A maximized card's page: the page as it is, for the card to fill. */
const HostCardPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 bg-white dark:bg-gray-900">
    <HostFramedPanel.Provider value={true}>{children}</HostFramedPanel.Provider>
  </div>
);
