import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Want } from '@/types/want';
import { ChildMiniTile, ChildRole, CHILD_TILE_SIZE, ROLE_COLORS } from './ChildMiniTile';
import { WantCardFace, wantTypeIconStyle } from './WantCardFace';
import { WantZoneLayout, shouldUseZoneLayout, bucketByRole } from './WantZoneLayout';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useColorMode } from '@/hooks/useColorMode';
import { useDarkMode } from '@/hooks/useDarkMode';

const FLOAT_CARD_WIDTH = 420;
const FLOAT_CARD_HEIGHT = 260;
const CHILD_GAP = 8;
const CHILD_STEP = CHILD_TILE_SIZE + CHILD_GAP;
const ARM_GAP = 16;
const MAX_PER_SIDE = 4;
/** Gap between the bottom of the float card and the top of the zone panel */
const ZONE_PANEL_GAP = 12;

function getRole(want: Want): ChildRole {
  const r = want.metadata?.labels?.['child-role'];
  if (r === 'thinker') return 'thinker';
  if (r === 'monitor') return 'monitor';
  if (r === 'doer') return 'doer';
  return 'other';
}

// ─── Inline zone tile ─────────────────────────────────────────────────────────
// Renders inside WantZoneLayout columns — same visuals as ChildMiniTile but
// without fixed positioning (flows in the zone column flex layout).

interface InlineZoneTileProps {
  want: Want;
  role: ChildRole;
  onClick: (want: Want) => void;
}

const InlineZoneTile: React.FC<InlineZoneTileProps> = ({ want, role, onClick }) => {
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
    <div
      style={{ width: CHILD_TILE_SIZE, height: CHILD_TILE_SIZE, flexShrink: 0, cursor: 'pointer' }}
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
        // Same colour and emboss as the want card's badge icon — this tile is
        // the twin of ChildMiniTile and has to stay in step with it.
        iconStyle={wantTypeIconStyle(type, category, isDarkMode)}
        className="w-full h-full"
        style={{ borderRadius: 'var(--r-tile)', boxShadow: `0 0 0 2px ${roleColor}, 0 4px 16px rgba(0,0,0,0.5)` }}
      />
    </div>
  );
};

// ─── Main overlay ─────────────────────────────────────────────────────────────

export type FloatCardCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Which corners are reachable from each corner via arrow direction
const CORNER_MOVES: Record<FloatCardCorner, Partial<Record<'up'|'down'|'left'|'right', FloatCardCorner>>> = {
  'top-left':     { down: 'bottom-left',  right: 'top-right'    },
  'top-right':    { down: 'bottom-right', left:  'top-left'     },
  'bottom-left':  { up:   'top-left',     right: 'bottom-right' },
  'bottom-right': { up:   'top-right',    left:  'bottom-left'  },
};

const CORNER_MARGIN = 12;

interface CanvasChildOverlayProps {
  floatCard: React.ReactNode;
  childWants: Want[];
  tileCenterX: number;
  tileCenterY: number;
  onClickChild: (want: Want) => void;
  /** Bounding rect of the canvas scroll container — pins card to a corner */
  containerRect?: { left: number; top: number; right: number; bottom: number } | null;
  /** Visual scale factor for the float card (0–1). Default 1. */
  floatCardScale?: number;
  /** Which corner to pin the float card to. Default 'top-right'. */
  corner?: FloatCardCorner;
  /** When true, show directional arrow overlay for corner-move mode */
  isMoveMode?: boolean;
  /** Called when user clicks a directional arrow in move mode */
  onMoveDir?: (dir: 'up' | 'down' | 'left' | 'right') => void;
}

