/**
 * 2D card-grid keyboard + gamepad navigation hook.
 *
 * Analogous to useHierarchicalKeyboardNavigation but for a flat grid layout.
 *
 * Keyboard and gamepad both go through useInputActions (captureInput), so the
 * grid claims arrows/confirm/cancel exclusively and want-card navigation does
 * not also fire. The `gridProps` onKeyDown only covers what that claim cannot
 * reach: escaping a focused text input, and entering the grid before any card
 * is highlighted.
 *
 * Usage:
 *   const { gridProps } = useCardGridNavigation({ count, cols, isActive, focusedIndex, setFocusedIndex, ... });
 *   <div {...gridProps} className="grid grid-cols-2 gap-2 outline-none"> ... </div>
 */
import { useRef, useEffect, useCallback } from 'react';
import { useInputActions } from './useInputActions';
import { playSound } from '@/utils/sounds';
import { usePadActionStore } from '@/stores/padActionStore';
import cardFlashStyles from '@/components/dashboard/WantCard.module.css';

export interface UseCardGridNavigationOptions {
  /** Total number of navigable items (include AddCard as +1 if applicable) */
  count: number;
  /** Grid column count (default 2) */
  cols?: number;
  /** Whether this grid is currently the active tab / panel */
  isActive: boolean;
  /** Currently highlighted card index (-1 = none) */
  focusedIndex: number;
  setFocusedIndex: (i: number) => void;
  /** Called on Enter / A-button — focus the input at the given card index */
  onConfirm?: (i: number) => void;
  /**
   * Called on Shift+Enter / gamepad Start with the focused card index.
   * Opens that card's action overlay — same binding as every other card grid
   * (see useGridFocus, useDashboardNav).
   */
  onContextMenu?: (i: number) => void;
  /**
   * Increment this counter to auto-focus the first card (index 0) on tab switch.
   * When count > 0 and this changes, setFocusedIndex(0) is called.
   * Common mechanism: WantDetailsSidebar increments on every L1/R1 / B+L1/R1 press.
   */
  focusRequest?: number;
  /**
   * Pressing up on the top row, where the grid would otherwise do nothing.
   *
   * Lets whatever sits above the grid be part of the same arrow walk instead of
   * a place you can only leave. The sidebar uses it to hand focus back to its
   * embedded card, which is a navigable step like any field card and should be
   * reachable the same way.
   */
  onExitTop?: () => void;
  /**
   * Pressing down on the last row, where the grid would otherwise do nothing.
   *
   * onExitTop's mirror, and it exists for the same reason: a grid with
   * something below it — the Wiring tab stacks Import over Expose — is one
   * stretch of the same arrow walk, not two places you can only leave upwards.
   */
  onExitBottom?: () => void;
  /**
   * Called on x / gamepad X with the focused card's index, and the same for
   * y / gamepad Y.
   *
   * Bound here rather than inside the card because of who owns the input while
   * a card is focused: this grid holds the exclusive capture slot (see
   * useInputActions), and that slot is a single owner — a gamepad action is
   * handed to it and to nobody else. A per-card binding therefore works on the
   * keyboard and is silent on the pad, which is exactly the state the aura's X
   * was in. Everything the focused card answers comes through the grid.
   */
  onButtonX?: (i: number) => void;
  onYButton?: (i: number) => void;
  /**
   * What the software D-pad should print under X / Y while a card here is the
   * focused one — "Jump", say, for a grid whose Y follows a mark. Cleared when
   * focus leaves the grid or it unmounts. The canvas legend has no other way
   * to learn these (see stores/padActionStore).
   */
  padHints?: { x?: string; y?: string };
}

