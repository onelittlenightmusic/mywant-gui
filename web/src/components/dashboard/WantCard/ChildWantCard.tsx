import React, { useState } from 'react';
import { CheckSquare, Square, Plus } from 'lucide-react';
import { Want } from '@/types/want';
import { WantCardContent } from '../WantCardContent';
import { classNames, suppressDragImage } from '@/utils/helpers';
import { getBackgroundStyle } from '@/utils/backgroundStyles';
import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useCardOpacity } from '@/hooks/useCardOpacity';
import styles from '../WantCard.module.css';

import { ProgressBars } from './parts/ProgressBars';
import { CorrelationOverlay } from './parts/CorrelationOverlay';
import { StackLayers } from './parts/StackLayers';
import { VersionBadge } from './parts/VersionBadge';
import { CharacterCornerIcons } from './parts/CharacterCornerIcons';
import { QuickActionsOverlay } from './parts/QuickActionsOverlay';
import { buildDeleteConfirmConfig } from './parts/DeleteConfirmOverlay';
import { WantCardOverlay } from './parts/WantCardOverlay';
import { FocusTriangle } from './parts/FocusTriangle';
import { useLongPress } from './hooks/useLongPress';
import { useCardOverlay } from './hooks/useCardOverlay';
import { dropLabelOnWant } from './hooks/labelDrop';
import { CARD_BORDER_BASE, CARD_FOCUS_BASE } from './hooks/cardStyles';

interface ChildWantCardProps {
  child: Want;
  selectedWant?: Want | null;
  correlationRate?: number;
  isSelectMode: boolean;
  selectedWantIds?: Set<string>;
  isBeingProcessed: boolean;
  isTarget: boolean;
  onView: (want: Want) => void;
  onViewAgents?: (want: Want) => void;
  onViewResults?: (want: Want) => void;
  onViewChat?: (want: Want) => void;
  onEdit?: (want: Want) => void;
  onDelete?: (want: Want) => void;
  onSuspend?: (want: Want) => void;
  onResume?: (want: Want) => void;
  onWantDropped?: (draggedId: string, targetId: string) => void;
  onLabelDropped?: (wantId: string) => void;
}

