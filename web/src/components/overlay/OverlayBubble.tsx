import React from 'react';
import { classNames } from '@/utils/helpers';
import { useOverlayDesign } from './design';

export interface OverlayBubbleProps {
  /** Where it is, in viewport px: the point the tail touches when `anchor` is 'above'. */
  left: number;
  top: number;
  width: number;
  height: number;
  /**
   * 'above' — centred on (left, top) and lifted clear of it, with a tail
   * pointing down at it: a question about something on the board, asked
   * where that something is. 'at' — (left, top) is the box's own corner, no
   * tail: a control that places itself.
   */
  anchor?: 'above' | 'at';
  /** Positioned against the viewport (default) or the nearest positioned ancestor. */
  position?: 'fixed' | 'absolute';
  /** Stacking order. Default: 200, over the board and its cards. */
  zIndex?: number;
  className?: string;
  /**
   * Keys and presses inside stay inside — for a bubble with a text field: the
   * board listens for arrows and Shift, and a keystroke meant for the field
   * must never also walk a tile across it. Default: false.
   */
  contain?: boolean;
  children: React.ReactNode;
}

/** How far the box sits above the point it is about, clear of the tail. */
const LIFT_PX = 8;
const TAIL_PX = 9;

/**
 * The box a free-standing overlay is drawn in — a bubble on the board.
 *
 * An overlay over a card borrows the card's own box; one over the board has
 * none, and every one of them used to draw its own: the same dark frame, the
 * same border, the same tail, copied into each. The tail was also drawn INSIDE
 * the frame's overflow-hidden, so it was clipped away and never seen. It is
 * outside the frame here.
 */
export const OverlayBubble = React.forwardRef<HTMLDivElement, OverlayBubbleProps>(({
  left, top, width, height, anchor = 'above', position = 'fixed', zIndex = 200,
  className, contain = false, children,
}, ref) => {
  const design = useOverlayDesign();
  const above = anchor === 'above';
  return (
    <div
      ref={ref}
      className={classNames(position === 'fixed' ? 'fixed' : 'absolute', 'pointer-events-auto', className)}
      style={{
        left, top: above ? top - LIFT_PX : top, width, height, zIndex,
        transform: above ? 'translate(-50%, -100%)' : undefined,
      }}
      onKeyDown={contain ? (e) => e.stopPropagation() : undefined}
      onMouseDown={contain ? (e) => e.stopPropagation() : undefined}
    >
      <div className={classNames('relative h-full w-full', design.frame)}>
        {children}
      </div>
      {above && (
        <div
          aria-hidden
          style={{
            position: 'absolute', bottom: -TAIL_PX, left: '50%', marginLeft: -TAIL_PX,
            width: 0, height: 0,
            borderLeft: `${TAIL_PX}px solid transparent`,
            borderRight: `${TAIL_PX}px solid transparent`,
            borderTop: `${TAIL_PX}px solid ${design.tailColor}`,
          }}
        />
      )}
    </div>
  );
});
OverlayBubble.displayName = 'OverlayBubble';
