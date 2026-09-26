import React, { useEffect, useMemo, useRef } from 'react';
import { Achievement } from '@/types/achievement';
import { AchievementCard } from './AchievementCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useGridMotion } from '@/hooks/useGridMotion';

/** The house grid: three columns at most, responsive gaps, top-aligned rows. */
const GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 items-start';

interface AchievementGridProps {
  achievements: Achievement[];
  loading: boolean;
  /** Achievement currently shown in the details sidebar. */
  selectedId?: string | null;
  onView: (achievement: Achievement) => void;
  onDelete?: (id: string) => void;
  onUnlock?: (id: string) => void;
  onLock?: (id: string) => void;
  /** Reports the rendered list upward so the page can navigate it. */
  onGetFiltered?: (achievements: Achievement[]) => void;
  /** Forwarded to the grid div so the parent can detect column count. */
  gridRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * AchievementGrid — one flat wall of cards, like the thing and want grids.
 *
 * No filter row and no count footer: level, category and capability are all
 * stated on the card itself, and the page's own header carries the count.
 */
export const AchievementGrid: React.FC<AchievementGridProps> = ({
  achievements,
  loading,
  selectedId,
  onView,
  onDelete,
  onUnlock,
  onLock,
  onGetFiltered,
  gridRef,
}) => {
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = gridRef ?? localRef;

  useEffect(() => {
    onGetFiltered?.(achievements);
  }, [achievements, onGetFiltered]);

  const signature = useMemo(() => achievements.map(a => a.id).join('|'), [achievements]);
  useGridMotion(containerRef, signature);

  if (loading && achievements.length === 0) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={GRID_CLASS}>
      {achievements.map((a) => (
        <div key={a.id} data-flip-key={a.id} data-keyboard-nav-selected={selectedId === a.id}>
          <AchievementCard
            achievement={a}
            selected={selectedId === a.id}
            onView={onView}
            onDelete={onDelete}
            onUnlock={onUnlock}
            onLock={onLock}
          />
        </div>
      ))}
    </div>
  );
};
