import type { ReorderIndicator } from '@/components/reorderable/useReorderableGroup';
import { classNames } from '@/utils/helpers';
import React, { useCallback, useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Plus, Heart, Archive, ArchiveRestore } from 'lucide-react';
import { CardCursorMan } from './CardCursorMan';
import { Want, WantExecutionStatus, SelectModeProps } from '@/types/want';
import { WantCard } from './WantCard';
import { WantGridItem } from './WantGridItem';
import { DraftWantCard } from './DraftWantCard';
import { WantChildrenBubble } from './WantChildrenBubble';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { CountBadge } from '@/components/common/CountBadge';
import { computeGridColumns, GRID_COLUMN_WIDTH } from '@/utils/gridUtils';
import { isWantArchived } from '@/utils/wantUtils';
import type { ReorderPosition } from '@/components/reorderable/useReorderableGroup';
import { useGridMotion } from '@/hooks/useGridMotion';
import { useWantStore } from '@/stores/wantStore';

interface WantWithChildren extends Want {
  children?: Want[];
}

interface WantGridProps extends SelectModeProps {
  wants: Want[];
  drafts?: Want[];
  onDraftClick?: (want: Want) => void;
  onDraftDelete?: (want: Want) => void;
  loading: boolean;
  selectedWant: Want | null;
  onViewWant: (want: Want) => void;
  onViewAgentsWant?: (want: Want) => void;
  onViewResultsWant?: (want: Want) => void;
  onViewChatWant?: (want: Want) => void;
  onEditWant: (want: Want) => void;
  onDeleteWant: (want: Want) => void;
  onSuspendWant?: (want: Want) => void;
  onResumeWant?: (want: Want) => void;
  onShowReactionConfirmation?: (want: Want, action: 'approve' | 'deny') => void;
  onGetFilteredWants?: (wants: Want[]) => void;
  expandedParents?: Set<string>;
  onToggleExpand?: (wantId: string) => void;
  maximizedWantId?: string | null;
  onMaximizeChange?: (id: string | null) => void;
  onCreateWant?: (parentWant?: Want) => void;
  onLabelDropped?: (wantId: string) => void;
  onWantDropped?: (draggedWantId: string, targetWantId: string) => void;
  correlationHighlights?: Map<string, number>; // wantID -> rate, populated when radar mode is active
  // Inline children bubble
  expandedChain?: Want[];
  allWants?: Want[];
  onBubbleChildClick?: (want: Want) => void;
  onBubbleClose?: () => void;
  onOpenBalloon?: (want: Want) => void;
  onCloseBalloon?: () => void;
  onGridColumnsChange?: (cols: number) => void;
  onArchiveWant?: (want: Want) => void;
  onUnarchiveWant?: (want: Want) => void;
  archiveOpen?: boolean;
  onToggleArchive?: () => void;
  focusedSlotId?: string | null;
  onGetArchivedWants?: (wants: Want[]) => void;
  // Reorder mechanics — owned by useReorderableGroup in Dashboard.tsx and
  // threaded through here (see web/src/components/reorderable/). WantGrid
  // wraps the raw gap/commit primitives before handing them to WantCard
  // (which layers its own "drop onto a target to connect" nesting logic on
  // top — see reorderReportGap's `inside` handling below).
  reorderContainerRef?: React.MutableRefObject<HTMLDivElement | null>;
  reorderIndicator?: ReorderIndicator | null;
  reorderContainerProps?: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
  };
  reorderReportGap?: (index: number, position: ReorderPosition | null) => void;
  reorderCommitDrop?: (draggedId: string, index: number, position: ReorderPosition) => Promise<void>;
  reorderStartDrag?: (id: string) => void;
  reorderEndDrag?: () => void;
  getIsKbReorderSource?: (id: string) => boolean;
}

