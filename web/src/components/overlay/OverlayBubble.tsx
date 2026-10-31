import React from 'react';
import { createPortal } from 'react-dom';
import { classNames } from '@/utils/helpers';
import { useOverlayDesign } from './design';
import { nativeHost, useHostBubble } from '@/lib/nativeHost';

export interface OverlayBubbleProps {
  /** Where it is, in viewport px: the point the tail touches when `anchor` is 'above'. */
  left: number;
  top: number;
  /** Its size; left out, it is as large as what is in it (a line being said). */
  width?: number;
  height?: number;
  /**
   * 'above' — centred on (left, top) and lifted clear of it, with a tail
   * pointing down at it: a question about something on the board, asked
   * where that something is. 'at' — (left, top) is the box's own corner, no
   * tail: a control that places itself.
   */
  anchor?: 'above' | 'at';
  /** Positioned against the viewport (default) or the nearest positioned ancestor. */
  position?: 'fixed' | 'absolute';
  /**
   * Stacking order. Default: over everything — a question or a menu is the
   * one thing on screen being answered, so nothing (a character's chat, the
   * pad, a card) may sit over it.
   */
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
/** Above the pad's face buttons (9000) and every layer the board draws. */
const BUBBLE_Z = 9500;
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
  left, top, width, height, anchor = 'above', position = 'fixed', zIndex = BUBBLE_Z,
  className, contain = false, children,
}, ref) => {
  const design = useOverlayDesign();
  const above = anchor === 'above';
  // Framed by an app, the tail is the app's (useHostBubble): the box keeps
  // its fill, its contents and its shadow — no outline, as the app's corner
  // cards have none — and the tail and the arrival are drawn natively. The
  // fill is the design's, as in a browser: the app's used to be slate-900
  // whatever was chosen, black on the phone beside the sheet's white here,
  // and the app is told the fill it took so its tail continues it.
  const [frameEl, setFrameEl] = React.useState<HTMLDivElement | null>(null);
  useHostBubble(frameEl, above);
  const box = (
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
      <div ref={setFrameEl}
        className={classNames('relative h-full w-full', design.frame, nativeHost && '!border-0')}>
        {children}
      </div>
      {above && !nativeHost && (
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
  // Placed against the viewport, it is put at the top of the page: drawn where
  // it was asked for, it sat in whatever stacking its parent made (the board's
  // layers), and things outside that — a character's chat — went over it
  // however high its own z-index.
  return position === 'fixed' && typeof document !== 'undefined' ? createPortal(box, document.body) : box;
});
OverlayBubble.displayName = 'OverlayBubble';
