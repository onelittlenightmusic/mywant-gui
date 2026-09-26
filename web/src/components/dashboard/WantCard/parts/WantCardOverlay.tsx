/**
 * WantCardOverlay — single render point for all overlay requests on a want card.
 *
 * Pass the result of useCardOverlay; if activeOverlay is set the overlay is
 * rendered automatically. Adding new overlay types only requires calling
 * setOverlay(config) — nothing else in the card needs to change.
 */
import React from 'react';
import { OverlayActionGrid } from '@/components/common/OverlayActionGrid';
import { CardOverlayConfig } from '../hooks/useCardOverlay';

interface WantCardOverlayProps {
  activeOverlay: CardOverlayConfig | null;
  onClose: () => void;
}

export const WantCardOverlay: React.FC<WantCardOverlayProps> = ({ activeOverlay, onClose }) => {
  if (!activeOverlay) return null;
  const { headerLabel, items, focusRingClass } = activeOverlay;
  return (
    <OverlayActionGrid
      items={items}
      cols={activeOverlay.cols ?? 2}
      onClose={onClose}
      headerLabel={headerLabel}
      focusRingClass={focusRingClass}
      backdropClassName="absolute inset-0 bg-black/70 rounded-[inherit]"
      initialFocus={0}
    />
  );
};
