import React from 'react';
import { ExternalLink, X, Monitor } from 'lucide-react';
import { CardOverlayConfig } from '../hooks/useCardOverlay';

export function buildOpenUrlConfig(
  onOpen: () => void,
  onCancel: () => void,
  onShowInCard?: () => void,
): CardOverlayConfig {
  const items: CardOverlayConfig['items'] = [
    { icon: <X             className="w-6 h-6 text-white" />, label: 'キャンセル',  onClick: onCancel,      colorClass: 'bg-gray-600/90',   delay: 0,   keyboard: 'n' },
    { icon: <ExternalLink  className="w-6 h-6 text-white" />, label: '新しいタブ',  onClick: onOpen,        colorClass: 'bg-blue-600/90',   delay: 60,  keyboard: 'y' },
  ];
  if (onShowInCard) {
    items.push({ icon: <Monitor className="w-6 h-6 text-white" />, label: 'cardに表示', onClick: onShowInCard, colorClass: 'bg-purple-600/90', delay: 120, keyboard: 'c' });
  }
  return {
    type: 'open-url',
    headerLabel: 'どこで開く？',
    cols: onShowInCard ? 3 : 2,
    items,
  };
}