export const CanvasChildOverlay: React.FC<CanvasChildOverlayProps> = ({
  floatCard,
  childWants,
  tileCenterX,
  tileCenterY,
  onClickChild,
  containerRect,
  floatCardScale = 1,
  corner = 'top-right',
  isMoveMode = false,
  onMoveDir,
}) => {
  const useZone = shouldUseZoneLayout(childWants);
  const zoneBuckets = useMemo(
    () => useZone ? bucketByRole(childWants) : null,
    [useZone, childWants],
  );

  // Fallback floating-tile groups (used when !useZone)
  const groups = useMemo(() => ({
    thinkers: childWants.filter(w => getRole(w) === 'thinker').slice(0, MAX_PER_SIDE),
    monitors: childWants.filter(w => getRole(w) === 'monitor').slice(0, MAX_PER_SIDE),
    doers:    childWants.filter(w => getRole(w) === 'doer').slice(0, MAX_PER_SIDE),
    others:   childWants.filter(w => getRole(w) === 'other').slice(0, MAX_PER_SIDE),
  }), [childWants]);

  const scaledW = FLOAT_CARD_WIDTH  * floatCardScale;
  const scaledH = FLOAT_CARD_HEIGHT * floatCardScale;

  // Pin to the requested corner when containerRect is available; otherwise centre on tile.
  let cardLeft: number;
  let cardTop: number;
  if (containerRect) {
    switch (corner) {
      case 'top-left':
        cardLeft = containerRect.left  + CORNER_MARGIN;
        cardTop  = containerRect.top   + CORNER_MARGIN;
        break;
      case 'top-right':
        cardLeft = containerRect.right - scaledW - CORNER_MARGIN;
        cardTop  = containerRect.top   + CORNER_MARGIN;
        break;
      case 'bottom-right':
        cardLeft = containerRect.right - scaledW - CORNER_MARGIN;
        cardTop  = containerRect.bottom - scaledH - CORNER_MARGIN;
        break;
      case 'bottom-left':
      default:
        cardLeft = containerRect.left  + CORNER_MARGIN;
        cardTop  = containerRect.bottom - scaledH - CORNER_MARGIN;
    }
  } else {
    cardLeft = Math.max(8, Math.min(tileCenterX - scaledW / 2, window.innerWidth  - scaledW - 8));
    cardTop  = Math.max(8, Math.min(tileCenterY - scaledH / 2, window.innerHeight - scaledH - 8));
  }

  // Clamp to viewport — guards against iOS rubber-band scroll making containerRect.top
  // negative, and visual-viewport vs layout-viewport mismatches on iPhone Safari.
  cardLeft = Math.max(CORNER_MARGIN, Math.min(cardLeft, window.innerWidth  - scaledW - CORNER_MARGIN));
  cardTop  = Math.max(CORNER_MARGIN, Math.min(cardTop,  window.innerHeight - scaledH - CORNER_MARGIN));

  const cardCX = cardLeft + FLOAT_CARD_WIDTH / 2;
  const cardCY = cardTop + FLOAT_CARD_HEIGHT / 2;

  // Zone panel: prefer below the card; if that would clip, render above
  const spaceBelow = window.innerHeight - (cardTop + FLOAT_CARD_HEIGHT + ZONE_PANEL_GAP);
  const zonePanelLeft = cardLeft;
  const zonePanelTop = spaceBelow >= 120
    ? cardTop + FLOAT_CARD_HEIGHT + ZONE_PANEL_GAP
    : Math.max(8, cardTop - ZONE_PANEL_GAP - 200); // rough "above" fallback

  const renderGroup = (wants: Want[], role: ChildRole, direction: 'top' | 'left' | 'right' | 'bottom') => {
    if (wants.length === 0) return null;
    const n = wants.length;
    const totalLen = n * CHILD_TILE_SIZE + (n - 1) * CHILD_GAP;

    return wants.map((w, i) => {
      let left = 0;
      let top = 0;
      switch (direction) {
        case 'top':
          left = cardCX - totalLen / 2 + i * CHILD_STEP;
          top  = cardTop - ARM_GAP - CHILD_TILE_SIZE;
          break;
        case 'left':
          left = cardLeft - ARM_GAP - CHILD_TILE_SIZE;
          top  = cardCY - totalLen / 2 + i * CHILD_STEP;
          break;
        case 'right':
          left = cardLeft + FLOAT_CARD_WIDTH + ARM_GAP;
          top  = cardCY - totalLen / 2 + i * CHILD_STEP;
          break;
        case 'bottom':
          left = cardCX - totalLen / 2 + i * CHILD_STEP;
          top  = cardTop + FLOAT_CARD_HEIGHT + ARM_GAP;
          break;
      }

      return (
        <ChildMiniTile
          key={w.metadata?.id || w.id || i}
          want={w}
          role={role}
          left={left}
          top={top}
          animationDelay={i * 40}
          onClick={onClickChild}
        />
      );
    });
  };

  // Available directions in move mode depend on current corner
  const availDirs = CORNER_MOVES[corner];
  const ARROW_SIZE = 32;
  const ARROW_OFFSET = 10;

  return (
    <>
      {/* Float card — stopPropagation prevents outer click/touch handlers bubbling */}
      <div
        style={{
          position: 'fixed', left: cardLeft, top: cardTop, width: scaledW, height: scaledH,
          zIndex: 50, overflow: 'hidden',
          outline: isMoveMode ? '2px solid rgba(99,102,241,0.8)' : 'none',
          borderRadius: 'var(--r-card)',
          transition: 'left 0.15s ease, top 0.15s ease',
        }}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <div style={{
          width: FLOAT_CARD_WIDTH,
          height: FLOAT_CARD_HEIGHT,
          ...(floatCardScale !== 1 ? { transform: `scale(${floatCardScale})`, transformOrigin: 'top left' } : {}),
        }}>
          {floatCard}
        </div>
        {/* Dim overlay in move mode */}
        {isMoveMode && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.12)', pointerEvents: 'none', borderRadius: 'var(--r-card)' }} />
        )}
      </div>

      {/* Directional arrows for corner-move mode */}
      {isMoveMode && (() => {
        const cx = cardLeft + scaledW / 2;
        const cy = cardTop  + scaledH / 2;
        const btnStyle = (active: boolean): React.CSSProperties => ({
          position: 'fixed',
          width: ARROW_SIZE, height: ARROW_SIZE,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%',
          background: active ? 'rgba(99,102,241,0.9)' : 'rgba(80,80,100,0.35)',
          color: active ? '#fff' : 'rgba(255,255,255,0.25)',
          border: active ? '2px solid rgba(165,180,252,0.8)' : '2px solid transparent',
          cursor: active ? 'pointer' : 'default',
          zIndex: 55,
          boxShadow: active ? '0 2px 12px rgba(99,102,241,0.5)' : 'none',
          transition: 'background 0.15s, border 0.15s',
        });
        return (
          <>
            {/* Up */}
            <div
              style={{ ...btnStyle(!!availDirs.up), left: cx - ARROW_SIZE / 2, top: cardTop - ARROW_SIZE - ARROW_OFFSET }}
              onClick={e => { e.stopPropagation(); if (availDirs.up) onMoveDir?.('up'); }}
            ><ArrowUp size={16} /></div>
            {/* Down */}
            <div
              style={{ ...btnStyle(!!availDirs.down), left: cx - ARROW_SIZE / 2, top: cardTop + scaledH + ARROW_OFFSET }}
              onClick={e => { e.stopPropagation(); if (availDirs.down) onMoveDir?.('down'); }}
            ><ArrowDown size={16} /></div>
            {/* Left */}
            <div
              style={{ ...btnStyle(!!availDirs.left), left: cardLeft - ARROW_SIZE - ARROW_OFFSET, top: cy - ARROW_SIZE / 2 }}
              onClick={e => { e.stopPropagation(); if (availDirs.left) onMoveDir?.('left'); }}
            ><ArrowLeft size={16} /></div>
            {/* Right */}
            <div
              style={{ ...btnStyle(!!availDirs.right), left: cardLeft + scaledW + ARROW_OFFSET, top: cy - ARROW_SIZE / 2 }}
              onClick={e => { e.stopPropagation(); if (availDirs.right) onMoveDir?.('right'); }}
            ><ArrowRight size={16} /></div>
          </>
        );
      })()}

      {useZone && zoneBuckets ? (
        /* ── Zone panel (Monitor | Thinker | Doer columns) below float card ── */
        <div
          style={{
            position: 'fixed',
            left: zonePanelLeft,
            top: zonePanelTop,
            width: FLOAT_CARD_WIDTH,
            zIndex: 50,
            maxHeight: '55vh',
            overflowY: 'auto',
            borderRadius: 'var(--r-card)',
            background: 'rgba(12, 12, 18, 0.88)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
            padding: 8,
          }}
          onClick={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          <WantZoneLayout
            monitorWants={zoneBuckets.monitor}
            thinkerWants={zoneBuckets.thinker}
            doerWants={zoneBuckets.doer}
            otherWants={zoneBuckets.other}
            renderWant={(w, role) => (
              <InlineZoneTile
                key={w.metadata?.id || w.id}
                want={w}
                role={role}
                onClick={onClickChild}
              />
            )}
            compact
          />
        </div>
      ) : (
        /* ── Fallback: floating ChildMiniTile tiles by role side ── */
        <>
          {renderGroup(groups.thinkers, 'thinker', 'top')}
          {renderGroup(groups.monitors, 'monitor', 'left')}
          {renderGroup(groups.doers,    'doer',    'right')}
          {renderGroup(groups.others,   'other',   'bottom')}
        </>
      )}
    </>
  );
};
