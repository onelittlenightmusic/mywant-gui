import { useEffect, useRef } from 'react';
import { useInputActions } from './useInputActions';

/** A value, or a way to read it at press time. */
type Maybe<T> = T | (() => T);
const read = <T,>(v: Maybe<T>): T => (typeof v === 'function' ? (v as () => T)() : v);

export interface PanelTab {
  id: string;
}

interface PanelTabsOptions {
  /** The tabs, in the order the shoulder buttons walk them. */
  tabs: Maybe<ReadonlyArray<PanelTab>>;
  activeTab: Maybe<string>;
  onTabChange: (id: string) => void;
  enabled?: boolean;
  /**
   * How this panel holds the keys, when it has a notion of that.
   *
   * A bumper pressed from outside spends itself coming in — it does NOT also
   * advance a tab, or the very press that brings you here silently skips one.
   * Panels with nothing to focus (the thing panel, so far) leave this out and
   * every press switches.
   */
  focus?: {
    hasFocus: () => boolean;
    takeFocus: () => void;
    /** Called after a switch — the want panel re-asks for the card ring here. */
    afterChange?: () => void;
  };
  /**
   * The panel this walk belongs to.
   *
   * Tab is claimed while the focus is anywhere inside it, not only while it is
   * on a card. The card rule alone broke as soon as a tab put the focus
   * somewhere else in the panel — the thing panel's Themes tab hands it to the
   * theme grid — and from there Tab fell through to the browser, which walked
   * focus out of the panel entirely and left the keys on the board.
   */
  scope?: () => HTMLElement | null;
}

/**
 * Walking a detail panel's tabs: L1/R1 on a gamepad, Tab / Shift+Tab on a
 * keyboard.
 *
 * One hook because it is one behaviour. The want panel grew it first and the
 * thing panel would otherwise have grown its own — and the two would then agree
 * only until the next change to either. The bindings themselves are worth
 * sharing too: the keyboard half is a raw window listener (Tab has to be caught
 * before the browser moves focus with it) while the gamepad half goes through
 * useInputActions with `gamepadOnly`, and getting that pair right once is
 * better than getting it right twice.
 *
 * Tab cycles while the focus is inside the panel (see `scope`), or on a card
 * anywhere — a dashboard card walks the sidebar's tabs too. In a text field, and
 * everywhere else, Tab still means what the browser means by it.
 *
 * `tabs` and `activeTab` may be getters, for the panel that computes them below
 * an early return and can only hand over a way to read them.
 */
export function usePanelTabs({ tabs, activeTab, onTabChange, enabled = true, focus, scope }: PanelTabsOptions): void {
  const ref = useRef({ tabs, activeTab, onTabChange, focus, scope });
  ref.current = { tabs, activeTab, onTabChange, focus, scope };

  /**
   * Keep the keys in the panel across a switch.
   *
   * A tab that was holding the focus takes it with it when it goes: the Themes
   * tab's card grid is focused, History has nothing focusable at all, and
   * unmounting a focused node drops focus on <body> without firing anything.
   * The panel's "I have the keys" flag is a reading of document.activeElement,
   * so from the board's point of view the user just left — and the canvas drew
   * its frame in the middle of a tab switch.
   *
   * Hung on the tab changing rather than on the press that changed it, because
   * a tab can also be changed by clicking it, or by a mark asking for one, and
   * the focus falls out of the panel just the same. Whether the focus was
   * inside has to be read
   * during the render that brings the new tab in — by the time an effect runs,
   * the old tab is unmounted and the answer is always "no".
   */
  const lastTab = useRef<string | null>(null);
  const reland = useRef(false);
  const seenTab = read(activeTab);
  if (lastTab.current !== seenTab) {
    // Only a panel that HAD the focus gets it back: a tab changed from
    // somewhere else entirely must not reach over and take it.
    const el = scope?.();
    if (lastTab.current !== null && el && el.contains(document.activeElement)) reland.current = true;
    lastTab.current = seenTab;
  }

  useEffect(() => {
    if (!reland.current) return;
    reland.current = false;
    const el = ref.current.scope?.();
    if (!el) return;
    // One frame later, because that is when the old tab has actually gone. The
    // landing is the panel's own card, which is where arriving focus belongs
    // everywhere else too (see focusSidebarPanel).
    requestAnimationFrame(() => {
      if (el.contains(document.activeElement)) return;
      const landing = el.querySelector<HTMLElement>('[data-sidebar-primary="true"]') ?? el;
      landing.focus();
    });
  });

  /** One step along the tab bar, in either direction. */
  const step = (delta: 1 | -1) => {
    const { tabs: t, activeTab: a, onTabChange: change, focus: f } = ref.current;
    const list = read(t);
    if (list.length === 0) return;
    if (f && !f.hasFocus()) { f.takeFocus(); return; }
    const cur = list.findIndex(x => x.id === read(a));
    const next = (cur + delta + list.length) % list.length;
    change(list[next].id);
    f?.afterChange?.();
  };

  // Gamepad L1/R1. gamepadOnly so this does not also claim the keyboard's Tab,
  // which the listener below owns.
  useInputActions({
    gamepadOnly: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    enabled,
    onTabForward: () => step(1),
    onTabBackward: () => step(-1),
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      // From inside the panel, or from a card anywhere (a dashboard card cycles
      // the sidebar's tabs too — that is how this started). Everywhere else Tab
      // stays the browser's focus key.
      const inPanel = !!ref.current.scope?.()?.contains(target);
      if (!inPanel && !target.closest('[data-keyboard-nav-id]')) return;
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // step reads everything through the ref, so this binds once.
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
