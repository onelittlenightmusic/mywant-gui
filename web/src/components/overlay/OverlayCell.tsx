import React from 'react';
import { classNames } from '@/utils/helpers';
import type { OverlayTone } from './tones';
import { useOverlayDesign } from './design';

export interface OverlayCellProps {
  icon: React.ReactNode;
  /** The word under the icon. */
  label?: React.ReactNode;
  /** Tooltip / accessible name. */
  title?: string;
  /**
   * What the action means — which is what colours it (see OverlayTone).
   * Leave it out only when `color` is given.
   */
  tone?: OverlayTone;
  /**
   * A colour that is data rather than meaning — a character's own colour, the
   * wire's. Painted as the cell's background in place of a tone.
   */
  color?: string;
  /**
   * The off half of an on/off action (exposed / not, marked / not): the same
   * tone, held back. Its colour still says what it is; its strength says
   * whether it is on.
   */
  off?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  /** The keys are on this cell: drawn with the ring of whoever holds them. */
  focused?: boolean;
  /**
   * Ring class for `focused`, overriding the default — which is the colour of
   * whoever is at the controls (mw-focus-ring), because that is what the ring
   * says: this is where YOU are.
   */
  focusRingClass?: string;
  /** Entrance stagger, in ms. */
  delay?: number;
  /** Icon only, no word. */
  showLabel?: boolean;
  /** Extra classes for the word — e.g. a name that has to be truncated. */
  labelClassName?: string;
  onMouseEnter?: () => void;
  /**
   * A cell that shows something rather than does something (the wire's list
   * of what it holds): drawn the same, but not a button.
   */
  static?: boolean;
  /** Drawn over the cell, e.g. a position number in a corner. */
  children?: React.ReactNode;
}

/**
 * One cell of an overlay: the unit every overlay is made of.
 *
 * A coloured tile, an icon over a small uppercase word, ringed when the keys
 * are on it. OverlayActionGrid lays these out; a bubble that needs its own
 * layout — cells beside a text field, a list that is not a menu — uses this
 * directly, so it looks and answers like every other overlay without copying
 * how they are painted.
 */
export const OverlayCell: React.FC<OverlayCellProps> = ({
  icon, label, title, tone, color, off, onClick, disabled, focused, focusRingClass, delay = 0,
  showLabel = true, labelClassName, onMouseEnter, static: isStatic, children,
}) => {
  const design = useOverlayDesign();
  const className = classNames(
    'relative flex flex-col items-center justify-center w-full h-full transition-all duration-150',
    showLabel ? 'gap-1' : '',
    design.cell,
    disabled
      ? design.disabled
      : classNames(!isStatic && design.cellInteractive, tone && !color ? design.tones[tone] : '', off && design.cellOff),
    focused && !disabled ? classNames(design.focus, focusRingClass ?? 'mw-focus-ring') : '',
  );
  const style: React.CSSProperties = {
    animation: design.cellEnterAnimation,
    animationDelay: `${delay}ms`,
    ...(color && !disabled ? { background: color } : undefined),
  };
  const body = (
    <>
      {children}
      {icon}
      {showLabel && label != null && label !== '' && (
        <span className={classNames(design.label, labelClassName)}>{label}</span>
      )}
    </>
  );
  if (isStatic) {
    return <div title={title} className={className} style={style} onMouseEnter={onMouseEnter}>{body}</div>;
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }}
      onMouseEnter={onMouseEnter}
      className={className}
      style={style}
    >
      {body}
    </button>
  );
};
