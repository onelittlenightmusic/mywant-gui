import { create } from 'zustand';

interface TabHopStore {
  /**
   * Whether the gamepad B+L1/R1 CursorMan tab-hop picker is currently allowed to
   * open. Defaults to true so it works on every page; the Dashboard flips it
   * false while a sidebar/form is focused, because there the chord instead
   * cycles that panel's sub-tabs (WantDetailsSidebar). Other pages have no
   * sub-tab consumer, so they leave it true.
   */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * Bridges the Dashboard's "idle vs. sidebar-focused" state to the now-global
 * CursorTabHopController (mounted once at the app root, App.tsx) so the chord
 * tab-hop is available on all pages — not only the want canvas — without each
 * page re-mounting the controller.
 */
export const useTabHopStore = create<TabHopStore>((set) => ({
  enabled: true,
  setEnabled: (enabled) => set((s) => (s.enabled === enabled ? s : { enabled })),
}));
