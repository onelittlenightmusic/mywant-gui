import React, { useMemo } from 'react';
import { classNames } from '@/utils/helpers';
import { useOverlayKeyNav } from '@/hooks/useOverlayKeyNav';

/**
 * A single action button entry for OverlayActionGrid.
 * Matches the shape used by QuickActionsOverlay, DeleteConfirmOverlay, and SlotOverlay.
 */
export interface OverlayItem {
  icon: React.ReactNode;
  /** Text label rendered below the icon. Only shown when showLabel=true. */
  label?: string;
  /** Tooltip / aria-label for the button */
  title?: string;
  onClick: () => void;
  /** Tailwind background color class (e.g. 'bg-green-600/90') */
  colorClass: string;
  /**
   * Inline styles merged onto the button, for colors Tailwind can't express.
   * Needed when the color is runtime data rather than a fixed palette entry —
   * e.g. a character's own `color` hex (see CharacterPickerGrid). Leave
   * colorClass empty when using this.
   */
  style?: React.CSSProperties;
  /** Animation delay in ms for the staggered quickActionBtnIn animation */
  delay: number;
  disabled?: boolean;
  /** Single keyboard key that triggers this item (e.g. 'y', 'n') */
  keyboard?: string;
}

interface OverlayActionGridProps {
  items: OverlayItem[];
  /** Number of columns; rows are computed automatically */
  cols: number;
  /** Called when the backdrop is clicked or onCancel fires */
  onClose: () => void;
  /**
   * Small heading shown above the grid (e.g. "Delete?"), for confirmation
   * overlays.
   *
   * A node, not only a string: a question about a particular thing reads
   * better with that thing's own glyph beside it than with its name spelled
   * out (see CameraAwayControls).
   */
  headerLabel?: React.ReactNode;
  /**
   * Tailwind ring class applied to the focused button, overriding the default.
   *
   * The default is the colour of whoever is at the controls — the same colour
   * their cursor and their card frames are drawn in — because that is what the
   * ring is saying: this is where YOU are. A fixed blue said it about nobody,
   * and on a shared board two people had the same ring.
   */
  focusRingClass?: string;
  /**
   * CSS classes for the outermost wrapper div.
   * Default: 'absolute inset-0 z-40 rounded-[inherit] overflow-hidden'
   * (matches want-card QuickActionsOverlay placement).
   * Use 'absolute inset-0 z-20 rounded-sm overflow-hidden' for small inventory slots.
   */
  className?: string;
  /**
   * CSS classes for the translucent backdrop div.
   * Default: 'absolute inset-0 bg-black/60 rounded-[inherit]'
   */
  backdropClassName?: string;
  /**
   * Whether to render the label text below each icon.
   * Default: true (icon + label). Set false for icon-only slots.
   */
  showLabel?: boolean;
  /** Initial focused button index. Default: 0. */
  initialFocus?: number;
  /**
   * Forwarded to useOverlayKeyNav → useInputActions.
   * Has no practical effect when captureInput=true (guards are bypassed).
   * Default: false so overlays work regardless of sidebar state.
   */
  ignoreWhenInSidebar?: boolean;
  /** onMouseDown on the outer wrapper (e.g. e.stopPropagation() for slot overlays) */
  onMouseDown?: (e: React.MouseEvent) => void;
  /**
   * When true, releasing the bumper of a B+L1/R1 chord confirms the focused
   * item — for pickers opened by that chord (hold-to-show, release-to-commit).
   * Default: false. See useOverlayKeyNav.
   */
  confirmOnTriggerRelease?: boolean;
  /**
   * Whether the arrows / Enter / Escape (and item shortcuts) are the grid's.
   * Default: true. False for a grid that stays on a card rather than being
   * opened on it — see useOverlayKeyNav's `enabled`. No focus ring is drawn
   * while it is off: there is nothing for the keys to be on.
   */
  keyboardEnabled?: boolean;
}

