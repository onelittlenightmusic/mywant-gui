import React, { useEffect, useCallback, useRef, useState } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import { useDirectionGuideStore } from '@/stores/directionGuideStore';
import { snapToGridVector, isLegalHeading } from '@/utils/heading';
import { useCharacterStore } from '@/stores/characterStore';
import { auraMarkFor, AuraMark } from '@/types/character';

const RADIUS_CELLS = 5;
const FACE_R = 40;
const CELL_PX = FACE_R / RADIUS_CELLS;
const CX = 50, CY = 50;

/** Same clamp-to-face-radius projection used for the current-vector needle, reused for aura-default star marks. */
function vectorToPoint(dx: number, dy: number): { x: number; y: number } {
  const magnitude = Math.hypot(dx, dy);
  const unitX = magnitude === 0 ? 1 : dx / magnitude;
  const unitY = magnitude === 0 ? 0 : dy / magnitude;
  const len = Math.min(magnitude, RADIUS_CELLS) * CELL_PX;
  return { x: CX + unitX * len, y: CY + unitY * len };
}

interface DirectionDialMark {
  color: string;
  dx: number;
  dy: number;
}

interface DirectionDialProps {
  dx: number;
  dy: number;
  dragging: boolean;
  marks: DirectionDialMark[];
  svgRef: React.Ref<SVGSVGElement>;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
}

// Radius-5 grid-vector dial, directly draggable on the card face — same
// snap-to-grid model and sky-blue needle styling as the canvas picker
// (CanvasDirectionGuide), so both surfaces read as the same control.
export const DirectionDial: React.FC<DirectionDialProps> = ({
  dx, dy, dragging, marks, svgRef, onPointerDown, onPointerMove, onPointerUp,
}) => {
  const magnitude = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  const { x: tipX, y: tipY } = vectorToPoint(dx, dy);

  const dots: React.ReactElement[] = [];
  for (let i = -RADIUS_CELLS; i <= RADIUS_CELLS; i++) {
    for (let j = -RADIUS_CELLS; j <= RADIUS_CELLS; j++) {
      if (Math.hypot(i, j) > RADIUS_CELLS + 0.01) continue;
      const isOrigin = i === 0 && j === 0;
      dots.push(
        <circle
          key={`${i},${j}`}
          cx={CX + i * CELL_PX}
          cy={CY + j * CELL_PX}
          r={isOrigin ? 1.8 : 1.1}
          className={isOrigin ? 'fill-gray-400 dark:fill-gray-500' : 'fill-sky-400/40 dark:fill-sky-300/30'}
        />,
      );
    }
  }

  return (
    <svg
      ref={svgRef}
      width={96} height={96} viewBox="0 0 100 100"
      style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <circle cx={CX} cy={CY} r={FACE_R} className="fill-white stroke-gray-200 dark:fill-gray-800 dark:stroke-gray-600" strokeWidth="1.5" />
      {dots}
      {marks.map((m, i) => {
        const { x, y } = vectorToPoint(m.dx, m.dy);
        return (
          <text
            key={i}
            x={x} y={y}
            textAnchor="middle" dominantBaseline="central"
            fontSize={12}
            fill={m.color}
            style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.7))' }}
          >
            ★
          </text>
        );
      })}
      <line x1={CX} y1={CY} x2={tipX} y2={tipY} className="stroke-sky-500 dark:stroke-sky-400" strokeWidth={dragging ? 3.5 : 3} strokeLinecap="round" />
      <circle cx={tipX} cy={tipY} r={4} className="fill-sky-500 dark:fill-sky-400" />
      <circle cx={CX} cy={CY} r="3" className="fill-gray-900 dark:fill-gray-100" />
      <text x={CX} y={CY + FACE_R + 12} textAnchor="middle" dominantBaseline="central"
        fontSize="9" fontFamily="monospace" fontWeight="bold"
        className="fill-gray-500 dark:fill-gray-400">
        ({dx.toFixed(0)},{dy.toFixed(0)}) · {angleDeg.toFixed(0)}°
      </text>
    </svg>
  );
};

