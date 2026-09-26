import React from 'react';
import { classNames } from '@/utils/helpers';

/**
 * A single action button definition for SidebarControlBar.
 * Matches the GridButton pattern from WantControlButtons (flat, full-height colored tiles).
 */
export interface SidebarControlItem {
  /** Lucide icon element (e.g. <Play className="w-4 h-4 text-white" />) */
  icon: React.ReactNode;
  /** Short label displayed below the icon */
  label: string;
  onClick?: () => void;
  /** Tailwind bg color class, e.g. "bg-green-600/90". Applied when enabled. */
  colorClass: string;
  disabled?: boolean;
  /** When true the button is not rendered at all (use for conditional actions). */
  hidden?: boolean;
  title?: string;
}

interface SidebarControlBarProps {
  items: SidebarControlItem[];
  /**
   * When true (bottom-header mode) the bar sits at the bottom of the sidebar:
   *   - border-t instead of border-b
   *   - order-last (flex child pushed to end)
   */
  isBottom?: boolean;
  className?: string;
}

/**
 * Flat, full-height grid of action buttons for detail sidebars.
 *
 * Mirrors the GridButton design in WantControlButtons:
 *   - `flex-col` icon stacked above label
 *   - colored `bg-*-600/90` tile when enabled
 *   - grayscale / low-opacity when disabled
 *   - `hover:brightness-110` hover effect
 *
 * Usage:
 * ```tsx
 * <SidebarControlBar
 *   isBottom={isBottom}
 *   items={[
 *     { icon: <Play className="w-4 h-4 text-white" />, label: 'Deploy',
 *       colorClass: 'bg-green-600/90', onClick: handleDeploy, disabled: !canDeploy },
 *     { icon: <Trash2 className="w-4 h-4 text-white" />, label: 'Delete',
 *       colorClass: 'bg-rose-700/90', onClick: handleDelete },
 *   ]}
 * />
 * ```
 */
export const SidebarControlBar: React.FC<SidebarControlBarProps> = ({
  items,
  isBottom = false,
  className,
}) => {
  const visible = items.filter(item => !item.hidden);
  if (visible.length === 0) return null;

  return (
    <div
      className={classNames(
        'flex-shrink-0 h-9 sm:h-14 relative overflow-hidden border-gray-200 dark:border-gray-700',
        isBottom ? 'order-last border-t' : 'border-b',
        className ?? '',
      )}
    >
      <div
        className="grid h-full"
        style={{ gridTemplateColumns: `repeat(${visible.length}, 1fr)` }}
      >
        {visible.map((item, idx) => (
          <GridButton key={idx} {...item} />
        ))}
      </div>
    </div>
  );
};

// ── Internal GridButton ────────────────────────────────────────────────────────

interface GridButtonProps extends SidebarControlItem {}

const GridButton: React.FC<GridButtonProps> = ({
  icon,
  label,
  onClick,
  colorClass,
  disabled = false,
  title,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    className={classNames(
      'flex flex-col items-center justify-center gap-0.5 sm:gap-1 w-full h-full transition-all duration-150',
      disabled
        ? 'bg-gray-400/20 dark:bg-gray-700/30 cursor-not-allowed grayscale opacity-40'
        : `${colorClass} hover:brightness-110 active:opacity-80`,
    )}
  >
    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center">
      {icon}
    </div>
    <span className="text-[9px] sm:text-[10px] font-bold leading-none uppercase tracking-tighter text-white">
      {label}
    </span>
  </button>
);
