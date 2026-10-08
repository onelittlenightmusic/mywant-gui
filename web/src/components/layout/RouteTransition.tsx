import React, { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { classNames } from '@/utils/helpers';

/** Menu order (Header NAV_ENTRIES) — navigating to a later entry slides the
 *  new page in from the right, an earlier entry from the left, so screen
 *  changes carry the spatial layout of the menu. */
const ROUTE_ORDER = [
  '/dashboard',
  '/thing',
  '/want-types',
  '/worlds',
  '/agents',
  '/web-wants',
  '/recipes',
  '/achievements',
  '/logs',
  '/devices',
  '/extension',
  '/servers',
  '/characters',
];

/**
 * Directional page-enter animation on route changes. Enter-only (the old page
 * unmounts immediately) so heavy pages are never double-mounted. The animation
 * class is removed on animationend — a lingering transform would turn this
 * wrapper into a containing block and break position:fixed elements inside
 * pages.
 */
export const RouteTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [nav, setNav] = useState<{ key: number; cls: string }>({ key: 0, cls: '' });

  // Render-phase state update: detect the path change during render so the
  // new page's very first paint already carries the enter animation.
  if (prevPathRef.current !== location.pathname) {
    const from = ROUTE_ORDER.indexOf(prevPathRef.current);
    const to = ROUTE_ORDER.indexOf(location.pathname);
    const cls = from === -1 || to === -1 || to >= from
      ? 'animate-page-enter-right'
      : 'animate-page-enter-left';
    prevPathRef.current = location.pathname;
    setNav((n) => ({ key: n.key + 1, cls }));
  }

  return (
    <div
      key={nav.key}
      className={classNames('flex-1 flex flex-col min-w-0', nav.cls)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && nav.cls) setNav((n) => ({ ...n, cls: '' }));
      }}
    >
      {children}
    </div>
  );
};