export interface UseCardGridNavigationResult {
  gridRef: React.RefObject<HTMLDivElement>;
  gridProps: {
    ref: React.RefObject<HTMLDivElement>;
    tabIndex: number;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
}

export function useCardGridNavigation({
  count,
  cols = 2,
  isActive,
  focusedIndex,
  setFocusedIndex,
  onConfirm,
  onContextMenu,
  focusRequest,
  onExitTop,
  onExitBottom,
  onButtonX,
  onYButton,
  padHints,
}: UseCardGridNavigationOptions): UseCardGridNavigationResult {
  const gridRef = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;
  const countRef = useRef(count);
  countRef.current = count;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const onContextMenuRef = useRef(onContextMenu);
  onContextMenuRef.current = onContextMenu;
  const onExitTopRef = useRef(onExitTop);
  onExitTopRef.current = onExitTop;
  const onExitBottomRef = useRef(onExitBottom);
  onExitBottomRef.current = onExitBottom;
  const onButtonXRef = useRef(onButtonX);
  onButtonXRef.current = onButtonX;
  const onYButtonRef = useRef(onYButton);
  onYButtonRef.current = onYButton;

  // Auto-focus first card when tab switch is requested (focusRequest increments).
  // Sections include AddCard in count (+1), so index 0 covers both "first card" and
  // "only AddCard" cases uniformly.
  const prevFocusRequestRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (focusRequest === undefined || focusRequest === prevFocusRequestRef.current) return;
    prevFocusRequestRef.current = focusRequest;
    if (isActive && countRef.current > 0) {
      setFocusedIndex(0);
      // Brief one-shot flash on the grid container so a gamepad L1/R1 (or
      // B+L1/R1) jump into this section reads as "focus landed here", not a
      // silent DOM focus change — same ring-flash CardCells use elsewhere
      // (WantMinimap's click blink), reused here for visual consistency.
      const el = gridRef.current;
      if (el) {
        el.classList.remove(cardFlashStyles.minimapBlink);
        void el.offsetWidth; // restart the animation if it's still mid-flash
        el.classList.add(cardFlashStyles.minimapBlink);
      }
    }
  }, [focusRequest, isActive, setFocusedIndex]);

  // Publish the pad hints while this grid holds the ring; take them back down
  // when it doesn't (or unmounts). `ownsHint` so a grid that never set one
  // does not clear a sibling's.
  const ownsHintRef = useRef(false);
  useEffect(() => {
    const live = isActive && focusedIndex >= 0;
    const hint: { X?: string; Y?: string } = {};
    if (live && padHints?.x) hint.X = padHints.x;
    if (live && padHints?.y) hint.Y = padHints.y;
    if (hint.X || hint.Y) {
      usePadActionStore.getState().setPadOverride(hint);
      ownsHintRef.current = true;
    } else if (ownsHintRef.current) {
      usePadActionStore.getState().setPadOverride(null);
      ownsHintRef.current = false;
    }
  }, [isActive, focusedIndex, padHints?.x, padHints?.y]);
  useEffect(() => () => {
    if (ownsHintRef.current) usePadActionStore.getState().setPadOverride(null);
  }, []);

  // Auto-focus grid div when a card is highlighted and no input is focused.
  // When focusedIndex goes back to -1 (e.g. Escape), release DOM focus so the
  // ignoreWhenInSidebar guard lifts and want-card navigation resumes.
  useEffect(() => {
    if (focusedIndex >= 0) {
      const el = document.activeElement as HTMLElement | null;
      if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT')) {
        gridRef.current?.focus();
      }
    } else {
      // Release focus from grid so _isInSidebar() returns false → dashboard arrows work.
      if (gridRef.current && gridRef.current.contains(document.activeElement)) {
        (document.activeElement as HTMLElement)?.blur();
      }
    }
  }, [focusedIndex]);

  // Keyboard + gamepad, described once as actions rather than once per device.
  //
  // captureInput (not captureGamepad): the grid no longer keeps a private
  // keyboard implementation, so the same exclusive claim covers both devices.
  //
  // ignoreWhenInputFocused matters more here than in the other migrated widgets:
  // this grid's own cards contain text inputs, and `enabled` stays true while
  // the caret is inside one. The arrow keys belong to the caret at that point,
  // not to grid navigation — useInputActions honours the flag on the keyboard
  // capture path for exactly this case.
  useInputActions({
    enabled: isActive && focusedIndex >= 0,
    captureInput: true,
    ignoreWhenInputFocused: true,
    ignoreWhenInSidebar: false,
    // Focus-derived claim: the grid div and its cards, including their inputs.
    focusScope: () => gridRef.current,
    onNavigate: (dir) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
        el.blur();
      }
      const i = focusedIndexRef.current;
      const total = countRef.current;
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Stepping between fields is stepping between cards, and sounds like it —
      // the same tick every other card grid plays (see useDashboardNav). These
      // were the one set of cards you could walk in silence.
      //
      // Only when it actually moves: the branches below all decline at an edge,
      // and ticking on a press that changed nothing says the opposite of what
      // happened.
      const step = () => playSound('gridMove');
      if (dir === 'left' && i > 0) { setFocusedIndex(i - 1); step(); }
      else if (dir === 'right' && i + 1 < total) { setFocusedIndex(i + 1); step(); }
      else if (dir === 'up' && row > 0) { setFocusedIndex(i - cols); step(); }
      // Top row and still going up: leave the grid rather than absorb the key.
      else if (dir === 'up' && row === 0 && onExitTopRef.current) {
        setFocusedIndex(-1);
        onExitTopRef.current();
        step();
      }
      else if (dir === 'down' && i + cols < total) { setFocusedIndex(i + cols); step(); }
      // Last row and still going down: leave the grid, the same way up leaves it.
      else if (dir === 'down' && i + cols >= total && onExitBottomRef.current) {
        setFocusedIndex(-1);
        onExitBottomRef.current();
        step();
      }
    },
    onConfirm: () => onConfirmRef.current?.(focusedIndexRef.current),
    onButtonX: onButtonX ? () => onButtonXRef.current?.(focusedIndexRef.current) : undefined,
    onYButton: onYButton ? () => onYButtonRef.current?.(focusedIndexRef.current) : undefined,
    onContextMenu: () => {
      const i = focusedIndexRef.current;
      if (i >= 0) onContextMenuRef.current?.(i);
    },
    onCancel: (press) => {
      // Where the press LANDED, not where focus happens to be by the time it is
      // resolved. A card's editor closes on the same key's keydown (its own
      // handler) and the focus at keyup is already back on the grid — reading
      // it then turns one press into two rungs: out of the editor and out of
      // the grid. The gamepad never had that gap, which is why B and Escape
      // disagreed; both now answer for the press.
      const el = (press?.pressedOn ?? document.activeElement) as HTMLElement | null;
      const grid = gridRef.current;
      // Focus is deeper in than the grid itself: it is inside the focused
      // card's own editor. Cancel means "come back up to the card", one rung,
      // and never "leave the grid" — the way back is the way you came.
      //
      // Asked as "deeper than the grid" rather than by tag name. It used to
      // test for INPUT/TEXTAREA/SELECT, which is only some of what a card is
      // edited with: an enum's toggle group is buttons, a slider is a div, and
      // for those the test said "not editing" and B walked out of the grid
      // entirely — landing on the panel's embedded card, two rungs from where
      // the user was.
      //
      // The grid takes the focus back explicitly. Blurring alone leaves it on
      // <body>, which is outside this grid's focusScope, so the exclusive claim
      // goes stale and the NEXT press falls through to the panel — the same
      // press then leaves the panel altogether.
      if (grid && el && el !== grid && grid.contains(el)) {
        // Blur whatever holds focus now — the editor may already have handed it
        // back — and make sure the grid is where it lands.
        (document.activeElement as HTMLElement | null)?.blur();
        grid.focus();
        return;
      }
      setFocusedIndex(-1);
      // Leave upward, to whatever sits above the grid — the same place the up
      // arrow goes from the top row, so the two ways out agree.
      //
      // Without this the grid let go of focus and handed it to nobody: the
      // effect above blurs to <body>, which is outside the panel, so the panel
      // stopped counting as focused and the NEXT cancel reached no handler at
      // all. The way out of a panel is two steps — fields, then card, then back
      // to the grid — and the middle one was missing its landing spot.
      if (onExitTopRef.current) {
        onExitTopRef.current();
        playSound('gridMove');
      }
    },
  });

  // Grid navigation itself now lives in the hook above. Only the two cases it
  // cannot reach are handled here — neither duplicates it:
  //
  //  1. Escape while the caret is in one of the grid's own text inputs. The
  //     hook deliberately ignores keys there (ignoreWhenInputFocused), so this
  //     is the one way keyboard users climb back out to the cards. Gamepad B
  //     still reaches the hook's onCancel, which does the same thing.
  //  2. Entering the grid when nothing is focused yet. The hook is gated on
  //     focusedIndex >= 0, so it is not listening until a card is highlighted.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isActive) return;
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    if (isInInput) {
      if (e.key === 'Escape') {
        e.preventDefault();
        target.blur();
        gridRef.current?.focus();
      }
      return;   // every other key belongs to the caret
    }

    if (focusedIndexRef.current < 0 && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
      e.preventDefault();
      setFocusedIndex(0);
    }
  }, [isActive, setFocusedIndex]); // refs are stable — no extra deps needed

  return {
    gridRef,
    gridProps: {
      ref: gridRef,
      tabIndex: -1,
      onKeyDown: handleKeyDown,
    },
  };
}