export const WantGrid: React.FC<WantGridProps> = ({
  wants,
  drafts = [],
  onDraftClick,
  onDraftDelete,
  loading,
  selectedWant,
  onViewWant,
  onViewAgentsWant,
  onViewResultsWant,
  onViewChatWant,
  onEditWant,
  onDeleteWant,
  onSuspendWant,
  onResumeWant,
  onGetFilteredWants,
  expandedParents,
  onToggleExpand,
  maximizedWantId,
  onMaximizeChange,
  onCreateWant,
  onLabelDropped,
  onWantDropped,
  onShowReactionConfirmation,
  isSelectMode = false,
  selectedWantIds = new Set(),
  onSelectWant,
  correlationHighlights = new Map(),
  expandedChain = [],
  allWants = [],
  onBubbleChildClick,
  onBubbleClose,
  onOpenBalloon,
  onCloseBalloon,
  onGridColumnsChange,
  onArchiveWant,
  onUnarchiveWant,
  archiveOpen = false,
  onToggleArchive,
  focusedSlotId,
  onGetArchivedWants,
  reorderContainerRef,
  reorderIndicator = null,
  reorderContainerProps,
  reorderReportGap,
  reorderCommitDrop,
  reorderStartDrag,
  reorderEndDrag,
  getIsKbReorderSource,
}) => {
  // Wrap the generic gap-reporting primitive so WantCard's extra "drop
  // onto a target want to connect them" state ('inside') is treated the
  // same as "not over a reorder gap" (null) — matches the pre-extraction
  // behavior exactly. useCallback'd because these reach the thingized
  // WantGridItem, and a fresh identity per render would defeat its comparison.
  const handleReorderDragOver = useCallback((index: number, position: 'before' | 'after' | 'inside' | null) => {
    reorderReportGap?.(index, position === 'inside' ? null : position);
  }, [reorderReportGap]);
  const handleReorderDrop = useCallback((draggedId: string, index: number, position: 'before' | 'after') => {
    reorderCommitDrop?.(draggedId, index, position).catch(err => console.error('Failed to reorder want:', err));
  }, [reorderCommitDrop]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  // Also held as state, so effects that need to measure the grid can list the
  // node as a dependency and re-run when it appears.
  const [gridNode, setGridNode] = useState<HTMLDivElement | null>(null);

  // Mirror this grid's own container ref into the ref useReorderableGroup
  // (called in Dashboard.tsx, which doesn't render the grid DOM itself) was
  // given, so gap detection / the FLIP animation can scope their
  // [data-want-id] queries to this grid.
  //
  // This has to be a callback ref rather than an effect. The grid element is
  // not rendered on every pass — while wants are loading, and when there are
  // none to show, this component returns early with a spinner or an empty
  // state, and gridRef.current is null. An effect that mirrors the ref only on
  // mount therefore captures that null forever: the container ref stays empty
  // once the cards do appear, and everything scoped to it (the destination
  // indicator, gap detection, the FLIP slide) silently does nothing. A
  // callback ref fires whenever the node actually attaches or detaches.
  const attachGrid = useCallback((node: HTMLDivElement | null) => {
    gridRef.current = node;
    if (reorderContainerRef) reorderContainerRef.current = node;
    setGridNode(node);
  }, [reorderContainerRef]);

  // Compute column count from the actual rendered CSS grid track list.
  // getComputedStyle expands `repeat(auto-fill, ...)` to the real track sizes,
  // e.g. "384px 384px 384px" for 3 columns — far more reliable than manual math.
  const getColumns = () => {
    if (!gridRef.current) return 1;
    try {
      const tracks = window.getComputedStyle(gridRef.current).gridTemplateColumns;
      const cols = tracks.split(' ').filter(Boolean).length;
      return Math.max(1, cols);
    } catch {
      return computeGridColumns(gridRef.current.clientWidth);
    }
  };
  const [gridColumns, setGridColumns] = useState(1);
  useEffect(() => {
    const update = () => {
      const cols = getColumns();
      setGridColumns(cols);
      onGridColumnsChange?.(cols);
    };
    update();
    const ro = new ResizeObserver(update);
    if (gridNode) ro.observe(gridNode);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridNode, onGridColumnsChange]);

  // Measure the parent card's horizontal center relative to the grid, so the bubble
  // caret can be positioned precisely.
  const [bubbleCaretCenterX, setBubbleCaretCenterX] = useState<number | null>(null);
  const bubbleParentId = expandedChain[0]?.metadata?.id || expandedChain[0]?.id || null;

  // Children are pre-attached by Dashboard (via childWantsByParentId / wantsForGrid).
  const hierarchicalWants = useMemo(() => wants as WantWithChildren[], [wants]);

  /**
   * The order this tab has just made, if it has made one.
   *
   * A card dropped in a new place used to sit where it was until the server
   * had minted new order keys and the whole list had been fetched back — two
   * round trips of the card visibly refusing to move. While the claim stands
   * the grid honours it, and it is dropped the moment the real keys arrive
   * saying the same thing. See wantStore's reorderWant.
   */
  const orderOverride = useWantStore(s => s.orderOverride);

  const filteredWants = useMemo(() => {
    const claimed = orderOverride ? new Map(orderOverride.map((id, i) => [id, i])) : null;
    return hierarchicalWants.filter(want => !isWantArchived(want)).sort((a, b) => {
      if (claimed) {
        // Anything the claim does not name (arrived since) sorts after what it
        // does, in its own key order, rather than jumping to the front.
        const ia = claimed.get(a.metadata?.id || a.id || '');
        const ib = claimed.get(b.metadata?.id || b.id || '');
        if (ia !== undefined && ib !== undefined) return ia - ib;
        if (ia !== undefined) return -1;
        if (ib !== undefined) return 1;
      }
      // Sort by orderKey if available, otherwise fall back to ID
      const keyA = a.metadata?.orderKey || a.metadata?.id || '';
      const keyB = b.metadata?.orderKey || b.metadata?.id || '';
      return keyA.localeCompare(keyB);
    });
  }, [hierarchicalWants, orderOverride]);

  const filteredArchivedWants = useMemo(
    () => hierarchicalWants.filter(isWantArchived),
    [hierarchicalWants],
  );

  React.useEffect(() => {
    onGetFilteredWants?.(filteredWants);
  }, [filteredWants, onGetFilteredWants]);

  // Card motion: pop-in for newly created wants (SSE). Reflow sliding is
  // owned by useReorderableGroup's FLIP. The signature covers every list whose
  // membership produces a `data-flip-key` child, so the hook re-scans the grid
  // when — and only when — that membership can have changed.
  const flipKeySignature = useMemo(
    () => [
      ...filteredWants.map(w => w.metadata?.id || w.id || ''),
      ...drafts.map(d => d.metadata?.id || d.id || ''),
    ].join(' '),
    [filteredWants, drafts],
  );
  useGridMotion(gridRef, flipKeySignature);

  React.useEffect(() => {
    onGetArchivedWants?.(filteredArchivedWants);
  }, [filteredArchivedWants, onGetArchivedWants]);

  // Bubble-related derived values — computed at component level so hooks can reference them.
  const bubbleParentIndex = expandedChain.length > 0
    ? filteredWants.findIndex(w => (w.metadata?.id || w.id) === (expandedChain[0]?.metadata?.id || expandedChain[0]?.id))
    : -1;
  const bubbleParentWant = bubbleParentIndex >= 0 ? filteredWants[bubbleParentIndex] : null;
  const bubbleChildWants = useMemo(() => {
    if (!bubbleParentWant) return [];
    const parentId = bubbleParentWant.metadata?.id || bubbleParentWant.id;
    return (allWants.length > 0 ? allWants : bubbleParentWant.children || []).filter(w =>
      w.metadata?.ownerReferences?.some(ref => ref.id === parentId)
    );
  }, [bubbleParentWant, allWants]);

  // bubbleRowEndIndex: the index of the last grid item in the same row as the parent.
  // Grid items are ordered: filteredWants (0..N-1), drafts (N..N+D-1), Add Want button (N+D).
  // The column count is read back out of the real CSS layout rather than trusted
  // from state, so `repeat(auto-fill, ...)` is resolved exactly as rendered.
  const [bubbleRowEndIndex, setBubbleRowEndIndex] = useState(-1);

  // Both of the measurements below read layout (getComputedStyle /
  // getBoundingClientRect), which forces a synchronous reflow. They used to run
  // on EVERY render with no dependency array, so a drag — which renders the
  // grid many times a second — paid two forced reflows per render for values
  // that only the bubble uses. `gridColumns` is kept in the dependency list
  // because a ResizeObserver updates it, which is what re-runs these after a
  // viewport resize reflows the grid.
  // `gridNode` leads the list because these measurements are no-ops until the
  // grid element exists — this component renders a spinner or an empty state
  // before then.
  const bubbleLayoutDeps = [gridNode, bubbleParentIndex, filteredWants.length, drafts.length, gridColumns];

  useLayoutEffect(() => {
    if (bubbleParentIndex < 0 || !gridRef.current) return;
    const tracks = window.getComputedStyle(gridRef.current).gridTemplateColumns;
    const actualCols = Math.max(1, tracks.split(' ').filter(Boolean).length);
    // Total grid items = filteredWants + drafts + 1 (Add Want button); max index = total - 1
    const maxIndex = filteredWants.length + drafts.length;
    const rowEnd = Math.min(
      Math.floor(bubbleParentIndex / actualCols) * actualCols + actualCols - 1,
      maxIndex
    );
    setBubbleRowEndIndex(prev => (prev === rowEnd ? prev : rowEnd));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, bubbleLayoutDeps);

  useLayoutEffect(() => {
    if (!bubbleParentId) {
      setBubbleCaretCenterX(null);
      return;
    }
    if (!gridRef.current) return;
    const parentEl = gridRef.current.querySelector(`[data-want-id="${bubbleParentId}"]`) as HTMLElement | null;
    if (!parentEl) return;
    const parentRect = parentEl.getBoundingClientRect();
    const gridRect = gridRef.current.getBoundingClientRect();
    const centerX = parentRect.left - gridRect.left + parentRect.width / 2;
    setBubbleCaretCenterX(prev => (prev === centerX ? prev : centerX));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbleParentId, ...bubbleLayoutDeps]);

  const hasUserWants = hierarchicalWants.length > 0 || drafts.length > 0;

  if (loading && !hasUserWants) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading wants...</span>
      </div>
    );
  }

  if (!hasUserWants) {
    return (
      <div className="flex items-center justify-center py-16">
        <button onClick={() => onCreateWant?.()} className="flex flex-col items-center gap-4 p-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 rounded-full flex items-center justify-center transition-colors">
            <span className="relative inline-flex flex-shrink-0">
              <Heart className="w-12 h-12 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
              <Plus className="w-5 h-5 absolute -top-2 -right-2 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" style={{ strokeWidth: 3 }} />
            </span>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No wants yet</h3>
            <p className="text-gray-600 dark:text-gray-400">Click the plus icon to create your first want configuration.</p>
          </div>
        </button>
      </div>
    );
  }

  if (filteredWants.length === 0 && drafts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No matches found</h3>
        <p className="text-gray-600 dark:text-gray-400">No wants match your current search and filter criteria.</p>
      </div>
    );
  }

  return (
    <div
      ref={attachGrid}
      className="grid gap-4 sm:gap-[26px] lg:gap-[34px] relative"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${GRID_COLUMN_WIDTH}px, 100%), 1fr))` }}
      id="want-grid-container"
      onDragOver={reorderContainerProps?.onDragOver}
      onDragLeave={reorderContainerProps?.onDragLeave}
    >
      {/* Single floating destination indicator (+ and colored line) — replaces
          per-slot conditional rendering so its position can animate (CSS
          transition on left/top) between candidate destinations instead of
          instantly jumping. Colored with the user's character color instead
          of a fixed blue, and semi-transparent. Position/color owned by
          useReorderableGroup (Dashboard.tsx). */}
      {reorderIndicator && (
        <div
          className={classNames('absolute rounded-full pointer-events-none z-50 flex items-center justify-center transition-[left,top] duration-200 ease-out', reorderIndicator.horizontal ? 'h-1' : 'w-1')}
          style={{ left: reorderIndicator.left, top: reorderIndicator.top, height: reorderIndicator.height, width: reorderIndicator.width, backgroundColor: `${reorderIndicator.color}99` }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center p-1 shadow"
            style={{ backgroundColor: `${reorderIndicator.color}cc` }}
          >
            <Plus size={14} className="text-white" />
          </div>
        </div>
      )}
      {(() => {
        return filteredWants.map((want, index) => {
          const wantId = want.metadata?.id || want.id;
const isSelected = isSelectMode ? (wantId && selectedWantIds.has(wantId)) : selectedWant?.metadata?.id === want.metadata?.id;

          return (
            <React.Fragment key={wantId || `want-${index}`}>
              <WantGridItem
                wantId={wantId} want={want} childWants={want.children} selected={!!isSelected} selectedWant={selectedWant}
                isKeyboardNavSelected={selectedWant?.metadata?.id === want.metadata?.id}
                onViewWant={onViewWant} onSelectWant={onSelectWant}
                onViewAgents={onViewAgentsWant} onViewResults={onViewResultsWant} onViewChat={onViewChatWant} onEdit={onEditWant} onDelete={onDeleteWant}
                onSuspend={onSuspendWant} onResume={onResumeWant} onArchive={onArchiveWant} onUnarchive={onUnarchiveWant} expandedParents={expandedParents} onToggleExpand={onToggleExpand} maximizedWantId={maximizedWantId} onMaximizeChange={onMaximizeChange}
                onLabelDropped={onLabelDropped} onWantDropped={onWantDropped} onShowReactionConfirmation={onShowReactionConfirmation}
                onReorderDragOver={handleReorderDragOver} onReorderDrop={handleReorderDrop}
                onReorderDragStart={reorderStartDrag} onReorderDragEnd={reorderEndDrag} index={index}
                isSelectMode={isSelectMode} selectedWantIds={selectedWantIds} isBeingProcessed={want.status === 'deleting' || want.status === 'initializing'}
                onCreateWant={onCreateWant}
                correlationRate={correlationHighlights.get(want.metadata?.id || want.id || '')}
                correlationHighlights={correlationHighlights}
                stackCount={Math.min((want.metadata?.version ?? 1) - 1, 3)}
                isBubbleOpen={bubbleParentIndex >= 0 && (want.metadata?.id || want.id) === (bubbleParentWant?.metadata?.id || bubbleParentWant?.id)}
                onOpenBalloonWant={onOpenBalloon}
                onCloseBalloon={onCloseBalloon}
                isKbReorderSource={!!wantId && !!getIsKbReorderSource?.(wantId)}
              />

              {/* Inline children bubble - inserted after the last card in the parent's row */}
              {index === bubbleRowEndIndex && bubbleParentWant && (
                <WantChildrenBubble
                  key={`bubble-${bubbleParentWant.metadata?.id || bubbleParentWant.id}`}
                  parentWant={bubbleParentWant}
                  childWants={bubbleChildWants}
                  allWants={allWants.length > 0 ? allWants : []}
                  expandedChain={expandedChain.slice(1)}
                  selectedWant={selectedWant}
                  onChildClick={onBubbleChildClick || onViewWant}
                  onViewAgents={onViewAgentsWant}
                  onViewResults={onViewResultsWant}
                  onViewChat={onViewChatWant}
                  onEditWant={onEditWant}
                  onDeleteWant={onDeleteWant}
                  onSuspendWant={onSuspendWant}
                  onResumeWant={onResumeWant}
                  onShowReactionConfirmation={onShowReactionConfirmation}
                  onClose={onBubbleClose || (() => {})}
                  onCreateWant={onCreateWant}
                  onWantDropped={onWantDropped}
                  onDraftClick={onDraftClick}
                  onDraftDelete={onDraftDelete}
                  parentIndex={bubbleParentIndex}
                  gridColumns={gridColumns}
                  caretCenterX={bubbleCaretCenterX ?? undefined}
                  />
              )}
            </React.Fragment>
          );
        });
      })()}

      {drafts.map((draft, draftIndex) => {
        const draftId = draft.metadata?.id || draft.id;
        const globalIndex = filteredWants.length + draftIndex;
        return (
          <React.Fragment key={draftId}>
            <div
              data-draft-id={draftId}
              data-flip-key={draftId}
              className="h-full"
            >
              <DraftWantCard want={draft} selected={(selectedWant?.metadata?.id || selectedWant?.id) === draftId} onClick={() => onDraftClick?.(draft)} onDelete={() => onDraftDelete?.(draft)} />
            </div>
            {globalIndex === bubbleRowEndIndex && bubbleParentWant && (
              <WantChildrenBubble
                key={`bubble-${bubbleParentWant.metadata?.id || bubbleParentWant.id}`}
                parentWant={bubbleParentWant}
                childWants={bubbleChildWants}
                allWants={allWants.length > 0 ? allWants : []}
                expandedChain={expandedChain.slice(1)}
                selectedWant={selectedWant}
                onChildClick={onBubbleChildClick || onViewWant}
                onViewAgents={onViewAgentsWant}
                onViewResults={onViewResultsWant}
                onViewChat={onViewChatWant}
                onEditWant={onEditWant}
                onDeleteWant={onDeleteWant}
                onSuspendWant={onSuspendWant}
                onResumeWant={onResumeWant}
                onShowReactionConfirmation={onShowReactionConfirmation}
                onClose={onBubbleClose || (() => {})}
                onCreateWant={onCreateWant}
                onWantDropped={onWantDropped}
                onDraftClick={onDraftClick}
                onDraftDelete={onDraftDelete}
                parentIndex={bubbleParentIndex}
                gridColumns={gridColumns}
                caretCenterX={bubbleCaretCenterX ?? undefined}
              />
            )}
          </React.Fragment>
        );
      })}

      <React.Fragment>
        <button
          onClick={() => onCreateWant?.()}
          tabIndex={0}
          data-keyboard-nav-id="__add-want__"
          data-keyboard-nav-selected={focusedSlotId === '__add-want__'}
          data-free-cursor-item
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/mywant-id')) {
              e.preventDefault();
              reorderReportGap?.(filteredWants.length, 'before');
            }
          }}
          onDragLeave={() => reorderReportGap?.(0, null)}
          onDrop={(e) => {
            e.preventDefault();
            reorderReportGap?.(0, null);
            const draggedId = e.dataTransfer.getData('application/mywant-id');
            if (draggedId) {
              handleReorderDrop(draggedId, filteredWants.length - 1, 'after');
            }
          }}
          className="relative flex flex-col items-center justify-center p-3 sm:p-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group h-full min-h-[6rem] sm:min-h-[10rem]"
        >
          <CardCursorMan visible={focusedSlotId === '__add-want__'} />
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 rounded-full flex items-center justify-center transition-colors mb-2 sm:mb-3">
            <span className="relative inline-flex flex-shrink-0">
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" />
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors" style={{ strokeWidth: 3 }} />
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">Add Want</p>
        </button>
        {filteredWants.length + drafts.length === bubbleRowEndIndex && bubbleParentWant && (
          <WantChildrenBubble
            key={`bubble-${bubbleParentWant.metadata?.id || bubbleParentWant.id}`}
            parentWant={bubbleParentWant}
            childWants={bubbleChildWants}
            allWants={allWants.length > 0 ? allWants : []}
            expandedChain={expandedChain.slice(1)}
            selectedWant={selectedWant}
            onChildClick={onBubbleChildClick || onViewWant}
            onViewAgents={onViewAgentsWant}
            onViewResults={onViewResultsWant}
            onViewChat={onViewChatWant}
            onEditWant={onEditWant}
            onDeleteWant={onDeleteWant}
            onSuspendWant={onSuspendWant}
            onResumeWant={onResumeWant}
            onShowReactionConfirmation={onShowReactionConfirmation}
            onClose={onBubbleClose || (() => {})}
            onCreateWant={onCreateWant}
            onWantDropped={onWantDropped}
            onDraftClick={onDraftClick}
            onDraftDelete={onDraftDelete}
            parentIndex={bubbleParentIndex}
            gridColumns={gridColumns}
            caretCenterX={bubbleCaretCenterX ?? undefined}
          />
        )}
      </React.Fragment>

      {/* Open Archive / Hide Archive toggle button */}
      <button
        onClick={() => onToggleArchive?.()}
        tabIndex={0}
        data-keyboard-nav-id="__open-archive__"
        data-keyboard-nav-selected={focusedSlotId === '__open-archive__'}
        data-free-cursor-item
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); }}
        className="relative flex flex-col items-center justify-center p-3 sm:p-8 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 hover:border-amber-500 dark:hover:border-amber-500 transition-colors group h-full min-h-[6rem] sm:min-h-[10rem]"
      >
        <CardCursorMan visible={focusedSlotId === '__open-archive__'} />
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-800/30 rounded-full flex items-center justify-center transition-colors mb-2 sm:mb-3 relative">
          {archiveOpen
            ? <ArchiveRestore className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 dark:text-amber-400 transition-colors" />
            : <Archive        className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 dark:text-amber-500 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
          }
          {filteredArchivedWants.length > 0 && (
            <CountBadge
              count={filteredArchivedWants.length}
              tone="warn"
              size={20}
              className="absolute -top-1 -right-1"
            />
          )}
        </div>
        <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors font-medium">
          {archiveOpen ? 'Hide Archive' : 'Open Archive'}
        </p>
      </button>

      {/* Archive section */}
      {archiveOpen && (
        <>
          <div className="col-span-full flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Archive className="w-3 h-3" />
              Archive
            </span>
            <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800" />
          </div>
          {filteredArchivedWants.length === 0 ? (
            <div className="col-span-full text-center py-6 text-sm text-gray-400 dark:text-gray-500">
              No archived wants.
            </div>
          ) : (
            filteredArchivedWants.map((want, index) => {
              const wantId = want.metadata?.id || want.id;
              return (
                <div
                  key={wantId || `archived-${index}`}
                  data-want-id={wantId}
                  className="h-full relative opacity-75 hover:opacity-100 transition-opacity"
                >
                  <WantCard
                    want={want}
                    children={(want as WantWithChildren).children}
                    selected={selectedWant?.metadata?.id === want.metadata?.id}
                    selectedWant={selectedWant}
                    onView={onViewWant}
                    onViewAgents={onViewAgentsWant}
                    onViewResults={onViewResultsWant}
                    onViewChat={onViewChatWant}
                    onEdit={onEditWant}
                    onDelete={onDeleteWant}
                    onSuspend={onSuspendWant}
                    onResume={onResumeWant}
                    onArchive={onArchiveWant}
                    onUnarchive={onUnarchiveWant}
                    expandedParents={expandedParents}
                    onToggleExpand={onToggleExpand}
                    maximizedWantId={maximizedWantId}
                    onMaximizeChange={onMaximizeChange}
                    onLabelDropped={onLabelDropped}
                    onWantDropped={onWantDropped}
                    onShowReactionConfirmation={onShowReactionConfirmation}
                    onReorderDragOver={() => {}}
                    onReorderDrop={() => {}}
                    index={filteredWants.length + drafts.length + index}
                    isSelectMode={isSelectMode}
                    selectedWantIds={selectedWantIds}
                    isBeingProcessed={want.status === 'deleting' || want.status === 'initializing'}
                    onCreateWant={onCreateWant}
                    correlationHighlights={correlationHighlights}
                    stackCount={Math.min((want.metadata?.version ?? 1) - 1, 3)}
                  />
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
};