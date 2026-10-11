import React, { useEffect, useReducer } from 'react';
import type { Want } from '@/types/want';
import { getWantTileFace, onPluginRegistered } from '../plugins/registry';

// Importing the host brings the faces with it: they are registered by the card
// plugins, which register themselves on import. Without this a page that draws
// tiles but never a card would find no faces at all.
import '../plugins';

export interface WantTileFaceHostProps {
  want: Want;
  /** The tile's side, CSS px, at the board's current zoom. */
  size: number;
  /** The board is light or dark. */
  isLight: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A want's face on a board tile — the card's look at the size of the tile.
 *
 * Draws the face the want's card plugin brings (WantCardPlugin.TileFace) over
 * the whole tile. Renders nothing when the tile should keep its type icon
 * instead (see getWantTileFace): a caller can always try this first and fall
 * back on null, or ask getWantTileFace beforehand when it has to know.
 *
 * Purely for looking at: no handlers, `pointer-events: none`, so the tile it
 * is drawn on keeps every click, drag and key.
 */
export const WantTileFace: React.FC<WantTileFaceHostProps> = ({
  want, size, isLight, className, style,
}) => {
  // Faces register as their plugins load (a runtime plugin may arrive late).
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onPluginRegistered(forceUpdate), []);

  const Face = getWantTileFace(want, size);
  if (!Face) return null;

  return (
    <div
      className={className}
      style={{ width: size, height: size, pointerEvents: 'none', userSelect: 'none', ...style }}
      data-tile-face={want.metadata?.type}
    >
      <Face want={want} width={size} height={size} isLight={isLight} />
    </div>
  );
};
