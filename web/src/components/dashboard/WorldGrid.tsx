import React from 'react';
import { WorldSummary } from '@/types/world';
import { WorldCard } from './WorldCard';
import { GRID_COLUMN_WIDTH } from '@/utils/gridUtils';

interface WorldGridProps {
  worlds: WorldSummary[];
  /** World currently shown in the details sidebar. */
  selectedWorld?: WorldSummary | null;
  onViewWorld: (world: WorldSummary) => void;
  onOpenWorld: (world: WorldSummary) => void;
  /** Re-fetches the world list — a card overlay action. */
  onRefresh?: () => void;
  /** Downloads a world's snapshot YAML — a card overlay action. */
  onExportWorld?: (world: WorldSummary) => void;
  loading?: boolean;
  openingName?: string | null;
  /** Name of the world currently being exported. */
  exportingName?: string | null;
  /** Forwarded to the grid div so the parent can detect column count via useGridCols. */
  gridRef?: React.RefObject<HTMLDivElement | null>;
}

export const WorldGrid: React.FC<WorldGridProps> = ({
  worlds,
  selectedWorld,
  onViewWorld,
  onOpenWorld,
  onRefresh,
  onExportWorld,
  loading = false,
  openingName = null,
  exportingName = null,
  gridRef,
}) => {
  if (loading && worlds.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading worlds...</p>
        </div>
      </div>
    );
  }

  if (worlds.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">No worlds yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Place a <code>world</code> want on the canvas to create one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="grid gap-4 sm:gap-[26px] lg:gap-[34px]"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${GRID_COLUMN_WIDTH}px, 100%), 1fr))` }}
    >
      {worlds.map((world, index) => (
        <div
          key={world.name}
          data-keyboard-nav-selected={selectedWorld?.name === world.name}
          data-world-name={world.name}
          data-nav-index={index}
          className="h-full"
        >
          <WorldCard
            world={world}
            selected={selectedWorld?.name === world.name}
            onView={onViewWorld}
            onOpen={onOpenWorld}
            onRefresh={onRefresh}
            onExport={onExportWorld}
            opening={openingName === world.name}
            busy={openingName !== null}
            exporting={exportingName === world.name}
          />
        </div>
      ))}
    </div>
  );
};
