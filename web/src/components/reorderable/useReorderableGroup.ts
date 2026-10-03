import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInputActions, isConfirmHeld, type NavigationDirection } from '@/hooks/useInputActions';
import { getControllerState } from '@/lib/controllerHub';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';

/** Internal-only HTML5 DnD MIME type — never inspected by anything outside
 * this hook, so multiple independent `useReorderableGroup` instances on the
 * same page never interfere with each other's drags. */
const DRAG_MIME = 'application/x-reorderable-item';

/** DOM attribute every card wrapper must carry (via getItemProps, or set
 * manually when using the lower-level primitives) — gap detection and the
 * FLIP animation both look items up by this. */
export const REORDER_ID_ATTR = 'data-reorder-id';

const DRAG_SPEED_PX = 22; // matches useFreeCursorNav's continuous-drag feel
const DRAG_THRESHOLD = 0.15;

export type ReorderPosition = 'before' | 'after';

/**
 * Where the destination line is drawn, in the container's coordinates: down
 * the side of the card it goes before (cards side by side), or — horizontal,
 * with a width — across the top of it (cards stacked one per row, a phone).
 */
export interface ReorderIndicator {
  left: number;
  top: number;
  height: number;
  color: string;
  horizontal?: boolean;
  width?: number;
}

/** Cards stacked one per row: each takes most of the container's width. */
function isStacked(card: HTMLElement, container: HTMLElement | null): boolean {
  if (!container) return false;
  return card.getBoundingClientRect().width > container.getBoundingClientRect().width * 0.6;
}

export interface ReorderableGhostState {
  id: string;
  /** Anchor point for keyboard/gamepad mode only. In mouse mode this is null
   * and ReorderableGhost follows the cursor itself: tracking the pointer as
   * React state here would re-render the entire consumer tree (the whole want
   * dashboard) on every `dragover` event, tens of times per second. */
  kbPos: { x: number; y: number } | null;
  isKbMode: boolean;
}

export interface UseReorderableGroupOptions<T> {
  items: T[];
  getId: (item: T) => string;
  containerRef: React.RefObject<HTMLElement | null>;
  selectedId: string | null;
  enabled: boolean;
  onCommit: (id: string, previousId: string | undefined, nextId: string | undefined) => void | Promise<void>;
}

export interface ReorderableItemHandlers {
  draggable: true;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragSource: boolean;
}

export interface UseReorderableGroupResult<T> {
  containerProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
  };
  getItemProps: (item: T, index: number) => ReorderableItemHandlers;
  indicator: ReorderIndicator | null;
  ghost: ReorderableGhostState | null;
  warpToEdge: (dir: NavigationDirection) => Promise<void>;
  isDragSource: (id: string) => boolean;
  /** True only while `id` is armed via keyboard/gamepad specifically (not
   * mouse) — drives a "picked up" overlay distinct from a mouse
   * long-press's own affordance, matching the want-card feature this was
   * extracted from. */
  isKbDragSource: (id: string) => boolean;
  startDrag: (id: string) => void;
  endDrag: () => void;
  getDragOverPosition: (cardEl: HTMLElement, clientX: number, clientY?: number) => ReorderPosition;
  reportDragOverGap: (index: number, position: ReorderPosition | null) => void;
  commitDrop: (draggedId: string, index: number, position: ReorderPosition) => Promise<void>;
}

/**
 * Generic drag/reorder engine for a group of same-type cards — extracted
 * from the want-dashboard's reorder feature (mouse DnD, Shift+Arrow
 * keyboard, A+D-pad / A+left-stick gamepad with continuous screen-
 * coordinate drag, a shared destination indicator, and a sibling FLIP
 * animation). Instance-scoped: every mounted call gets its own isolated
 * drag state (unlike the original want-only implementation, which lived in
 * the global wantStore) so multiple independent reorderable groups can
 * coexist on a page without interfering with each other.
 *
 * Card color theming (border/indicator) intentionally is NOT a prop here —
 * call sites read `cursorColor` from `useCharacterStore` themselves and
 * pass it to their own ghost renderer; only the indicator (owned entirely
 * by this hook) takes a color, read the same way.
 */
