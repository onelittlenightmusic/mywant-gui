import { useEffect } from 'react';
import { FREE_CURSOR_ITEM_ATTR, warpFreeCursorToElement } from '@/hooks/useFreeCursorNav';

/**
 * Where the caret goes when a card is operated, and how it walks from there.
 *
 * Inner focus used to mean only "this card owns the keyboard". That is enough
 * for a card whose controls ARE the keys — a slider reads the arrows and draws
 * itself — but not for one whose control is a real focusable widget. The coding
 * agent's card is the plain case: Enter marked it inner focused and nothing
 * moved, because DOM focus was still on the card behind its message box, so the
 * card looked operated and swallowed typing. Each plugin fixing that for itself
 * would mean every future plugin discovering the same gap.
 *
 * So the card declares its focusables and this walks them:
 *
 *   <textarea data-inner-focus data-inner-focus-default />
 *   <button   data-inner-focus />
 *
 * On entering inner focus the caret lands on the element marked default, or on
 * the first one in source order. Tab / Shift+Tab step through the ring and wrap;
 * the arrows do the same, but only for keys nothing else has already taken —
 * a plugin that binds its own arrows (see SliderCardPlugin) consumes them in
 * the capture phase, so they never reach here.
 *
 * Order is source order, deliberately. It is the same rule HTML gives Tab when
 * nobody overrides it, it is the order the card is read in, and an explicit
 * numeric order is the thing positive tabindex is disliked for: two people
 * renumbering the same card is how it goes wrong.
 *
 * Two kinds of card correctly declare nothing:
 *
 *   - Cards whose control IS the keys. A slider, gear, timer, switch, going and
 *     aura card read the arrows and draw themselves; there is no widget for a
 *     caret to sit in, and an empty ring leaves their bindings the whole story.
 *   - Controls that keep their own internal cursor, where the right stop moves.
 *     ChoiceCardPlugin focuses whichever pill its EnumToggleGroup has under the
 *     cursor, and the reaction buttons in WantCardContent work the same way. A
 *     static default attribute cannot name a moving target, so those focus
 *     themselves and leave the ring empty rather than fight it for the keys.
 *
 * What must NOT happen is the third case: a card with real focusable widgets
 * that declares nothing at all. That is what date_and_time was — three selects
 * on the face, none of them reachable once the card was being operated.
 */

/** Marks an element as a stop in a card's inner-focus ring. */
export const INNER_FOCUS_ATTR = 'data-inner-focus';
/** Marks the stop the caret starts on. Falls back to the first stop. */
export const INNER_FOCUS_DEFAULT_ATTR = 'data-inner-focus-default';

/**
 * The frame that says which stop the keys are on.
 *
 * A ring you walk with the arrows is unusable if nothing marks where you are:
 * pressing right moved the caret and nothing on screen changed, so the only way
 * to find out which button you were about to press was to press it. The browser
 * draws a focus ring by default, but every control here overrides outline for
 * its own look, and a ring drawn per plugin is a ring each new plugin forgets.
 *
 * So it is drawn from the one fact that is already true — `:focus` on a declared
 * stop — in the character's own colour, which the card root already publishes as
 * --mw-ring for the hover frame. Same colour whether you arrived by stick, by
 * arrow key or by mouse.
 *
 * Applied by this hook rather than written by each plugin, for the same reason
 * the ring itself is walked here: a plugin that declares a stop has already said
 * everything needed, and a mark it has to remember to add is a mark the next
 * plugin will be missing.
 */
export const INNER_FOCUS_RING_CLASS = 'mw-inner-focus-ring';

const ARROWS = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
const FORWARD = ['ArrowDown', 'ArrowRight'];

/** The ring's live members: declared, on screen, and able to take focus. */
function stops(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(`[${INNER_FOCUS_ATTR}]`))
    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

