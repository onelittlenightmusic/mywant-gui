import React, { useEffect, useRef, useState } from 'react';

/**
 * Its children only once they are near being seen — a box of the same size
 * until then.
 *
 * For what is costly to build and sits below the fold: the detail panel's YAML
 * view is a code editor, and building one does not stop at its own elements —
 * it adds its styles to the page (a cursor's @keyframes), and the page's every
 * element has its style worked out again. That happened on every landing on a
 * want, for an editor at the bottom of a scroll nobody had reached. Once
 * built it stays.
 */
export const MountWhenNear: React.FC<{
  /** The box's class until then — the height the content will take. */
  className?: string;
  /** How far ahead of being seen it is built. */
  margin?: string;
  children: React.ReactNode;
}> = ({ className, margin = '200px', children }) => {
  const [near, setNear] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  if (near) return <>{children}</>;
  return <div ref={box} className={className} aria-hidden />;
};
