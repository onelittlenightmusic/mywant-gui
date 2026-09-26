import { useEffect, useRef } from 'react';
import { useInputActions } from './useInputActions';

interface Tab { id: string }

interface UseSidebarTabNavOptions<T extends Tab> {
  tabs: T[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Set false to disable all navigation (e.g. nothing selected). Default: true */
  enabled?: boolean;
}

/**
 * Shared keyboard + gamepad tab navigation for detail sidebars.
 *
 * Keyboard:
 *   Tab / Shift+Tab — cycle tabs when focus is on a want card
 *   ([data-keyboard-nav-id] ancestor check, bubble phase)
 *
 * Gamepad:
 *   L bumper (4) → previous tab
 *   R bumper (5) → next tab
 *   (gamepadOnly: avoids conflicting with capture-phase keyboard handlers)
 *
 * All callbacks are stored in refs so the effect / gamepad listener never
 * needs to be re-registered when tabs or activeTab change.
 */
export function useSidebarTabNav<T extends Tab>({
  tabs,
  activeTab,
  onTabChange,
  enabled = true,
}: UseSidebarTabNavOptions<T>): void {
  // Refs so event handlers always see the latest values without re-registering.
  const tabsRef        = useRef(tabs);
  const activeTabRef   = useRef(activeTab);
  const onTabChangeRef = useRef(onTabChange);
  tabsRef.current        = tabs;
  activeTabRef.current   = activeTab;
  onTabChangeRef.current = onTabChange;

  // ── Keyboard Tab / Shift+Tab (bubble phase) ────────────────────────────────
  // Fires only when focus is on a [data-keyboard-nav-id] element (want card /
  // recipe card / want-type card).  This mirrors the existing behaviour in each
  // detail sidebar.
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return;

      const isFocusOnCard = !!target.closest('[data-keyboard-nav-id]');
      if (!isFocusOnCard) return;

      const tabs = tabsRef.current;
      if (tabs.length === 0) return;

      e.preventDefault();
      const currentIndex = tabs.findIndex(t => t.id === activeTabRef.current);
      const delta = e.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
      onTabChangeRef.current(tabs[nextIndex].id);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  // ── Gamepad L / R bumpers ──────────────────────────────────────────────────
  // gamepadOnly: keyboard Tab is already handled above; this avoids double-firing.
  // ignoreWhenInputFocused: false — bumpers should work regardless of focus.
  useInputActions({
    gamepadOnly: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    enabled,
    onTabForward: () => {
      const tabs = tabsRef.current;
      if (tabs.length === 0) return;
      const currentIndex = tabs.findIndex(t => t.id === activeTabRef.current);
      const nextIndex = (currentIndex + 1) % tabs.length;
      onTabChangeRef.current(tabs[nextIndex].id);
    },
    onTabBackward: () => {
      const tabs = tabsRef.current;
      if (tabs.length === 0) return;
      const currentIndex = tabs.findIndex(t => t.id === activeTabRef.current);
      const nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      onTabChangeRef.current(tabs[nextIndex].id);
    },
  });
}
