import React, { useLayoutEffect, useRef } from 'react';
import { classNames } from '@/utils/helpers';
import type { ReorderableGhostState } from './useReorderableGroup';

const GHOST_WIDTH = 192; // w-48 — matches the want-card ghost this was extracted from
/** How much larger a picked-up card is drawn than it lies. */
const LIFT_SCALE = 1.04;
/** The ghost's width: a desktop's small card, or most of a phone's width. */
function ghostWidth(): number {
  if (typeof window === 'undefined' || window.innerWidth >= 640) return GHOST_WIDTH;
  return Math.min(Math.round(window.innerWidth * 0.72), 300);
}
const GHOST_HEIGHT_ESTIMATE = 110;
const SCREEN_MARGIN = 8;

/** Clamps a ghost's center point so its bounding box stays fully on-screen —
 * only used in keyboard/gamepad mode (mouse mode just follows the cursor,
 * which is already on-screen by definition). */
function clampToViewport(x: number, y: number): { x: number; y: number } {
  const halfW = GHOST_WIDTH / 2;
  const halfH = GHOST_HEIGHT_ESTIMATE / 2;
  return {
    x: Math.min(Math.max(x, halfW + SCREEN_MARGIN), window.innerWidth - halfW - SCREEN_MARGIN),
    y: Math.min(Math.max(y, halfH + SCREEN_MARGIN), window.innerHeight - halfH - SCREEN_MARGIN),
  };
}

export interface ReorderableGhostProps {
  state: ReorderableGhostState | null;
  /** Character-colored border, matching the destination indicator. */
  color: string;
  /** Card body — app-specific (e.g. want-type icon badge + name). */
  renderContent: (id: string) => React.ReactNode;
  /** Optional scale multiplier for a consumer's own "hovering a valid
   * drop target" affordance (e.g. want's target-want nesting feature).
   * Defaults to 1 (no shrink). */
  scale?: number;
  className?: string;
  /** Extra inline styles merged onto the card (e.g. a background-image URL)
   * — applied underneath the border-color/opacity this component controls. */
  style?: React.CSSProperties;
}

/**
 * Generic floating reorder-drag ghost — a small floating card that follows
 * the drag (mouse cursor, or the keyboard/gamepad destination
 * indicator/continuous stick position) with a character-colored border.
 * Extracted from the want-dashboard's DragOverlay; content is fully
 * app-specific via `renderContent`.
 */
export const ReorderableGhost: React.FC<ReorderableGhostProps> = ({ state, color, renderContent, scale = 1, className, style }) => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const isMouseMode = !!state && !state.isKbMode;

  // Mouse mode: follow the cursor by writing left/top straight onto the node,
  // coalesced into one write per animation frame. `dragover` fires tens of
  // times a second, and routing it through React state (which is where this
  // used to live, up in useReorderableGroup) re-rendered the entire card grid
  // on every event — the single biggest cost of a drag. Nothing else on the
  // page depends on the pointer position, so it never needs to be state.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!isMouseMode || !node) return;
    // Stay invisible until the first dragover tells us where the cursor is, so
    // the ghost is never seen parked at the page origin for a frame.
    // left/top/visibility are absent from this element's React `style` prop in
    // mouse mode (see below), which is what makes it safe to own them here —
    // React only writes style keys that appear in the prop object, so a
    // re-render (a `scale` change, say) will not clobber these.
    node.style.visibility = 'hidden';
    let frame = 0;
    let pending: { x: number; y: number } | null = null;
    const flush = () => {
      frame = 0;
      if (!pending) return;
      node.style.left = `${pending.x}px`;
      node.style.top = `${pending.y}px`;
      node.style.visibility = 'visible';
    };
    const onDragOver = (e: DragEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    // A finger drags by touch, which sends no dragover: the ghost follows the
    // touch as well, or a phone's reorder had no picture under the finger.
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      pending = { x: t.clientX, y: t.clientY };
      if (!frame) frame = requestAnimationFrame(flush);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('touchmove', onTouchMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isMouseMode]);

  if (!state) return null;
  const kbPos = state.isKbMode && state.kbPos ? clampToViewport(state.kbPos.x, state.kbPos.y) : null;

  return (
    <div
      ref={nodeRef}
      className={classNames(
        'fixed pointer-events-none z-[9999] ease-out',
        state.isKbMode ? 'transition-[left,top,opacity] duration-200' : 'transition-transform duration-200',
      )}
      style={{
        // Keyboard/gamepad mode is low-frequency, so React drives the position.
        // Mouse mode omits left/top entirely and lets the layout effect above
        // own them — including them here would fight the per-frame writes.
        ...(kbPos ? { left: kbPos.x, top: kbPos.y } : null),
        // Lifted, the way a held card is on iOS: a touch larger than it lies.
        transform: `translate(-50%, -50%) scale(${scale * LIFT_SCALE})`,
      }}
    >
      <div
        className={classNames(
          'rounded-xl border p-4 overflow-hidden transition-all duration-300 relative bg-white dark:bg-gray-800',
          className,
        )}
        style={{
          ...style,
          // A phone's cards are a column the width of the screen: the ghost
          // is wider there, so it reads as the card picked up, not a token.
          width: ghostWidth(),
          borderColor: `${color}88`,
          // A soft lift shadow, not a hard drop shadow; a little see-through,
          // so where it will land still shows under it.
          boxShadow: '0 18px 40px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.18)',
          opacity: scale < 1 ? 0.85 : 0.94,
        }}
      >
        {renderContent(state.id)}
      </div>
    </div>
  );
};
