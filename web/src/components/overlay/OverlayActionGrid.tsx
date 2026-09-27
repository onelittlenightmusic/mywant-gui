import React, { useMemo } from 'react';
import { useOverlayKeyNav } from '@/hooks/useOverlayKeyNav';
import { OverlayCell } from './OverlayCell';
import type { OverlayTone } from './tones';
import { useOverlayDesign } from './design';

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
  /** What the action means, which decides its colour — see OverlayTone. */
  tone?: OverlayTone;
  /**
   * A colour that is data rather than meaning — a character's own `color` hex
   * (see CharacterPickerGrid). Takes the place of `tone`.
   */
  color?: string;
  /** The off half of an on/off action — see OverlayCell. */
  off?: boolean;
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
  backdropClassName,
  showLabel = true,
  initialFocus = 0,
  ignoreWhenInSidebar = false,
  onMouseDown,
  confirmOnTriggerRelease = false,
  keyboardEnabled = true,
}) => {
  const design = useOverlayDesign();
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
      style={{ animation: design.enterAnimation }}
      onMouseDown={onMouseDown}
    >
      {/* Translucent backdrop — click closes the overlay */}
      <div
        className={backdropClassName ?? `absolute inset-0 rounded-[inherit] ${design.backdrop}`}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />

      {/* Optional header label above the grid (e.g. "Delete?") */}
      {headerLabel && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center pt-3 pointer-events-none z-10">
          <span className={design.header}>
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
            <OverlayCell
              icon={item.icon}
              label={item.label}
              title={item.title}
              tone={item.tone}
              color={item.color}
              off={item.off}
              disabled={item.disabled}
              onClick={item.onClick}
              onMouseEnter={() => setFocusedIndex(idx)}
              focused={keyboardEnabled && idx === focusedIndex}
              focusRingClass={focusRingClass}
              delay={item.delay}
              showLabel={showLabel}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
