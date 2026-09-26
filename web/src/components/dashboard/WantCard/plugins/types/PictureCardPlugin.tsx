import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import { useDirectionGuideStore } from '@/stores/directionGuideStore';
import { snapToGridVector, isLegalHeading } from '@/utils/heading';
import { DirectionDial } from './DirectionCardPlugin';

const REACH = 5;

/**
 * The card of a picture want: the photo it keeps, the link it came from, and
 * where on the board it is pinned.
 *
 * The pin is aimed exactly the way a direction's heading is — the same dial on
 * the card, the same picker on the canvas when the card is drilled into from
 * the tile — because it is the same kind of value: a grid offset from this
 * tile. Only the webhook action differs (`pin` rather than `set`), and while
 * it is being aimed the photo itself follows it on the board.
 */
const PictureContentSection: React.FC<WantCardPluginProps> = ({
  want, isInnerFocused, onEnterInnerFocus, onExitInnerFocus,
}) => {
  const cur = (want.state?.current ?? {}) as Record<string, unknown>;
  const imageUrl = typeof cur.image_url === 'string' ? cur.image_url : '';
  const link = typeof cur.url === 'string' ? cur.url : '';
  const lastError = typeof cur.last_error === 'string' ? cur.last_error : '';
  const serverDx = typeof cur.pin_dx === 'number' ? cur.pin_dx : 2;
  const serverDy = typeof cur.pin_dy === 'number' ? cur.pin_dy : 0;

  const wantId = want.metadata?.id;
  const activeWantId = useDirectionGuideStore(s => s.activeWantId);
  const previewDx = useDirectionGuideStore(s => s.previewDx);
  const previewDy = useDirectionGuideStore(s => s.previewDy);
  const enterGuide = useDirectionGuideStore(s => s.enter);
  const setGuidePreview = useDirectionGuideStore(s => s.setPreview);
  const clearGuide = useDirectionGuideStore(s => s.clear);
  const isGuideActive = isInnerFocused && activeWantId === wantId;

  const post = useCallback(async (body: Record<string, unknown>) => {
    if (!wantId) return;
    try {
      await fetch(`/api/v1/webhooks/${wantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('[PictureCard] webhook failed:', err);
    }
  }, [wantId]);
  const commitPin = useCallback((dx: number, dy: number) => post({ action: 'pin', dx, dy }), [post]);

  // Drilled into from the tile: open the canvas picker on the pin. See
  // DirectionCardPlugin for why an already-open guide is left alone.
  useEffect(() => {
    if (isInnerFocused && wantId) {
      if (useDirectionGuideStore.getState().activeWantId !== wantId) {
        enterGuide(wantId, serverDx, serverDy, 'pin');
      }
      return () => {
        if (useDirectionGuideStore.getState().activeWantId === wantId) clearGuide();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInnerFocused, wantId]);

  useInputActions({
    enabled: !!isGuideActive,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onNavigate: (dir) => {
      const step =
        dir === 'left'  ? { dx: previewDx - 1, dy: previewDy } :
        dir === 'right' ? { dx: previewDx + 1, dy: previewDy } :
        dir === 'up'    ? { dx: previewDx, dy: previewDy - 1 } :
        dir === 'down'  ? { dx: previewDx, dy: previewDy + 1 } : null;
      // Off the dial, or under the tile itself, is refused — the server would
      // move a photo pinned there anyway (clampPicturePin).
      if (!step || !isLegalHeading(step.dx, step.dy, REACH)) return;
      setGuidePreview(step.dx, step.dy);
    },
    onConfirm: () => { commitPin(previewDx, previewDy); clearGuide(); onExitInnerFocus?.(); },
    onCancel: () => { clearGuide(); onExitInnerFocus?.(); },
  });

  // Mouse / touch on the card's own dial.
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const vectorFromEvent = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { dx: previewDx, dy: previewDy };
    const rect = svg.getBoundingClientRect();
    const k = 100 / rect.width;
    const cell = 40 / REACH;
    return snapToGridVector(((clientX - rect.left) * k - 50) / cell, ((clientY - rect.top) * k - 50) / cell, REACH);
  }, [previewDx, previewDy]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    if (wantId && useDirectionGuideStore.getState().activeWantId !== wantId) {
      enterGuide(wantId, serverDx, serverDy, 'pin');
    }
    if (!isInnerFocused) onEnterInnerFocus?.();
    const v = vectorFromEvent(e.clientX, e.clientY);
    setGuidePreview(v.dx, v.dy);
  }, [wantId, serverDx, serverDy, isInnerFocused, onEnterInnerFocus, enterGuide, setGuidePreview, vectorFromEvent]);
  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    const v = vectorFromEvent(e.clientX, e.clientY);
    setGuidePreview(v.dx, v.dy);
  }, [vectorFromEvent, setGuidePreview]);
  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = false;
    setDragging(false);
    const v = vectorFromEvent(e.clientX, e.clientY);
    commitPin(v.dx, v.dy);
    clearGuide();
    onExitInnerFocus?.();
  }, [vectorFromEvent, commitPin, clearGuide, onExitInnerFocus]);

  // The link, editable in place: pasting a share link is the whole of giving
  // a picture its photo.
  const [draft, setDraft] = useState(link);
  useEffect(() => { setDraft(link); }, [link]);
  const saveLink = () => {
    const next = draft.trim();
    if (next !== link) post({ action: 'set_url', url: next });
  };

  const dial = (
    <DirectionDial
      dx={isGuideActive ? previewDx : serverDx}
      dy={isGuideActive ? previewDy : serverDy}
      dragging={dragging}
      marks={[]}
      svgRef={svgRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );

  return (
    <WantCardLayout
      content={
        <div
          className="relative w-full h-full min-h-[96px] flex items-center justify-center overflow-hidden rounded"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {imageUrl ? (
            <>
              {/* The photo is the card. The link that produced it is edited in
                  Settings (the url param) once there is a photo to show. */}
              <img
                src={imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 scale-75 origin-right rounded-full bg-white/70 dark:bg-gray-900/60 backdrop-blur-sm">
                {dial}
              </div>
            </>
          ) : (
            // No photo yet: the card asks for the one thing it needs.
            <div className="flex flex-col items-center gap-1 w-full px-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center line-clamp-2">
                {lastError || 'Paste a Google Photos share link'}
              </span>
              <input
                type="url"
                value={draft}
                placeholder="https://photos.app.goo.gl/…"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveLink}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-full text-[11px] px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white/80 dark:bg-gray-900/60 text-gray-800 dark:text-gray-100"
              />
            </div>
          )}
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['picture'],
  ContentSection: PictureContentSection,
  hideFinalResult: true,
});
