import React, { useMemo } from 'react';
import { Want } from '@/types/want';
import { WantCardFace, wantTypeIconStyle } from './WantCardFace';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useColorMode } from '@/hooks/useColorMode';
import { useDarkMode } from '@/hooks/useDarkMode';

export type ChildRole = 'thinker' | 'monitor' | 'doer' | 'other';

export const ROLE_COLORS: Record<ChildRole, string> = {
  thinker: '#a855f7',
  monitor: '#3b82f6',
  doer:    '#22c55e',
  other:   '#6b7280',
};

export const CHILD_TILE_SIZE = 84;

interface ChildMiniTileProps {
  want: Want;
  role: ChildRole;
  left: number;
  top: number;
  animationDelay?: number;
  onClick: (want: Want) => void;
}

export const ChildMiniTile: React.FC<ChildMiniTileProps> = ({
  want,
  role,
  left,
  top,
  animationDelay = 0,
  onClick,
}) => {
  const colorMode = useColorMode();
  const isDarkMode = useDarkMode();
  const wantTypes = useWantTypeStore(state => state.wantTypes);
  const type = want.metadata?.type || '';
  const category = useMemo(
    () => wantTypes.find(wt => wt.name === type)?.category ?? '',
    [wantTypes, type],
  );
  const name = want.metadata?.name || want.metadata?.id || '';
  const roleColor = ROLE_COLORS[role];

  return (
    // ラッパーで touch/click バブリングを止める
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width: CHILD_TILE_SIZE,
        height: CHILD_TILE_SIZE,
        zIndex: 51,
        animation: `canvasChildPop 180ms ease-out ${animationDelay}ms both`,
      }}
      onClick={e => { e.stopPropagation(); onClick(want); }}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <WantCardFace
        typeName={type}
        displayName={name}
        category={category}
        theme={colorMode}
        context="canvas"
        iconSize={20}
        // Same colour and emboss as the want card's badge icon, so a child
        // reads as the same type its parent card shows.
        iconStyle={wantTypeIconStyle(type, category, isDarkMode)}
        className="w-full h-full"
        style={{
          // The board's shape, not Tailwind's `rounded` — see --r-tile.
          borderRadius: 'var(--r-tile)',
          boxShadow: `0 0 0 2px ${roleColor}, 0 4px 16px rgba(0,0,0,0.6)`,
          cursor: 'pointer',
        }}
      />
    </div>
  );
};
