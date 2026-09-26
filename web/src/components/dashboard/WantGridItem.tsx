import React, { useCallback } from 'react';
import { Want } from '@/types/want';
import { WantCard } from './WantCard';

type WantCardProps = React.ComponentProps<typeof WantCard>;

/**
 * One card slot in the want grid, memoized.
 *
 * WantCard is expensive (dozens of hooks, an iframe, a slide deck) and the grid
 * renders one per want, so an unmemoized card meant every grid render was a
 * render of every card. Memoizing it only pays off if none of its props change
 * identity per render, which rules out writing the per-want closures
 * (`onView`, `onOpenBalloon`) inline in the grid's map — those allocate a fresh
 * function per card per render and defeat the comparison. They live here
 * instead, bound with useCallback to this one want, so the grid can hand down
 * only stable handlers.
 *
 * The `data-*` wrapper stays here too: `data-reorder-id` is what
 * useReorderableGroup's gap detection and FLIP animation query for, and
 * `data-flip-key` is what useGridMotion's pop-in looks at.
 */
interface WantGridItemProps extends Omit<WantCardProps, 'onView' | 'onOpenBalloon' | 'children'> {
  wantId: string | undefined;
  childWants?: Want[];
  isKeyboardNavSelected: boolean;
  /** Grid-level view/select handlers; the per-want closure is built here. */
  onViewWant: (want: Want) => void;
  onSelectWant?: (wantId: string) => void;
  onOpenBalloonWant?: (want: Want) => void;
}

const WantGridItemInner: React.FC<WantGridItemProps> = ({
  wantId,
  childWants,
  isKeyboardNavSelected,
  onViewWant,
  onSelectWant,
  onOpenBalloonWant,
  ...cardProps
}) => {
  const { want, isSelectMode } = cardProps;

  const handleView = useCallback(
    (w: Want) => {
      if (isSelectMode && onSelectWant) onSelectWant(w.metadata?.id || w.id || '');
      else onViewWant(w);
    },
    [isSelectMode, onSelectWant, onViewWant],
  );

  const handleOpenBalloon = useCallback(
    () => onOpenBalloonWant?.(want),
    [onOpenBalloonWant, want],
  );

  return (
    <div
      data-want-id={wantId}
      data-reorder-id={wantId}
      data-flip-key={wantId}
      data-keyboard-nav-selected={isKeyboardNavSelected}
      className="transition-all duration-300 ease-out h-full relative"
    >
      <WantCard
        {...cardProps}
        children={childWants}
        onView={handleView}
        onOpenBalloon={onOpenBalloonWant ? handleOpenBalloon : undefined}
      />
    </div>
  );
};

export const WantGridItem = React.memo(WantGridItemInner);
