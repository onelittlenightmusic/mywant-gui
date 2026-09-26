import React from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { CardOverlayConfig } from '../hooks/useCardOverlay';

/** Returns a CardOverlayConfig for the plan-approval overlay. */
export function buildPlanApproveConfig(
  onApprove: () => void,
  onCancel: () => void,
  onDetail: () => void,
): CardOverlayConfig {
  return {
    type: 'plan-approve',
    headerLabel: 'Deploy plan?',
    cols: 3,
    items: [
      { icon: <X            className="w-6 h-6 text-white" />, label: 'Cancel', onClick: onCancel,  colorClass: 'bg-gray-600/90',  delay: 0,   keyboard: 'n' },
      { icon: <ChevronDown  className="w-6 h-6 text-white" />, label: 'Detail', onClick: onDetail,  colorClass: 'bg-indigo-600/90', delay: 30                  },
      { icon: <Check        className="w-6 h-6 text-white" />, label: 'Deploy', onClick: onApprove, colorClass: 'bg-blue-600/90',   delay: 60,  keyboard: 'y' },
    ],
  };
}
