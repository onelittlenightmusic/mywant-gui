import { useCallback, useState } from 'react';
import { useWantStore } from '@/stores/wantStore';
import { OverlayItem } from '@/components/overlay';

/** Configuration describing any overlay displayed on a want card. */
export interface CardOverlayConfig {
  /** Stable identifier for the overlay type.
   *  Use it to selectively clear only the matching overlay (e.g. 'plan-approve')
   *  without inadvertently closing an unrelated overlay (e.g. 'delete-confirm'). */
  type?: string;
  headerLabel: string;
  items: OverlayItem[];
  /** Tailwind ring class for the focused button. Default: 'ring-white/80' */
  focusRingClass?: string;
  /** Number of columns in the grid. Default: 2 */
  cols?: number;
}

export function useCardOverlay(id: string | null) {
  // Per-field selectors: this hook runs once per want card, and a selector-less
  // useWantStore() made every card re-render on every store write (a dragover
  // or a poll tick would re-render the whole grid). `showQuickActions` is
  // derived here rather than subscribing to the raw id so a card only
  // re-renders when its OWN quick-actions visibility flips.
  const showQuickActions = useWantStore(s => s.quickActionsWantId === id);
  const setQuickActionsWantId = useWantStore(s => s.setQuickActionsWantId);
  const [activeOverlay, setActiveOverlayState] = useState<CardOverlayConfig | null>(null);

  // Stable identities — consumers pass these into dependency arrays (e.g.
  // useTouchReorder's native-listener effect), where a fresh function each
  // render forces the effect to re-run on every render.
  const closeQuickActions = useCallback(() => setQuickActionsWantId(null), [setQuickActionsWantId]);
  const setOverlay = useCallback((config: CardOverlayConfig) => setActiveOverlayState(config), []);
  const clearOverlay = useCallback(() => setActiveOverlayState(null), []);

  return {
    showQuickActions,
    closeQuickActions,
    setQuickActionsWantId,
    activeOverlay,
    setOverlay,
    clearOverlay,
  };
}
