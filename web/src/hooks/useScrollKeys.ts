import { useInputActions } from './useInputActions';
import { handBackToGrid } from '@/stores/focusOwner';

interface ScrollKeysOptions {
  /** The scrolling element, read at press time — it is often mounted later. */
  target: () => HTMLElement | null;
  /** Only while this surface has the keys. */
  enabled: boolean;
  /**
   * Where the focus has to be for this to be live.
   *
   * A claim scoped to real focus (see useInputActions' focusScope), so a panel
   * that is merely open does not take the arrows off the board.
   */
  scope?: () => HTMLElement | null;
}

/**
 * Up and down scroll what is on screen, when there is nothing else to walk.
 *
 * Some tabs are reading, not operating: a thing's history, a want's. They have
 * no cards, so the arrows and the D-pad had nothing to do in them — and a list
 * longer than the panel could only be read with the mouse, which on a gamepad
 * means not at all.
 *
 * The step is a fraction of what is on screen rather than a line, because the
 * pad repeats: held down it reads as a continuous scroll, and a press at a time
 * moves by an amount you can still follow. No smooth behaviour for the same
 * reason — with repeats, queued smooth scrolls arrive after the thumb has let
 * go.
 *
 * Because it takes the exclusive input slot, it also owns Escape/B while it is
 * live: a reading tab has no inner level to back out of, so the one press hands
 * the keys straight back to the board through the shared transition. Without
 * this the common way-out in RightSidebar stood down (it defers whenever the
 * slot is claimed) and Escape did nothing on these tabs.
 */
export function useScrollKeys({ target, enabled, scope }: ScrollKeysOptions): void {
  useInputActions({
    enabled,
    captureInput: true,
    ignoreWhenInSidebar: false,
    focusScope: scope,
    onNavigate: (dir) => {
      if (dir !== 'up' && dir !== 'down') return;
      const el = target();
      if (!el) return;
      const step = Math.max(64, el.clientHeight * 0.25);
      el.scrollBy({ top: dir === 'up' ? -step : step });
    },
    onCancel: () => handBackToGrid(),
  });
}
