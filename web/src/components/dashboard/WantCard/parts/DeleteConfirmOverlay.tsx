import React from 'react';
import { Check, X } from 'lucide-react';
import { CardOverlayConfig } from '../hooks/useCardOverlay';
import { OverlayActionGrid } from '@/components/common/OverlayActionGrid';

/** Returns a CardOverlayConfig for the delete-confirmation overlay. */
export function buildDeleteConfirmConfig(
  onConfirm: () => void,
  onCancel: () => void,
): CardOverlayConfig {
  return {
    headerLabel: 'Delete?',
    items: [
      { icon: <X     className="w-6 h-6 text-white" />, label: 'No',  onClick: onCancel,  colorClass: 'bg-gray-600/90', delay: 0,  keyboard: 'n' },
      { icon: <Check className="w-6 h-6 text-white" />, label: 'Yes', onClick: onConfirm, colorClass: 'bg-rose-700/90', delay: 60, keyboard: 'y' },
    ],
  };
}

/** Thin component wrapper kept for any external consumers. */
export const DeleteConfirmOverlay: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  const cfg = buildDeleteConfirmConfig(onConfirm, onCancel);
  return (
    <OverlayActionGrid
      items={cfg.items}
      cols={2}
      onClose={onCancel}
      headerLabel={cfg.headerLabel}
      focusRingClass={cfg.focusRingClass}
      backdropClassName="absolute inset-0 bg-black/70 rounded-[inherit]"
      initialFocus={0}
    />
  );
};