export const ChildWantCard: React.FC<ChildWantCardProps> = ({
  child,
  selectedWant,
  correlationRate,
  isSelectMode,
  selectedWantIds,
  isBeingProcessed,
  isTarget,
  onView,
  onViewAgents,
  onViewResults,
  onViewChat,
  onEdit,
  onDelete,
  onSuspend,
  onResume,
  onWantDropped,
  onLabelDropped,
}) => {
  const childId = child.metadata?.id || child.id || '';
  // Per-field selectors — see WantCard: a selector-less useWantStore()
  // re-renders every mounted child card on every store write.
  const draggingWant = useWantStore(s => s.draggingWant);
  const setDraggingWant = useWantStore(s => s.setDraggingWant);
  const setIsOverTarget = useWantStore(s => s.setIsOverTarget);
  const highlightedLabel = useWantStore(s => s.highlightedLabel);
  const startWant = useWantStore(s => s.startWant);
  const stopWant = useWantStore(s => s.stopWant);

  const longPress = useLongPress(childId || null, { disabled: isBeingProcessed || isSelectMode });
  const overlay = useCardOverlay(childId || null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverWant, setIsDragOverWant] = useState(false);

  const isChildSelected = isSelectMode
    ? selectedWantIds?.has(childId)
    : selectedWant && (
        (selectedWant.metadata?.id && selectedWant.metadata.id === child.metadata?.id) ||
        (selectedWant.id && selectedWant.id === child.id)
      );

  const isHighlighted = highlightedLabel &&
    child.metadata?.labels &&
    child.metadata.labels[highlightedLabel.key] === highlightedLabel.value;

  const childBackgroundStyle = getBackgroundStyle(child.metadata?.type, false);
  const cardOpacity = useCardOpacity();
  const childAchievingPercentage = (child.state?.current?.achieving_percentage as number) ?? 0;
  const childStackCount = Math.min((child.metadata?.version ?? 1) - 1, 3);
  const childVersion = child.metadata?.version ?? 1;
  const childTypeCategory = useWantTypeStore(s => s.wantTypes).find(t => t.name === child.metadata?.type)?.category ?? '';

  const handleClick = (e: React.MouseEvent) => {
    if (isBeingProcessed) return;
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    onView(child);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isBeingProcessed || isSelectMode) return;
    e.preventDefault();
    e.stopPropagation();
    overlay.setQuickActionsWantId(childId || null);
    // Only if it is not already the selected one — see WantCard's
    // handleContextMenu: asking to view the card the sidebar already shows is
    // the second click, and hands the keys away from the actions just opened.
    if (!isChildSelected) onView(child);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    suppressDragImage(e);
    const id = child.metadata?.id || child.id;
    if (!id) return;
    setDraggingWant(id);
    e.dataTransfer.setData('application/mywant-id', id);
    e.dataTransfer.setData('application/mywant-name', child.metadata?.name || '');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isBeingProcessed) return;
    const isWantDrag = !!draggingWant || e.dataTransfer.types.includes('application/mywant-id');
    const isTemplateDrag = e.dataTransfer.types.includes('application/mywant-template');

    if (isTemplateDrag) return;

    if (isWantDrag) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverWant(true);
      setIsOverTarget(true);
      e.dataTransfer.dropEffect = 'move';
    } else if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverWant(false);
      setIsOverTarget(false);
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
    setIsDragOverWant(false);
    setIsOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isBeingProcessed) return;
    if (e.dataTransfer.types.includes('application/mywant-template')) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setIsDragOverWant(false);
    setIsOverTarget(false);
    setDraggingWant(null);

    const draggedWantId = e.dataTransfer.getData('application/mywant-id');
    if (draggedWantId && childId && isTarget) {
      if (draggedWantId === childId) return;
      if (onWantDropped) onWantDropped(draggedWantId, childId);
      return;
    }

    dropLabelOnWant(childId, e, onLabelDropped);
  };

  return (
    <div className="relative" style={{ isolation: 'isolate' }}>
      <FocusTriangle visible={!!isChildSelected} />
      <StackLayers stackCount={childStackCount} isChild />
      <div
        data-keyboard-nav-selected={isChildSelected}
        data-keyboard-nav-id={childId}
        tabIndex={isBeingProcessed ? -1 : 0}
        draggable={!isBeingProcessed}
        onDragStart={handleDragStart}
        onDragEnd={(e) => { e.stopPropagation(); setDraggingWant(null); }}
        onContextMenu={handleContextMenu}
        onMouseDown={longPress.onMouseDown}
        onMouseMove={longPress.onMouseMove}
        onMouseUp={longPress.onMouseUp}
        onMouseLeave={() => {
          longPress.cancel();
          if (overlay.showQuickActions) overlay.closeQuickActions();
        }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        className={classNames(
          `relative overflow-hidden rounded-md border hover:shadow-sm transition-all duration-300 cursor-pointer select-none ${CARD_FOCUS_BASE} min-h-[7rem]`,
          `${CARD_BORDER_BASE} hover:border-gray-300`,
          (isDragOverWant || isDragOver) && !isBeingProcessed && 'border-blue-600 border-2 bg-blue-100 dark:bg-blue-900/30',
          isHighlighted && styles.highlighted,
          isBeingProcessed && 'opacity-50 pointer-events-none cursor-not-allowed',
        )}
        style={{ WebkitTouchCallout: 'none', touchAction: 'pan-y' } as React.CSSProperties}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Painted surface (base tint + type background) at the shared card
            opacity — see WantCard for why this can't live on the container. */}
        <div
          className={classNames('absolute inset-0 z-0 pointer-events-none', childBackgroundStyle.className)}
          style={{ ...childBackgroundStyle.style, opacity: cardOpacity }}
        />

        <VersionBadge version={childVersion} />
        <CharacterCornerIcons want={child} category={childTypeCategory} hidden={isSelectMode} />
        <ProgressBars achievingPercentage={childAchievingPercentage} />
        <CorrelationOverlay rate={correlationRate} />

        {/* Drop target overlay */}
        <div className={classNames(
          'absolute inset-0 z-30 flex items-center justify-center bg-blue-700 dark:bg-blue-900 transition-all duration-400 ease-out pointer-events-none',
          isDragOverWant && isTarget && !isBeingProcessed ? 'bg-opacity-60 opacity-100' : 'bg-opacity-0 opacity-0',
        )}>
          <div className={classNames(
            'bg-white dark:bg-gray-800 p-2 rounded-full shadow-xl border-2 border-blue-600 dark:border-blue-500 transform transition-all duration-400 ease-out',
            isDragOverWant && isTarget && !isBeingProcessed ? 'scale-100 opacity-100' : 'scale-[2.5] opacity-0',
          )}>
            <Plus className="w-6 h-6 text-blue-700 dark:text-blue-400" />
          </div>
        </div>

        {isSelectMode && (
          <div className="absolute top-2 right-2 z-20 pointer-events-none">
            {isChildSelected
              ? <CheckSquare className="w-5 h-5 text-blue-600 bg-white rounded-md" />
              : <Square className="w-5 h-5 text-gray-400 bg-white rounded-md opacity-50" />}
          </div>
        )}

        <div
          className="p-2 sm:p-4 w-full h-full relative z-10 transition-all duration-150"
          style={overlay.showQuickActions ? { filter: 'blur(2px)', opacity: 0.5, pointerEvents: 'none' } : undefined}
        >
          <WantCardContent
            want={child}
            isChild={true}
            isFocused={!!isChildSelected && !isSelectMode}
            isSelectMode={isSelectMode}
            onView={onView}
            onViewAgents={onViewAgents}
            onViewResults={onViewResults}
            onViewChat={onViewChat}
          />
        </div>

        {overlay.showQuickActions && !overlay.activeOverlay && (
          <QuickActionsOverlay
            want={child}
            onClose={overlay.closeQuickActions}
            onView={() => onView(child)}
            onStart={() => startWant(childId)}
            onStop={() => stopWant(childId)}
            onSuspend={() => onSuspend?.(child)}
            onResume={() => onResume?.(child)}
            onRestart={async () => {
              await stopWant(childId);
              setTimeout(() => startWant(childId), 300);
            }}
            onEdit={() => onEdit?.(child)}
            onDelete={() => overlay.setOverlay(
              buildDeleteConfirmConfig(
                () => { overlay.clearOverlay(); onDelete?.(child); },
                overlay.clearOverlay,
              )
            )}
          />
        )}

        <WantCardOverlay activeOverlay={overlay.activeOverlay} onClose={overlay.clearOverlay} />
      </div>
    </div>
  );
};
