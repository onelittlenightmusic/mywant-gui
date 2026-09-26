import { useCallback, useEffect, useRef } from 'react';
import { Want } from '@/types/want';
import { useReorderableGroup } from '@/components/reorderable/useReorderableGroup';

/**
 * Putting the cards in the order you want them.
 *
 * Mouse drag with a ghost and a destination indicator, Shift+arrow from the
 * keyboard, A plus the D-pad or the left stick on a pad — all of it lives in
 * useReorderableGroup; this is the list's wiring of it, plus the one binding
 * that does not fit there.
 *
 * That binding is Cmd+Shift+arrow, which means "as far as it goes" and so has
 * to answer for both pages: in the list it jumps the card to the end, and on
 * the board it flings the carried tile to the neighbour in that direction. It
 * is one listener because it is one gesture, and it is here because the list
 * half is the half with state.
 */
export interface ListReorderApi {
  canvasMode: boolean;
  /** Read from the keydown handler, which must not be re-bound per render. */
  canvasModeRef: React.MutableRefObject<boolean>;
  isCanvasDraggingRef: React.MutableRefObject<boolean>;
  /** The wants the grid is showing, in the order it is showing them. */
  filteredWants: Want[];
  selectedWant: Want | null;
  containerRef: React.RefObject<HTMLDivElement>;
  /** Persist the new order. */
  onCommit: Parameters<typeof useReorderableGroup<Want>>[0]['onCommit'];
  /** Fling the carried tile to the neighbour in that direction, on the board. */
  onCanvasWarp: (dir: 'up' | 'down' | 'left' | 'right') => void;
}

export function useListReorder(api: ListReorderApi) {
  const { canvasMode, filteredWants, selectedWant, containerRef, onCommit } = api;

  const apiRef = useRef(api);
  apiRef.current = api;

  // Stable getId so useReorderableGroup's internal effects (e.g. the
  // destination indicator) aren't recreated every render.
  const getWantId = useCallback((w: Want) => w.metadata?.id || w.id || '', []);
  const selectedWantIdForReorder = selectedWant ? (selectedWant.metadata?.id || selectedWant.id || null) : null;

  // List-mode drag/reorder — mouse DnD, Shift+Arrow keyboard, A+D-pad /
  // A+left-stick gamepad (continuous), ghost overlay, destination
  // indicator, and sibling FLIP animation. See
  // web/src/components/reorderable/useReorderableGroup.ts.
  const reorder = useReorderableGroup<Want>({
    items: filteredWants,
    getId: getWantId,
    containerRef,
    selectedId: canvasMode ? null : selectedWantIdForReorder,
    enabled: !canvasMode && !!selectedWant,
    onCommit,
  });

  // Keyboard warp: Cmd+Shift+Arrow → warp drag cursor (canvas) or jump to edge (list)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const a = apiRef.current;
      if (!e.metaKey || !e.shiftKey || e.altKey || e.ctrlKey) return;
      const dir = e.key === 'ArrowUp'    ? 'up'    as const
                : e.key === 'ArrowDown'  ? 'down'  as const
                : e.key === 'ArrowLeft'  ? 'left'  as const
                : e.key === 'ArrowRight' ? 'right' as const
                : null;
      if (!dir) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (target.closest?.('[data-sidebar="true"][data-sidebar-open="true"]')) return;
      if (a.canvasModeRef.current) {
        if (!a.isCanvasDraggingRef.current) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        a.onCanvasWarp(dir);
      } else {
        e.preventDefault();
        e.stopImmediatePropagation();
        reorder.warpToEdge(dir);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [reorder.warpToEdge]); // reorder.warpToEdge is a stable useCallback; other reads go via refs

  return reorder;
}