export function useInnerFocusRing(
  rootRef: React.RefObject<HTMLElement | null>,
  isInnerFocused: boolean,
): void {
  // Dress the stops, for as long as the card is being operated.
  //
  // Two marks, both derived from what the plugin already declared: the ring
  // class, so the focused stop is visible; and the free-cursor tag, so the stick
  // can drive to a control and release on it. The tag is added here rather than
  // left to plugins because the roaming cursor is confined to this card while it
  // is operated (see keyHoldingSurface) — untagged stops would leave it inside a
  // card with nothing to land on.
  //
  // Both are removed on the way out. Leaving the tag behind would make every
  // control of every card a snap target for the cursor roaming the whole page.
  useEffect(() => {
    const root = rootRef.current;
    if (!isInnerFocused || !root) return;
    const marked = stops(root);
    marked.forEach(el => {
      el.classList.add(INNER_FOCUS_RING_CLASS);
      el.setAttribute(FREE_CURSOR_ITEM_ATTR, 'true');
    });
    return () => marked.forEach(el => {
      el.classList.remove(INNER_FOCUS_RING_CLASS);
      el.removeAttribute(FREE_CURSOR_ITEM_ATTR);
    });
  }, [isInnerFocused, rootRef]);

  // Arriving. Deliberately not dependent on the ring's contents: re-running
  // this on every re-render would drag the caret back to the default while the
  // user was walking the ring.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (!isInnerFocused) {
      // Hand the focus back rather than dropping it. A text box left focused
      // keeps swallowing keys that now belong to whatever the user stepped out
      // to; a bare blur is no better, because it leaves focus on <body> — the
      // nowhere state where neither the card nor the board answers. The ring
      // took the focus, so the ring returns it: to the sidebar's landing spot
      // when the card is the embedded copy, otherwise to the card itself.
      const ae = document.activeElement as HTMLElement | null;
      if (!ae || !root.contains(ae) || !ae.hasAttribute(INNER_FOCUS_ATTR)) return;
      const home = root.closest<HTMLElement>('[data-sidebar-primary="true"]') ?? root;
      home.focus();
      if (document.activeElement === ae) ae.blur();   // home refused it
      return;
    }

    const ring = stops(root);
    if (ring.length === 0) return;
    const target = ring.find(el => el.hasAttribute(INNER_FOCUS_DEFAULT_ATTR)) ?? ring[0];
    target.focus();
    // Bring the roaming cursor in with the caret, exactly as handing the keys to
    // a panel does (see handOverToSidebar). It is confined to this card from now
    // on, and a cursor left parked outside the boundary it now has would have to
    // be dragged back in before it did anything.
    warpFreeCursorToElement(target);
    // Caret to the end rather than a selection: coming back to a half-written
    // message should continue it, not replace it.
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      try {
        const end = target.value.length;
        target.setSelectionRange(end, end);
      } catch {
        // Input types that refuse a selection range (number, range, …). The
        // focus is the part that matters; where the caret sits is a nicety.
      }
    }
  }, [isInnerFocused, rootRef]);

  // Walking. A plain DOM listener on the card rather than useInputActions: the
  // hooks there are arbitrated by a single exclusive capture slot, and this is
  // the opposite of exclusive — it is what handles the keys nobody claimed.
  // Bubble phase on the card means a plugin's captureInput binding, which stops
  // the event outright, is never second-guessed here.
  useEffect(() => {
    const root = rootRef.current;
    if (!isInnerFocused || !root) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const isTab = e.key === 'Tab';
      const isArrow = ARROWS.includes(e.key);
      if (!isTab && !isArrow) return;

      const ring = stops(root);
      if (ring.length < 2) return;   // nowhere to step; leave Tab to the browser

      const here = ring.indexOf(document.activeElement as HTMLElement);
      const forward = isTab ? !e.shiftKey : FORWARD.includes(e.key);
      const next = here < 0
        ? (forward ? 0 : ring.length - 1)
        : (here + (forward ? 1 : -1) + ring.length) % ring.length;

      e.preventDefault();
      e.stopPropagation();
      ring[next].focus();
    };

    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [isInnerFocused, rootRef]);
}