const DirectionContentSection: React.FC<WantCardPluginProps> = ({
  want, isInnerFocused, onEnterInnerFocus, onExitInnerFocus,
}) => {
  const serverDx = typeof want.state?.current?.dx === 'number' ? want.state.current.dx : 1;
  const serverDy = typeof want.state?.current?.dy === 'number' ? want.state.current.dy : 0;

  const wantId = want.metadata?.id;
  const activeWantId = useDirectionGuideStore(s => s.activeWantId);
  const previewDx = useDirectionGuideStore(s => s.previewDx);
  const previewDy = useDirectionGuideStore(s => s.previewDy);
  const enterGuide = useDirectionGuideStore(s => s.enter);
  const setGuidePreview = useDirectionGuideStore(s => s.setPreview);
  const clearGuide = useDirectionGuideStore(s => s.clear);

  const isGuideActive = isInnerFocused && activeWantId === wantId;

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Open the picker (canvas overlay + this dial's grid) when the card becomes
  // inner-focused via keyboard/gamepad. Skipped if a pointer-drag on this
  // dial already opened it (avoids stomping the in-progress preview with the
  // stale server value). Closed on any exit path other than confirm/cancel
  // (e.g. selecting a different want while the guide is open).
  useEffect(() => {
    if (isInnerFocused && wantId) {
      if (useDirectionGuideStore.getState().activeWantId !== wantId) {
        enterGuide(wantId, serverDx, serverDy);
      }
      return () => {
        if (useDirectionGuideStore.getState().activeWantId === wantId) clearGuide();
      };
    }
    // Only re-run on focus transition — serverDx/Dy shouldn't reopen the guide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInnerFocused, wantId]);

  const commitToApi = useCallback(async (dx: number, dy: number) => {
    if (!wantId) return;
    try {
      await fetch(`/api/v1/webhooks/${wantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', dx, dy }),
      });
    } catch (err) {
      console.error('[DirectionCard] webhook failed:', err);
    }
  }, [wantId]);

  // Aura-default marking: x/X marks the currently-shown vector as *my*
  // character's default direction — shown as an aura-colored star on the
  // dial at that vector's position. Same pattern as GoingCardPlugin/
  // SwitchCardPlugin, with the vector encoded as a "dx,dy" string.
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const setAuraDefault = useCharacterStore(s => s.setAuraDefault);
  const wantType = want.metadata?.type;
  const marks = characters
    .map(c => ({ color: c.color, mark: auraMarkFor(c, wantType, 'current', 'vector') }))
    .filter((m): m is { color: string; mark: AuraMark } => m.mark !== undefined)
    .map(({ color, mark }) => {
      const [mdx, mdy] = String(mark.value).split(',').map(Number);
      return { color, dx: mdx, dy: mdy };
    });
  const handleMarkDefault = useCallback(() => {
    if (!wantId || !wantType || !myCharacterId) return;
    const mine = characters.find(c => c.id === myCharacterId);
    const shownDx = isGuideActive ? previewDx : serverDx;
    const shownDy = isGuideActive ? previewDy : serverDy;
    const currentValueStr = `${shownDx},${shownDy}`;
    const marked = mine ? auraMarkFor(mine, wantType, 'current', 'vector') : undefined;
    const next = marked?.value === currentValueStr ? '' : currentValueStr;
    setAuraDefault(wantId, wantType, 'current', 'vector', next);
  }, [wantId, wantType, myCharacterId, characters, isGuideActive, previewDx, previewDy, serverDx, serverDy, setAuraDefault]);

  // Inner focus: arrow keys nudge the vector by ±1 grid cell, Enter/A→confirm, Escape/B→cancel, x/X→mark aura-default
  useInputActions({
    enabled: !!isGuideActive,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onNavigate: (dir) => {
      // Refused rather than clamped when the step would leave the dial.
      //
      // These used to walk anywhere — hold right and the vector reached
      // (10, 0), which is not on the dial, cannot be drawn on it, and which
      // the server stores as (5, 0) because that is the longest heading it
      // will keep. So the vector confirmed was never the vector shown. The
      // edge stops the needle now, the way the edge of the face does when you
      // aim at it with a finger.
      const step =
        dir === 'left'  ? { dx: previewDx - 1, dy: previewDy } :
        dir === 'right' ? { dx: previewDx + 1, dy: previewDy } :
        dir === 'up'    ? { dx: previewDx, dy: previewDy - 1 } :
        dir === 'down'  ? { dx: previewDx, dy: previewDy + 1 } : null;
      if (!step || !isLegalHeading(step.dx, step.dy, RADIUS_CELLS)) return;
      setGuidePreview(step.dx, step.dy);
    },
    onConfirm: () => {
      commitToApi(previewDx, previewDy);
      clearGuide();
      onExitInnerFocus?.();
    },
    onCancel: () => {
      clearGuide();
      onExitInnerFocus?.();
    },
    onButtonX: handleMarkDefault,
  });

  // Mouse/touch: click or drag directly on the card's own dial to aim, no
  // keyboard/gamepad required. Uses the same grid-snap math as the canvas
  // picker (snapToGridVector) so a click and a drag-release land on the same
  // value the canvas overlay would produce at that position.
  const vectorFromEvent = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { dx: previewDx, dy: previewDy };
    const rect = svg.getBoundingClientRect();
    const scale = 100 / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    return snapToGridVector((x - CX) / CELL_PX, (y - CY) / CELL_PX, RADIUS_CELLS);
  }, [previewDx, previewDy]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    if (wantId && useDirectionGuideStore.getState().activeWantId !== wantId) {
      enterGuide(wantId, serverDx, serverDy);
    }
    if (!isInnerFocused) onEnterInnerFocus?.();
    const v = vectorFromEvent(e.clientX, e.clientY);
    setGuidePreview(v.dx, v.dy);
  }, [wantId, serverDx, serverDy, isInnerFocused, onEnterInnerFocus, enterGuide, setGuidePreview, vectorFromEvent]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    const v = vectorFromEvent(e.clientX, e.clientY);
    setGuidePreview(v.dx, v.dy);
  }, [vectorFromEvent, setGuidePreview]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = false;
    setDragging(false);
    const v = vectorFromEvent(e.clientX, e.clientY);
    commitToApi(v.dx, v.dy);
    clearGuide();
    onExitInnerFocus?.();
  }, [vectorFromEvent, commitToApi, clearGuide, onExitInnerFocus]);

  const displayDx = isGuideActive ? previewDx : serverDx;
  const displayDy = isGuideActive ? previewDy : serverDy;

  return (
    <WantCardLayout
      centerContent
      content={
        <div onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
          <DirectionDial
            dx={displayDx}
            dy={displayDy}
            dragging={dragging}
            marks={marks}
            svgRef={svgRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['direction'],
  ContentSection: DirectionContentSection,
});
