import { useInputActions, NavigationDirection } from './useInputActions';
import { handOverToSidebar, useInputHandedOver } from '@/stores/focusOwner';
import { playSound } from '@/utils/sounds';

interface UseDashboardNavOptions {
  /** Total number of items in the filtered list. */
  itemCount: number;
  /**
   * Index of the currently selected (sidebar-open) item.
   * Pass -1 when nothing is selected.
   */
  currentIndex: number;
  /**
   * Called when navigation selects a new index.
   * The page should open/focus the item at this index and open the sidebar.
   */
  onNavigate: (index: number) => void;
  /**
   * Called on Escape key or Gamepad B button.
   * Should close the sidebar / deselect the current item.
   */
  onClose?: () => void;
  /**
   * Called on Shift+Enter or Gamepad Start button.
   * Intended for opening a context menu on the focused card.
   */
  onContextMenu?: () => void;
  /** Set false to disable all input handling. Default: true */
  enabled?: boolean;
  /**
   * Grid column count for 2-D navigation.
   * When > 1, Up/Down move by `cols` positions (card directly above/below).
   * Left/Right always move by 1 (linear, wrapping across rows).
   * Use `useGridCols(gridRef)` to detect the live column count.
   * Default: 1 (flat-list behaviour, Up/Down = Left/Right = ±1).
   */
  cols?: number;
}

/**
 * Unified keyboard + gamepad navigation for card dashboards
 * (WantTypePage, RecipePage, and similar grid/list dashboards).
 *
 * Replaces the combination of `useKeyboardNavigation` + `useEscapeKey` and adds
 * sound effects for a consistent experience across all dashboards.
 *
 * Keyboard:
 *   Arrow keys / Home / End  — move selection
 *   Enter                    — re-confirm / open current card
 *   Escape                   — close sidebar
 *   Shift+Enter              — context menu (optional)
 *
 * Gamepad:
 *   D-pad / Left analog      — navigate
 *   A / Cross                — confirm (open)
 *   B / Circle               — cancel (close)
 *   Start                    — context menu (optional)
 *
 * Sounds:
 *   gridMove    — on directional navigation
 *   handoverIn  — on confirm (Enter/A), from handOverToSidebar
 *   handoverOut — on cancel out of the panel, from handBackToGrid
 *   cardClose   — on cancel (Escape/B) when the grid still has the keys
 *
 * Free-roaming cursor support (left stick / Option+Arrow drag-to-nearest-
 * card) is not wired here — it's app-wide (see useGlobalFreeCursor, mounted
 * once in App.tsx) and works automatically as long as each card's real
 * clickable DOM node carries the `data-free-cursor-item` attribute (see
 * AgentCard / WantTypeCard / RecipeCard).
 *
 * A / Enter hands the keys to the detail panel beside the grid, and this hook
 * goes quiet for as long as the panel holds them — the grid greys out, the
 * panel wears the focus frame, and the roaming cursor moves inside it. B /
 * Escape hands them back and the grid picks up where it left off.
 *
 * Nothing here handles input while the panel has the keys, deliberately. What
 * happens in there is the ordinary app-wide machinery: the roaming cursor rides
 * the same left stick it always does, and a D-pad direction nobody consumed
 * becomes the arrow key it stands for (see useInputActions), so the panel's own
 * keyboard handling answers the pad without knowing a pad exists. A second copy
 * of that, per page or per panel, is exactly what this hook exists to avoid.
 */
