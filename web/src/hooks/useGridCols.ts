import { useEffect, useRef, useState } from 'react';

/**
 * Detects the actual rendered column count of a CSS grid container via ResizeObserver.
 * Reads `getComputedStyle(el).gridTemplateColumns` which reflects the live layout.
 * Falls back to 1 while the element is not yet mounted.
 *
 * Handles late-mounting: if the grid element is conditionally rendered (e.g. only shown
 * after data loads), the observer is set up automatically once the element appears.
 */
export function useGridCols(gridRef: React.RefObject<HTMLElement | null>): number {
  const [cols, setCols] = useState(1);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const update = () => {
      const el = gridRef.current;
      if (!el) return;
      try {
        const tracks = window.getComputedStyle(el).gridTemplateColumns;
        const c = tracks.split(' ').filter(s => s.trim() !== '').length;
        setCols(Math.max(1, c));
      } catch {
        setCols(1);
      }
    };

    const start = () => {
      const el = gridRef.current;
      if (!el) {
        // Grid not yet mounted (e.g. conditional render during data load) — retry
        retryTimer = setTimeout(start, 50);
        return;
      }
      update();
      const ro = new ResizeObserver(update);
      observerRef.current = ro;
      ro.observe(el);
    };

    start();

    return () => {
      if (retryTimer !== null) clearTimeout(retryTimer);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return cols;
}
