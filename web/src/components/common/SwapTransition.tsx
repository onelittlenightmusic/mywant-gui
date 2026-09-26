import React, { useRef, useState } from 'react';
import { classNames } from '@/utils/helpers';

interface SwapTransitionProps {
  /** Identity of the content (e.g. selected want/thing id). Changing it plays
   *  the enter animation on the new content. */
  swapKey: string;
  /** Position of the item in its list; when both old and new positions are
   *  known the slide direction follows them (next → from right, prev → from
   *  left), so keyboard-walking a grid feels like stepping between neighbours. */
  order?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Directional enter animation when swapping a panel's content in place —
 * enter-only (the old content unmounts immediately) so heavy sidebar trees
 * are never double-mounted. The animation class is dropped on animationend so
 * no transform lingers on the wrapper.
 */
export const SwapTransition: React.FC<SwapTransitionProps> = ({ swapKey, order, className, children }) => {
  const prevRef = useRef<{ key: string; order?: number }>({ key: swapKey, order });
  const [nav, setNav] = useState<{ n: number; cls: string }>({ n: 0, cls: '' });

  // Render-phase detection so the new content's first paint already animates.
  if (prevRef.current.key !== swapKey) {
    const prevOrder = prevRef.current.order;
    const fromLeft = order !== undefined && prevOrder !== undefined && order < prevOrder;
    prevRef.current = { key: swapKey, order };
    setNav((s) => ({ n: s.n + 1, cls: fromLeft ? 'animate-page-enter-left' : 'animate-page-enter-right' }));
  } else {
    prevRef.current.order = order;
  }

  return (
    <div
      key={nav.n}
      className={classNames('h-full', nav.cls, className || '')}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && nav.cls) setNav((s) => ({ ...s, cls: '' }));
      }}
    >
      {children}
    </div>
  );
};