export function useDashboardNav({
  itemCount,
  currentIndex,
  onNavigate,
  onClose,
  onContextMenu,
  enabled = true,
  cols = 1,
}: UseDashboardNavOptions): void {
  // The grid stops listening while the panel has the keys. Without this the two
  // both answered the same press: a direction would walk the panel AND move the
  // selection behind it, which also swapped the panel's contents out from under
  // the user. The grey the page draws over the cards is this same fact, seen.
  const inputHandedOver = useInputHandedOver();

  useInputActions({
    enabled: enabled && itemCount > 0 && !inputHandedOver,
    ignoreWhenInSidebar: false,

    onNavigate: (dir: NavigationDirection) => {
      let newIndex = currentIndex;
      const gridMode = cols > 1;

      // When nothing is selected, any direction jumps to first item.
      if (currentIndex === -1) {
        newIndex = 0;
        // fall through to navigate + scroll below
      } else {
        switch (dir) {
          case 'down':
            if (gridMode) {
              if (currentIndex + cols < itemCount) newIndex = currentIndex + cols;
              else return;
            } else {
              newIndex = Math.min(currentIndex + 1, itemCount - 1);
            }
            break;
          case 'up':
            if (gridMode) {
              if (currentIndex - cols >= 0) newIndex = currentIndex - cols;
              else return;
            } else {
              if (currentIndex > 0) newIndex = currentIndex - 1;
              else return;
            }
            break;
          case 'right':
            newIndex = Math.min(currentIndex + 1, itemCount - 1);
            break;
          case 'left':
            if (currentIndex > 0) newIndex = currentIndex - 1;
            else return;
            break;
          case 'home':
            newIndex = 0;
            break;
          case 'end':
            newIndex = itemCount - 1;
            break;
          default:
            return;
        }
      }

      playSound('gridMove');
      onNavigate(newIndex);

      // Scroll the newly selected card into the center of the viewport.
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.querySelector('[data-keyboard-nav-selected="true"]');
          if (el instanceof HTMLElement) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 0);
      });
    },

    onConfirm: () => {
      if (currentIndex < 0 || currentIndex >= itemCount) return;
      // No sound here: handOverToSidebar below is the one that knows whether a
      // panel was actually entered, and it says so (handoverIn). Sounding the
      // press from both places meant two noises for one move.
      // Make sure the panel is showing this card before handing it the keys —
      // on the pages where selecting IS opening, this is a no-op re-select, and
      // it is what opens the panel on the ones where the press is the first ask.
      onNavigate(currentIndex);
      // Then go in. Deferred so a panel that this very press opened exists to
      // be entered; focusSidebarPanel retries for the same reason, but the flag
      // has to see a panel on screen to be set at all.
      requestAnimationFrame(() => handOverToSidebar());
    },

    onCancel: onClose
      ? () => {
          playSound('cardClose');
          onClose();
        }
      : undefined,

    /**
     * Shift+Enter / Start on the selected card: its action overlay.
     *
     * Falls back to asking the card rather than doing nothing. A page that
     * never passed onContextMenu had no overlay on Start at all — Thing was
     * one, so the identical press worked on an agent and did nothing on a
     * thing — and there is no reason for that to be per-page: every card in
     * the app already opens its overlay from a real contextmenu event, for the
     * mouse. Dispatching one is the same trick RightSidebar uses for the card
     * embedded in a panel, and the same one the roaming cursor uses to click.
     *
     * The sound is not here. Both overlay stores sound their own transitions
     * (see stores/cardOverlaySounds), so this press sounds the same as a
     * right-click, a long-press, or Start in the panel.
     */
    onContextMenu: onContextMenu ?? (() => {
      const marked = Array.from(document.querySelectorAll<HTMLElement>('[data-keyboard-nav-selected="true"]'))
        .find(el => !el.closest('[data-sidebar="true"]'));
      if (!marked) return;
      // The marker is not always the card. Some grids put it on the card itself
      // and some on a wrapper around it (ThingGrid wraps for drag and FLIP), and
      // events dispatched at a wrapper travel UP, away from the card inside it —
      // so aiming at the marker worked on half the pages and silently did
      // nothing on the other half. Aim at the card, wherever it sits.
      const CARD = '[data-keyboard-nav-id], [data-want-id]';
      const card = marked.matches(CARD) ? marked : marked.querySelector<HTMLElement>(CARD);
      card?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
    }),
  });
}