export function useReorderableGroup<T>({
  items,
  getId,
  containerRef,
  selectedId,
  enabled,
  onCommit,
}: UseReorderableGroupOptions<T>): UseReorderableGroupResult<T> {
  // ---- Mouse drag state ----
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverGap, setDragOverGap] = useState<number | null>(null);

  // ---- Keyboard/gamepad preview state ----
  const [kbReorderId, setKbReorderId] = useState<string | null>(null);
  const [kbReorderGapIndex, setKbReorderGapIndex] = useState<number | null>(null);
  const [kbReorderGhostPos, setKbReorderGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [kbReorderFreePos, setKbReorderFreePos] = useState<{ x: number; y: number } | null>(null);

  // The destination indicator's color — same source as the free-roaming
  // cursor / canvas CursorMan / the reorder ghost, so "this is what I'm
  // moving" reads consistently everywhere. Read via a ref (synced every
  // render, not a dependency of the indicator effect below) since it's
  // needed only at the moment that effect (re)computes position.
  const isDarkMode = useDarkMode();
  const getMyCharacter = useCharacterStore(s => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore(s => s.myDefaultCursorColor);
  const cursorColor = getMyCharacter()?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDarkMode);
  const cursorColorRef = useRef(cursorColor);
  cursorColorRef.current = cursorColor;

  const setKbReorderPreview = useCallback((id: string | null, gapIndex: number | null) => {
    setKbReorderId(id);
    setKbReorderGapIndex(gapIndex);
  }, []);

  // Unify mouse drag's local dragOverGap with a pending keyboard/gamepad
  // reorder preview so the exact same destination indicator renders
  // regardless of which input is driving the reorder — only one of the two
  // is ever active at a time.
  const effectiveDragOverGap = dragOverGap ?? kbReorderGapIndex;
  const effectiveDraggingId = draggingId ?? kbReorderId;

  const idsRef = useRef(items.map(getId));
  idsRef.current = items.map(getId);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getIdRef = useRef(getId);
  getIdRef.current = getId;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Clear the mouse drag indicator when dragging stops.
  useEffect(() => {
    if (!draggingId) setDragOverGap(null);
  }, [draggingId]);

  const queryCard = useCallback((id: string): HTMLElement | null => {
    const container = containerRef.current;
    if (!container) return null;
    return container.querySelector<HTMLElement>(`[${REORDER_ID_ATTR}="${id}"]`);
  }, [containerRef]);

  // ---- Mouse: per-card before/after detection + gap-index reporting ----
  const getDragOverPosition = useCallback((cardEl: HTMLElement, clientX: number, clientY?: number): ReorderPosition => {
    const rect = cardEl.getBoundingClientRect();
    // Cards stacked one per row (a phone): before/after is above/below.
    if (clientY !== undefined && isStacked(cardEl, containerRef.current)) {
      return clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    }
    return clientX - rect.left < rect.width / 2 ? 'before' : 'after';
  }, [containerRef]);

  // Called from every card's onDragOver, i.e. many times a second while a drag
  // is in flight, but the gap only actually moves when the cursor crosses a
  // card's midpoint. The functional form makes the no-change case an explicit
  // bail-out rather than relying on React's state-equality shortcut.
  const reportDragOverGap = useCallback((index: number, position: ReorderPosition | null) => {
    const next = position === 'before' ? index : position === 'after' ? index + 1 : null;
    setDragOverGap(prev => (prev === next ? prev : next));
  }, []);

  // ---- Mouse: gap detection while hovering the grid background (not
  // directly over a card) — nearest card by center-to-center distance,
  // before/after by which side of its center the cursor falls on. ----
  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    // Consumers using the bundled getItemProps set DRAG_MIME themselves;
    // consumers composing manually (e.g. WantCard, which layers its own
    // "drop onto a target to connect" feature on top) call startDrag(id)
    // directly instead, which is reflected in `draggingId` alone — no MIME
    // type convention needs to be shared between this hook and a manually
    // composing consumer.
    if (!draggingId) return;
    e.preventDefault();
    if ((e.target as HTMLElement).closest(`[${REORDER_ID_ATTR}]`)) return; // handled by the card's own onDragOver
    const container = containerRef.current;
    if (!container) return;
    const cardElements = Array.from(container.querySelectorAll<HTMLElement>(`[${REORDER_ID_ATTR}]`));
    if (cardElements.length === 0) return;
    let closestIndex = -1;
    let minDistance = Infinity;
    let isAfter = false;
    cardElements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      if (dist < minDistance) { minDistance = dist; closestIndex = idx; isAfter = e.clientX > centerX; }
    });
    if (closestIndex !== -1) setDragOverGap(isAfter ? closestIndex + 1 : closestIndex);
  }, [draggingId, containerRef]);

  const handleGridDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
      setDragOverGap(null);
    }
  }, []);

  /**
   * `index` addresses the target card's position in the full rendered list.
   * The neighbour ids handed to onCommit, however, have to be computed with
   * the dragged card taken OUT of the list — otherwise a drop next to the
   * dragged card's own slot names the dragged card as its own previous/next
   * neighbour, and the backend ends up deriving the want's new order key from
   * its own current key. That produced a no-op move plus a pointless key
   * rewrite (and an ever-lengthening order key) on every such drop. The
   * keyboard/gamepad path (commitPreview) always worked in this space; this is
   * the mouse/touch path catching up.
   */
  const commitDrop = useCallback(async (draggedId: string, index: number, position: ReorderPosition) => {
    const currentItems = itemsRef.current;
    const getIdFn = getIdRef.current;
    if (index < 0 || index >= currentItems.length) return;
    const targetId = getIdFn(currentItems[index]);
    // Dropped onto the dragged card itself: there is no move to make.
    if (targetId === draggedId) return;

    const withoutMoved = currentItems.filter(it => getIdFn(it) !== draggedId);
    const targetIdx = withoutMoved.findIndex(it => getIdFn(it) === targetId);
    if (targetIdx === -1) return;

    const targetGap = position === 'before' ? targetIdx : targetIdx + 1;
    const previous = withoutMoved[targetGap - 1];
    const next = withoutMoved[targetGap];
    await onCommitRef.current(
      draggedId,
      previous ? getIdFn(previous) : undefined,
      next ? getIdFn(next) : undefined,
    );
  }, []);

  const startDrag = useCallback((id: string) => setDraggingId(id), []);
  const endDrag = useCallback(() => setDraggingId(null), []);
  const isDragSourceFn = useCallback((id: string) => effectiveDraggingId === id, [effectiveDraggingId]);
  const isKbDragSourceFn = useCallback((id: string) => !draggingId && kbReorderId === id, [draggingId, kbReorderId]);

  const getItemProps = useCallback((item: T, index: number): ReorderableItemHandlers => {
    const id = getId(item);
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData(DRAG_MIME, id);
        e.dataTransfer.effectAllowed = 'move';
        startDrag(id);
      },
      onDragOver: (e: React.DragEvent) => {
        const isItemDrag = !!draggingId || e.dataTransfer.types.includes(DRAG_MIME);
        if (!isItemDrag) return;
        e.preventDefault();
        e.stopPropagation();
        const position = getDragOverPosition(e.currentTarget as HTMLElement, e.clientX, e.clientY);
        reportDragOverGap(index, position);
        e.dataTransfer.dropEffect = 'move';
      },
      onDrop: (e: React.DragEvent) => {
        const draggedId = e.dataTransfer.getData(DRAG_MIME) || draggingId;
        if (!draggedId) return;
        e.preventDefault();
        e.stopPropagation();
        const position = getDragOverPosition(e.currentTarget as HTMLElement, e.clientX, e.clientY);
        endDrag();
        commitDrop(draggedId, index, position).catch(err => console.error('[useReorderableGroup] commit failed:', err));
      },
      onDragEnd: () => endDrag(),
      isDragSource: isDragSourceFn(id),
    };
  }, [getId, draggingId, getDragOverPosition, reportDragOverGap, startDrag, endDrag, commitDrop, isDragSourceFn]);

  // ---- Keyboard/gamepad: preview step, commit, cancel, start ----
  const kbReorderIdRef = useRef(kbReorderId);
  kbReorderIdRef.current = kbReorderId;
  const kbReorderGapIndexRef = useRef(kbReorderGapIndex);
  kbReorderGapIndexRef.current = kbReorderGapIndex;
  const kbReorderGhostPosRef = useRef(kbReorderGhostPos);
  kbReorderGhostPosRef.current = kbReorderGhostPos;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const handleMove = useCallback((dir: NavigationDirection) => {
    const id = selectedIdRef.current;
    if (!id) return;
    // Preview-only while Shift (keyboard) / A (gamepad) is held — commits
    // via commitPreview on release. `withoutMoved` (items with the moved
    // one excluded) is the coordinate space kbReorderGapIndex lives in:
    // removing the item at its current position k leaves everything
    // before it at the same index and shifts everything after it back by
    // one, so k is *also* exactly the gap position representing
    // "unchanged" in withoutMoved.
    const currentItems = itemsRef.current;
    const idx = currentItems.findIndex(it => getIdRef.current(it) === id);
    if (idx < 0) return;
    const withoutMoved = currentItems.filter(it => getIdRef.current(it) !== id);
    const curIdx = kbReorderIdRef.current === id && kbReorderGapIndexRef.current !== null
      ? kbReorderGapIndexRef.current
      : idx;
    let nextIdx = curIdx;
    if (dir === 'right' || dir === 'down') nextIdx = Math.min(withoutMoved.length, curIdx + 1);
    else if (dir === 'left' || dir === 'up') nextIdx = Math.max(0, curIdx - 1);
    else return;
    if (nextIdx === curIdx) return;
    setKbReorderPreview(id, nextIdx);
  }, [setKbReorderPreview]);

  const commitPreview = useCallback(() => {
    const id = kbReorderIdRef.current;
    const gapIndex = kbReorderGapIndexRef.current;
    setKbReorderPreview(null, null);
    if (!id || gapIndex === null) return;
    const withoutMoved = itemsRef.current.filter(it => getIdRef.current(it) !== id);
    const prev = withoutMoved[gapIndex - 1];
    const next = withoutMoved[gapIndex];
    onCommitRef.current(id, prev ? getIdRef.current(prev) : undefined, next ? getIdRef.current(next) : undefined);
  }, [setKbReorderPreview]);

  const cancelPreview = useCallback(() => {
    setKbReorderPreview(null, null);
  }, [setKbReorderPreview]);

  const startPreview = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id || kbReorderIdRef.current) return;
    const idx = itemsRef.current.findIndex(it => getIdRef.current(it) === id);
    if (idx < 0) return;
    setKbReorderPreview(id, idx);
  }, [setKbReorderPreview]);

  // Keyboard commit path: Shift keyup. (Gamepad's equivalent is
  // onConfirmReleased via useInputActions below — A has no notion of "the
  // modifier for arrow keys" the way a real Shift key does.)
  useEffect(() => {
    if (!kbReorderId) return;
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') commitPreview(); };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [kbReorderId, commitPreview]);

  // Keyboard "picked up" signal: Shift held ~400ms with no arrow pressed
  // yet shows the same ghost/highlight an arrow press would — mirrors the
  // mouse long-press affordance and the gamepad onConfirmLong below.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Shift' || e.repeat || timer) return;
      timer = setTimeout(() => { timer = null; startPreview(); }, 400);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Shift' || !timer) return;
      clearTimeout(timer);
      timer = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, startPreview]);

  // Given a screen point, find which gap (in the withoutMoved coordinate
  // space) it's over. Two cases:
  //  - The point is actually inside some card's own bounding box: use THAT
  //    card's own left/right half as the before/after split — mirrors the
  //    mouse per-card dragover handler exactly, so hovering the right half
  //    of a card always means "insert after this card" regardless of which
  //    card happens to be nearest by raw distance (which, in a
  //    multi-column grid, can be a neighboring card rather than the one
  //    actually under the cursor).
  //  - The point is over a gap/background (inside no card): fall back to
  //    nearest remaining card by center-to-center distance, before/after
  //    by which side of that card's center the point falls on.
  const computeGapIndexFromPoint = useCallback((x: number, y: number, excludeId: string): number | null => {
    const withoutMoved = itemsRef.current.filter(it => getIdRef.current(it) !== excludeId);
    if (withoutMoved.length === 0) return 0;
    let closestIdx = -1;
    let minDist = Infinity;
    let isAfter = false;
    let foundContaining = false;
    withoutMoved.forEach((it, idx) => {
      if (foundContaining) return;
      const el = queryCard(getIdRef.current(it));
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        foundContaining = true;
        closestIdx = idx;
        isAfter = x > rect.left + rect.width / 2;
        return;
      }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = (x - cx) ** 2 + (y - cy) ** 2;
      if (dist < minDist) { minDist = dist; closestIdx = idx; isAfter = x > cx; }
    });
    if (closestIdx === -1) return null;
    return isAfter ? closestIdx + 1 : closestIdx;
  }, [queryCard]);
  const computeGapIndexFromPointRef = useRef(computeGapIndexFromPoint);
  computeGapIndexFromPointRef.current = computeGapIndexFromPoint;

  // Continuous A+left-stick reorder drag — screen-coordinate-based
  // continuous motion, the same mechanism as the app's free-roaming cursor,
  // rather than the discrete per-tick stepping D-pad/keyboard arrows use.
  // Active for as long as a reorder is armed (kbReorderId set) and A is
  // still physically held. The ghost stays parked wherever it last was
  // while the stick is at rest (no snap-to-indicator mid-drag) — only
  // release of A (onConfirmReleased) or B/Escape (onCancel) ends it.
  const stickDragPosRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!kbReorderId || !enabled) {
      if (stickDragPosRef.current) {
        stickDragPosRef.current = null;
        setKbReorderFreePos(null);
      }
      return;
    }
    const id = kbReorderId;
    let rafHandle: number;
    const poll = () => {
      if (!isConfirmHeld()) {
        if (stickDragPosRef.current) {
          stickDragPosRef.current = null;
          setKbReorderFreePos(null);
        }
        rafHandle = requestAnimationFrame(poll);
        return;
      }
      const ctrl = getControllerState();
      const lx = ctrl?.axes[0] ?? 0;
      const ly = ctrl?.axes[1] ?? 0;
      const mag = Math.hypot(lx, ly);
      if (mag > DRAG_THRESHOLD) {
        if (!stickDragPosRef.current) {
          stickDragPosRef.current = kbReorderGhostPosRef.current
            ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }
        const nlx = lx / mag, nly = ly / mag;
        const speed = DRAG_SPEED_PX * mag;
        const nx = Math.max(0, Math.min(window.innerWidth, stickDragPosRef.current.x + nlx * speed));
        const ny = Math.max(0, Math.min(window.innerHeight, stickDragPosRef.current.y + nly * speed));
        stickDragPosRef.current = { x: nx, y: ny };
        setKbReorderFreePos({ x: nx, y: ny });
        const gapIndex = computeGapIndexFromPointRef.current(nx, ny, id);
        if (gapIndex !== null && gapIndex !== kbReorderGapIndexRef.current) {
          setKbReorderPreview(id, gapIndex);
        }
      }
      // Stick at rest (but A still held): intentionally do nothing — leave
      // the ghost parked exactly where it stopped instead of snapping back
      // to the discrete destination indicator.
      rafHandle = requestAnimationFrame(poll);
    };
    rafHandle = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(rafHandle);
      if (stickDragPosRef.current) {
        stickDragPosRef.current = null;
        setKbReorderFreePos(null);
      }
    };
  }, [kbReorderId, enabled, setKbReorderPreview]);

  // ---- Warp to edge: jump the selected item to the very start/end. ----
  const warpToEdge = useCallback(async (dir: NavigationDirection) => {
    const id = selectedIdRef.current;
    if (!id) return;
    const currentItems = itemsRef.current;
    if (dir === 'right' || dir === 'down') {
      const last = currentItems[currentItems.length - 1];
      const lastId = last ? getIdRef.current(last) : undefined;
      if (!lastId || lastId === id) return;
      await onCommitRef.current(id, lastId, undefined);
    } else if (dir === 'left' || dir === 'up') {
      const first = currentItems[0];
      const firstId = first ? getIdRef.current(first) : undefined;
      if (!firstId || firstId === id) return;
      await onCommitRef.current(id, undefined, firstId);
    }
  }, []);

  useInputActions({
    enabled,
    onMove: handleMove,
    // Once a reorder preview is active, D-pad steps the preview one
    // position at a time just like Shift+Arrow/A+stick, instead of
    // jumping to the edge — the "picked up" state changes what A+D-pad
    // means for the duration.
    onWarp: (dir) => {
      if (kbReorderIdRef.current) { handleMove(dir); return; }
      warpToEdge(dir);
    },
    onConfirmReleased: commitPreview,
    onCancel: cancelPreview,
    onConfirmLong: startPreview,
  });

  // Mouse ghost position is deliberately NOT tracked here — ReorderableGhost
  // follows the cursor itself, writing the position straight to the DOM. See
  // ReorderableGhostState.kbPos.

  // ---- Sibling FLIP animation ----
  // Only a change in the *order/membership* of ids should replay the slide —
  // NOT every store update. Adding one want triggers a burst of updates while
  // it reconciles (optimistic insert → fetchWants → SSE/250ms-poll picking up
  // each status transition), and each transition changes the card's height,
  // reflowing the cards below. If we animated on every `items` reference change
  // the grid would visibly re-shuffle several times per add. So we still
  // measure every render (keeping prevRects fresh, no stale vertical drift) but
  // only animate the FLIP when the id sequence actually changed.
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const prevOrderRef = useRef<string>('');
  // useLayoutEffect (not useEffect): FLIP must measure the new layout and invert
  // it *before* the browser paints. A post-paint useEffect lets the browser
  // paint every card at its final position first, so a full-list re-sort
  // (switching sort mode, or returning to the manual "default" order) snaps
  // instead of sliding — the single-card drag case just happened to hide it.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const order = items.map(getId).join(' ');
    const orderChanged = order !== prevOrderRef.current;
    prevOrderRef.current = order;

    const nodes = container.querySelectorAll<HTMLElement>(`[${REORDER_ID_ATTR}]`);
    const prevRects = prevRectsRef.current;
    const nextRects = new Map<string, DOMRect>();
    nodes.forEach(el => {
      const id = el.getAttribute(REORDER_ID_ATTR);
      if (!id) return;
      const rect = el.getBoundingClientRect();
      nextRects.set(id, rect);
      if (!orderChanged) return;
      const prev = prevRects.get(id);
      if (!prev) return;
      const dx = prev.left - rect.left;
      const dy = prev.top - rect.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth;
      el.style.transition = 'transform 220ms cubic-bezier(.4,0,.2,1)';
      el.style.transform = '';
    });
    prevRectsRef.current = nextRects;
  }, [items, containerRef, getId]);

  // ---- Destination indicator + kb ghost-anchor position ----
  const [indicator, setIndicator] = useState<ReorderIndicator | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (effectiveDragOverGap === null || !container || items.length === 0) {
      setIndicator(null);
      setKbReorderGhostPos(null);
      return;
    }
    // Mouse's dragOverGap and keyboard/gamepad's kbReorderGapIndex are
    // computed in different index spaces: dragOverGap indexes the full
    // items array (the dragged item's own card is never removed from it
    // for mouse), while kbReorderGapIndex indexes items with the armed
    // item's own card excluded (needed to compute prev/next neighbor ids
    // for onCommit). Anchoring against the wrong array is off by one for
    // any gap at/after the moved item's own position.
    const anchorArr = dragOverGap !== null
      ? items
      : items.filter(it => getId(it) !== kbReorderId);
    const isAfterLast = effectiveDragOverGap >= anchorArr.length;
    const anchorItem = isAfterLast ? anchorArr[anchorArr.length - 1] : anchorArr[effectiveDragOverGap];
    const anchorId = anchorItem ? getId(anchorItem) : null;
    const el = anchorId ? queryCard(anchorId) : null;
    if (!el) { setIndicator(null); setKbReorderGhostPos(null); return; }
    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (isStacked(el, container)) {
      // One card per row: the gap is above (or, after the last, below) the
      // card, so the line runs across it rather than down its side.
      const screenY = isAfterLast ? rect.bottom + 6 : rect.top - 8;
      setIndicator({
        left: rect.left - containerRect.left,
        top: screenY - containerRect.top,
        height: 4,
        width: rect.width,
        horizontal: true,
        color: cursorColorRef.current,
      });
      setKbReorderGhostPos({ x: rect.left + rect.width / 2, y: screenY });
      return;
    }
    const screenX = isAfterLast ? rect.right + 6 : rect.left - 14;
    const screenY = rect.top + rect.height / 2;
    setIndicator({
      left: screenX - containerRect.left,
      top: rect.top - containerRect.top,
      height: rect.height,
      color: cursorColorRef.current,
    });
    setKbReorderGhostPos({ x: screenX, y: screenY });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDragOverGap, items, dragOverGap, kbReorderId, containerRef, getId, queryCard]);

  const ghost: ReorderableGhostState | null = useMemo(() => {
    const isKbMode = !draggingId && !!kbReorderId;
    const id = draggingId ?? kbReorderId;
    if (!id) return null;
    const kbPos = isKbMode ? (kbReorderFreePos ?? kbReorderGhostPos) : null;
    if (isKbMode && !kbPos) return null;
    return { id, kbPos, isKbMode };
  }, [draggingId, kbReorderId, kbReorderFreePos, kbReorderGhostPos]);

  return {
    containerProps: { onDragOver: handleGridDragOver, onDragLeave: handleGridDragLeave },
    getItemProps,
    indicator,
    ghost,
    warpToEdge,
    isDragSource: isDragSourceFn,
    isKbDragSource: isKbDragSourceFn,
    startDrag,
    endDrag,
    getDragOverPosition,
    reportDragOverGap,
    commitDrop,
  };
}
