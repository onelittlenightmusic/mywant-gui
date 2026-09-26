import React, { useLayoutEffect, useRef } from 'react';

/**
 * Enter animation for grid children marked with `data-flip-key`.
 *
 * A child whose key wasn't present last commit plays the card-enter pop
 * (skipped on the grid's very first commit so initial page load doesn't
 * stampede). The class is applied to the child's first element child — NOT
 * the marked wrapper — because useReorderableGroup's own FLIP measures the
 * wrappers (`data-reorder-id`) with getBoundingClientRect, and a transform
 * from our animation on the same element would corrupt its position
 * baselines (which broke drag-reorder). Position moves (reorder commits,
 * filter/sort reflows) are owned entirely by that hook's FLIP; this one only
 * does lifecycle.
 *
 * @param childrenSignature A value that changes exactly when the set of
 * rendered `data-flip-key` children changes. Without it this ran on every
 * render — a querySelectorAll over the whole grid on each of the many renders
 * a drag produces — even though only list membership can affect the outcome.
 */
export function useGridMotion(containerRef: React.RefObject<HTMLElement | null>, childrenSignature: string) {
  const prevKeysRef = useRef<Set<string>>(new Set());
  const firstRunRef = useRef(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const els = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-key]'));
    const nextKeys = new Set<string>();
    for (const el of els) {
      const key = el.dataset.flipKey as string;
      nextKeys.add(key);
      if (firstRunRef.current || prevKeysRef.current.has(key)) continue;
      const target = (el.firstElementChild as HTMLElement | null) ?? el;
      target.classList.remove('animate-card-enter');
      void target.offsetWidth;
      target.classList.add('animate-card-enter');
    }
    firstRunRef.current = false;
    prevKeysRef.current = nextKeys;
  }, [containerRef, childrenSignature]);
}

/*
 * Deliberately no exit animation counterpart. Keeping a deleted card mounted
 * for a fade means splicing a phantom entry back into the list the grid maps
 * over, and that list's indexes are the same ones WantCard/ThingCard hand to
 * the reorder engine — a ghost shifts every following card's reorder index.
 * A stale ghost also holds an empty grid slot open. Removal stays instant.
 */
