import { CardCursorMan } from './CardCursorMan';
import { ListOrderCard } from '@/components/common/ListOrderCard';
import { ENTITY_CARD_HEIGHT } from './WantCard/hooks/cardStyles';
import { useListOrderStore } from '@/stores/listOrderStore';
import { classNames } from '@/utils/helpers';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Type, X, Folder } from 'lucide-react';
import { ThingRecord } from '@/types/thing';
import { ThingCard } from './ThingCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useThingStore } from '@/stores/thingStore';
import { useConstellationStore, membersById } from '@/stores/constellationStore';
import { applyManualOrder } from '@/utils/thingOrder';
import { useReorderableGroup } from '@/components/reorderable/useReorderableGroup';
import { ReorderableGhost } from '@/components/reorderable/ReorderableGhost';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { useGridMotion } from '@/hooks/useGridMotion';

/**
 * When a thing last changed: the later of when a want last named it and when
 * it was added. 0 when neither is known — those fall back to the order things
 * were added in.
 */
function thingUpdatedAt(r: ThingRecord): number {
  return Math.max(Date.parse(r.lastUsed) || 0, Date.parse(r.createdAt ?? '') || 0);
}

interface MemoGridProps {
  records: ThingRecord[];
  loading: boolean;
  selectedId?: string | null;
  /** Multi-select mode: clicking a card toggles its membership in `selectedIds`. */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelected?: (id: string) => void;
  onView: (record: ThingRecord) => void;
  onDelete?: (record: ThingRecord) => void;
  onAddWant?: (record: ThingRecord) => void;
  /** Click a group chip to edit that group. */
  onEditConstellation?: (group: { id: string; name: string }) => void;
  /** Reports the filtered list upward so the page can navigate it. */
  onGetFiltered?: (records: ThingRecord[]) => void;
  gridRef?: React.RefObject<HTMLDivElement | null>;
  /** The order card, the grid's first item, stood on by the keyboard. */
  orderFocused?: boolean;
}

const GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 items-start';

