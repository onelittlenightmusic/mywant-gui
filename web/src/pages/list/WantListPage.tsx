import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
   * Run as one panel on its own (/panel/want/<id>, /panel/global), inside an
   * app's sheet: the same workspace, the panel opened from the route, and no
   * list drawn — the panel is the page (AppSidebarHost, nativePanelPage).
   */
  panel?: boolean;
}> = ({ panel = false }) => {
  const board = useNoBoard();
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
    cursorFocusedThingId: null,
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

  // The panel the route names, opened — once the want it names is loaded.
  const panelRoute = useParams<{ kind?: string; id?: string }>();
  useEffect(() => {
    if (!panel) return;
    if (panelRoute.kind === 'global') {
      if (!sidebar.showGlobal) sidebar.toggleGlobal();
      return;
    }
    if (panelRoute.kind === 'want' && panelRoute.id) {
      const want = wants.find(w => (w.metadata?.id || w.id) === panelRoute.id);
      if (!want) return;
      handleViewWant(want, { toggle: false });
      setDetailsRequestedFor(panelRoute.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, panelRoute.kind, panelRoute.id, wants.length]);

  if (panel) return null;

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
              wants: wantsForGrid,
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
        isOpen={minimapOpen}
      />
      <WorkspaceModals ws={ws} canvasPlacementPos={null} />
      <DragOverlay ghostState={reorder.ghost} />
    </>
  );
};