/**
 * Generic overlay that renders a grid of colored action buttons over a dark backdrop.
 * Used by QuickActionsOverlay (3×2 icon+label), DeleteConfirmOverlay (2×1 icon+label),
 * and inventory SlotOverlay (N×1 icon-only).
 *
 * Keyboard / gamepad navigation is handled by useOverlayKeyNav (captureInput priority).
 */
export const OverlayActionGrid: React.FC<OverlayActionGridProps> = ({
  items,
  cols,
  onClose,
  headerLabel,
  focusRingClass,
  className = 'absolute inset-0 z-40 rounded-[inherit] overflow-hidden',
  backdropClassName = 'absolute inset-0 bg-black/60 rounded-[inherit]',
  showLabel = true,
  initialFocus = 0,
  ignoreWhenInSidebar = false,
  onMouseDown,
  confirmOnTriggerRelease = false,
  keyboardEnabled = true,
}) => {
  const rows = Math.ceil(items.length / cols);

  // Per-item letter shortcuts ('y'/'n' for confirm/cancel, mostly). Handed to
  // useOverlayKeyNav so they ride the same captureInput handler as this grid's
  // arrows and Enter, instead of a document listener of their own that nothing
  // arbitrated — 'y' reached the Yes tile AND the board's Y button underneath.
  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const item of items) {
      if (!item.keyboard || item.disabled) continue;
      map[item.keyboard.toLowerCase()] = item.onClick;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [items]);

  const { focusedIndex, setFocusedIndex } = useOverlayKeyNav({
    cols,
    total: items.length,
    onConfirm: (idx) => { items[idx]?.onClick(); },
    onCancel: onClose,
    isDisabled: (idx) => !!items[idx]?.disabled,
    ignoreWhenInSidebar,
    initialFocus,
    confirmOnTriggerRelease,
    shortcuts,
    enabled: keyboardEnabled,
  });

  return (
    <div
      className={className}
      // "A card's action overlay is open", in one attribute. Both kinds of card
      // overlay carry it (see QuickActionsOverlay), so anything asking the
      // question — a test, the robot driver — asks it the same way instead of
      // pattern-matching on class names that exist for layout reasons.
      data-card-overlay="true"
      style={{ animation: 'quickActionsIn 150ms ease-out forwards' }}
      onMouseDown={onMouseDown}
    >
      {/* Translucent backdrop — click closes the overlay */}
      <div
        className={backdropClassName}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* Optional header label above the grid (e.g. "Delete?") */}
      {headerLabel && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center pt-3 pointer-events-none z-10">
          <span className="flex items-center gap-1.5 text-white text-xs font-bold uppercase tracking-widest opacity-80">
            {headerLabel}
          </span>
        </div>
      )}

      {/* Action button grid */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {items.map((item, idx) => (
          <div key={idx} className="pointer-events-auto h-full w-full">
            <button
              type="button"
              title={item.title}
              disabled={item.disabled}
              onClick={(e) => { e.stopPropagation(); if (!item.disabled) item.onClick(); }}
              onMouseEnter={() => setFocusedIndex(idx)}
              className={classNames(
                'flex flex-col items-center justify-center w-full h-full transition-all duration-150',
                showLabel ? 'gap-1' : '',
                item.disabled
                  ? 'bg-gray-400/30 cursor-not-allowed grayscale opacity-50'
                  : `hover:brightness-110 active:opacity-80 ${item.colorClass}`,
                // mw-focus-ring paints it in the character's colour; a caller
                // that named a class gets that instead.
                // Thick enough to read at a glance over a coloured tile, and
                // inset so it frames the tile without overlapping its
                // neighbours.
                keyboardEnabled && !item.disabled && idx === focusedIndex
                  ? classNames('ring-4 ring-inset', focusRingClass ?? 'mw-focus-ring')
                  : '',
              )}
              style={{
                animation: 'quickActionBtnIn 150ms ease-out both',
                animationDelay: `${item.delay}ms`,
                ...(item.disabled ? undefined : item.style),
              }}
            >
              {item.icon}
              {showLabel && item.label && (
                <span className="text-white text-[9px] font-bold leading-none uppercase tracking-tighter">
                  {item.label}
                </span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