export const ThingGrid: React.FC<MemoGridProps> = ({
  records,
  loading,
  selectedId,
  selectMode = false,
  selectedIds,
  onToggleSelected,
  onView,
  onDelete,
  onAddWant,
  onEditConstellation,
  onGetFiltered,
  gridRef,
  orderFocused = false,
}) => {

  const manualOrder = useThingStore((s) => s.manualOrder);
  const reorderRecord = useThingStore((s) => s.reorderRecord);
  const constellations = useConstellationStore((s) => s.constellations);
  const deleteConstellation = useConstellationStore((s) => s.deleteConstellation);
  const constellationsByMember = useMemo(() => membersById(constellations, 'thing'), [constellations]);
  const thingConstellations = useMemo(() => constellations.filter((g) => g.kind === 'thing'), [constellations]);

  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = gridRef ?? localRef;

  const isDark = useDarkMode();
  const getMyCharacter = useCharacterStore((s) => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore((s) => s.myDefaultCursorColor);
  const cursorColor = getMyCharacter()?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDark);

  // One flat list in the saved manual order. Search, type filter, sort mode and
  // grouping were removed with the control row; drag reorder is what shapes
  // this list now.
  // お気に入り (the user's order) or 最近 (the thing updated last first) —
  // the order card's.
  const listOrder = useListOrderStore((s) => s.order.thing);
  const filtered = useMemo(() => {
    const manual = applyManualOrder(records, manualOrder);
    if (listOrder !== 'recent') return manual;
    return manual
      .map((r, i) => ({ r, i, at: thingUpdatedAt(r) }))
      .sort((a, b) => (b.at - a.at) || ((b.r.addedOrder ?? -1) - (a.r.addedOrder ?? -1)) || (a.i - b.i))
      .map(({ r }) => r);
  }, [records, manualOrder, listOrder]);

  // Report the display order for keyboard navigation (flatten sections in group mode).
  useEffect(() => {
    onGetFiltered?.(filtered);
  }, [filtered, onGetFiltered]);

  // Drag/keyboard reorder is only meaningful in the pure manual view: the
  // "Default" sort with no grouping. Other views reorder temporarily but must
  // never overwrite the saved manual order, and select mode owns clicks.
  // Only in お気に入り, too: a move is a change to that order.
  const reorderEnabled = !selectMode && listOrder === 'favorite';

  const reorder = useReorderableGroup<ThingRecord>({
    items: filtered,
    getId: (r) => r.id,
    containerRef,
    selectedId: selectedId ?? null,
    enabled: reorderEnabled,
    onCommit: (id, prev, next) => reorderRecord(id, prev, next),
  });

  // Card motion: pop-in for newly remembered values (flat grid only). Reflow
  // sliding is owned by useReorderableGroup's FLIP. The signature tells the
  // hook when the rendered set can have changed, so it no longer re-scans the
  // grid on every render.
  const flipKeySignature = useMemo(() => filtered.map(r => r.id).join(' '), [filtered]);
  useGridMotion(containerRef, flipKeySignature);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const selectClass =
    'px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  const ghostRecord = reorder.ghost ? filtered.find((r) => r.id === reorder.ghost?.id) : undefined;

  const renderCard = (r: ThingRecord, index: number) => {
    const itemProps = reorderEnabled ? reorder.getItemProps(r, index) : null;
    const isDragSource = itemProps?.isDragSource || reorder.isKbDragSource(r.id);
    const handlers = itemProps
      ? {
          draggable: itemProps.draggable,
          onDragStart: itemProps.onDragStart,
          onDragOver: itemProps.onDragOver,
          onDrop: itemProps.onDrop,
          onDragEnd: itemProps.onDragEnd,
        }
      : {};
    const isChecked = !!selectedIds?.has(r.id);
    return (
      <div
        key={r.id}
        data-reorder-id={r.id}
        data-flip-key={r.id}
        data-keyboard-nav-selected={selectedId === r.id}
        className={isDragSource ? 'opacity-40' : ''}
        {...handlers}
      >
        <ThingCard
          record={r}
          selected={selectMode ? isChecked : selectedId === r.id}
          selectMode={selectMode}
          checked={isChecked}
          constellations={(constellationsByMember.get(r.id) ?? []).map((g) => ({ id: g.id, name: g.name, color: g.color }))}
          onEditConstellation={selectMode ? undefined : onEditConstellation}
          onView={selectMode ? () => onToggleSelected?.(r.id) : onView}
          onDelete={selectMode ? undefined : onDelete}
          onAddWant={selectMode ? undefined : onAddWant}
        />
      </div>
    );
  };

  const hasAny = filtered.length > 0;

  return (
    <div>
      {/* Grid */}
      {!hasAny ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <p className="text-lg mb-2">No things yet</p>
          <p className="text-sm">Values are remembered as you name places, cities, URLs and other typed fields.</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`relative ${GRID_CLASS}`}
          onDragOver={reorderEnabled ? reorder.containerProps.onDragOver : undefined}
          onDragLeave={reorderEnabled ? reorder.containerProps.onDragLeave : undefined}
        >
          {/* Floating destination indicator (colored line + plus), same as the want grid. */}
          {reorder.indicator && (
            <div
              className={classNames('absolute rounded-full pointer-events-none z-50 flex items-center justify-center transition-[left,top] duration-200 ease-out', reorder.indicator.horizontal ? 'h-1' : 'w-1')}
              style={{ left: reorder.indicator.left, top: reorder.indicator.top, height: reorder.indicator.height, width: reorder.indicator.width, backgroundColor: `${reorder.indicator.color}99` }}
            >
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center p-1 shadow"
                style={{ backgroundColor: `${reorder.indicator.color}cc` }}
              >
                <Plus size={14} className="text-white" />
              </div>
            </div>
          )}
          <ListOrderCard list="thing" focused={orderFocused} sizeClass={ENTITY_CARD_HEIGHT}>
            <CardCursorMan visible={orderFocused} />
          </ListOrderCard>
          {filtered.map((r, index) => renderCard(r, index))}
        </div>
      )}

      {hasAny && (
        <p className="mt-4 text-xs text-gray-400 text-right">{records.length} values</p>
      )}

      {/* Reorder drag ghost (mouse / Shift+Arrow / A+stick). */}
      {ghostRecord && (() => {
        const Icon = resolveLucideIcon(ghostRecord.icon) ?? Type;
        return (
          <ReorderableGhost
            state={reorder.ghost}
            color={cursorColor}
            renderContent={() => (
              <div className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `${ghostRecord.color}30`, boxShadow: `0 0 0 1.5px ${ghostRecord.color}55` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: ghostRecord.color }} />
                </span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{ghostRecord.value}</h4>
              </div>
            )}
          />
        );
      })()}
    </div>
  );
};
