/**
 * RecipeSlideDeck — replaces the body of a non-expanded recipe target card
 * with a slide-deck view of its child wants.
 *
 * A virtual "balloon dot" sits at the end of the dot row (idx === slides.length).
 * Navigating to it calls onOpenBalloon; navigating away calls onCloseBalloon.
 *
 * Idle wants (status === 'idle') are shown with a dimmed dot + hourglass icon
 * and are skipped when navigating with arrows / swipe / keyboard.
 */
import React, { useState, useMemo, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Hourglass } from 'lucide-react';
import { Want } from '@/types/want';
import { WantCardContent } from '../../WantCardContent';
import { getWantRole, ZONE_PALETTES } from '../../WantZoneLayout';
import { ChildRole } from '../../ChildMiniTile';

export interface RecipeSlideDeckHandle {
  goRight: () => void;
  goLeft: () => void;
}

interface RecipeSlideDeckProps {
  parentWant: Want;
  children: Want[];
  onView: (want: Want) => void;
  onViewAgents?: (want: Want) => void;
  onViewResults?: (want: Want) => void;
  onViewChat?: (want: Want) => void;
  onEdit?: (want: Want) => void;
  onDelete?: (want: Want) => void;
  onSuspend?: (want: Want) => void;
  onResume?: (want: Want) => void;
  onShowReactionConfirmation?: (want: Want, action: 'approve' | 'deny') => void;
  onSlideChange?: (current: Want) => void;
  isInnerFocused?: boolean;
  onEnterInnerFocus?: () => void;
  onExitInnerFocus?: () => void;
  onOpenBalloon?: () => void;
  onCloseBalloon?: () => void;
}

const ROLE_ORDER: ChildRole[] = ['monitor', 'thinker', 'doer', 'other'];

const isIdleWant = (w: Want) => (w.status ?? '').toLowerCase() === 'idle';

function sortedByRole(wants: Want[]): Want[] {
  return [...wants].sort((a, b) => {
    const ra = ROLE_ORDER.indexOf(getWantRole(a) as ChildRole);
    const rb = ROLE_ORDER.indexOf(getWantRole(b) as ChildRole);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });
}

function smartDefault(sorted: Want[]): number {
  // Skip idle wants for default selection
  const anyThinkerDone = sorted.some(
    w => getWantRole(w) === 'thinker' && (w.status ?? '').startsWith('achieved') && !isIdleWant(w),
  );
  if (anyThinkerDone) {
    const i = sorted.findIndex(w => getWantRole(w) === 'doer' && !isIdleWant(w));
    if (i >= 0) return i;
  }
  let last = -1;
  sorted.forEach((w, i) => { if (getWantRole(w) === 'thinker' && !isIdleWant(w)) last = i; });
  if (last >= 0) return last;
  // Fallback: first non-idle slide, or 0 if all idle
  const firstNonIdle = sorted.findIndex(w => !isIdleWant(w));
  return firstNonIdle >= 0 ? firstNonIdle : 0;
}

export const RecipeSlideDeck = forwardRef<RecipeSlideDeckHandle, RecipeSlideDeckProps>(function RecipeSlideDeck({
  parentWant,
  children,
  onView,
  onViewAgents,
  onViewResults,
  onViewChat,
  onEdit,
  onDelete,
  onSuspend,
  onResume,
  onShowReactionConfirmation,
  onSlideChange,
  isInnerFocused,
  onEnterInnerFocus,
  onExitInnerFocus,
  onOpenBalloon,
  onCloseBalloon,
}, ref) {
  const slides = useMemo(() => sortedByRole(children), [children]);
  const [idx, setIdx] = useState(() => smartDefault(slides));
  const manualRef = useRef(false);
  const [animClass, setAnimClass] = useState('');

  const BALLOON_IDX = slides.length;

  const statusKey = slides.map(w => w.status).join(',');
  useEffect(() => {
    if (!manualRef.current) {
      setIdx(smartDefault(slides));
    } else {
      // If current slide became idle while user is viewing it, auto-advance
      setIdx(prev => {
        if (prev < slides.length && isIdleWant(slides[prev])) return smartDefault(slides);
        return prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);

  const slideIdxForEffect = Math.min(Math.max(idx, 0), slides.length - 1);
  useEffect(() => {
    if (slides[slideIdxForEffect]) onSlideChange?.(slides[slideIdxForEffect]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIdxForEffect, slides]);

  // ── Navigation helpers (skip idle) ────────────────────────────────────────
  // Returns the next navigable index going right from `from`, or BALLOON_IDX if none left.
  const nextRightIdx = (from: number): number => {
    for (let i = from + 1; i < BALLOON_IDX; i++) {
      if (!isIdleWant(slides[i])) return i;
    }
    return BALLOON_IDX;
  };

  // Returns the next navigable index going left from `from`, or -1 if none left.
  const prevLeftIdx = (from: number): number => {
    const start = from === BALLOON_IDX ? slides.length - 1 : from - 1;
    for (let i = start; i >= 0; i--) {
      if (!isIdleWant(slides[i])) return i;
    }
    return -1;
  };

  // ── Touch swipe ──────────────────────────────────────────────────────────
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const goTo = useCallback((next: number) => {
    if (next < 0 || next > BALLOON_IDX || next === idx) return;
    manualRef.current = true;

    if (next === BALLOON_IDX) {
      setIdx(BALLOON_IDX);
      onOpenBalloon?.();
      return;
    }

    if (idx === BALLOON_IDX) {
      setIdx(next);
      onCloseBalloon?.();
      return;
    }

    const dir = next > idx ? 'left' : 'right';
    setAnimClass(dir === 'left' ? 'slide-exit-left' : 'slide-exit-right');
    setTimeout(() => {
      setIdx(next);
      setAnimClass(dir === 'left' ? 'slide-enter-right' : 'slide-enter-left');
      setTimeout(() => setAnimClass(''), 300);
    }, 20);
  }, [idx, BALLOON_IDX, onOpenBalloon, onCloseBalloon]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const THRESHOLD = 40;
    const cur = Math.min(Math.max(idx, 0), BALLOON_IDX);
    if (dx < -THRESHOLD) {
      const next = nextRightIdx(cur);
      if (next <= BALLOON_IDX) goTo(next);
    } else if (dx > THRESHOLD) {
      const prev = prevLeftIdx(cur);
      if (prev >= 0) goTo(prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, BALLOON_IDX, goTo, slides]);

  useImperativeHandle(ref, () => ({
    goRight: () => {
      const cur = Math.min(Math.max(idx, 0), BALLOON_IDX);
      const next = nextRightIdx(cur);
      if (next <= BALLOON_IDX) goTo(next);
    },
    goLeft: () => {
      const cur = Math.min(Math.max(idx, 0), BALLOON_IDX);
      const prev = prevLeftIdx(cur);
      if (prev >= 0) goTo(prev);
    },
  }), [goTo, idx, BALLOON_IDX, slides]);

  if (slides.length === 0) return null;

  const isBalloonActive = idx === BALLOON_IDX;
  const contentIdx = Math.min(Math.max(idx, 0), slides.length - 1);
  const current = slides[contentIdx];

  // Arrow visibility with idle-aware logic
  const cur = Math.min(Math.max(idx, 0), BALLOON_IDX);
  const hasPrev = prevLeftIdx(isBalloonActive ? BALLOON_IDX : idx) >= 0;
  const hasNext = !isBalloonActive && nextRightIdx(idx) < BALLOON_IDX;

  return (
    <div className="relative flex flex-col h-full">
      {/* Unified top indicator: slide dots + balloon dot */}
      <div className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 pt-1 pb-0.5">
        {slides.map((w, i) => {
          const r = (getWantRole(w) ?? 'other') as ChildRole;
          const p = ZONE_PALETTES[r] ?? ZONE_PALETTES.other;
          const Icon = p.icon;
          const isActive = i === idx;
          const idle = isIdleWant(w);
          return (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); if (!idle) goTo(i); }}
              aria-label={isActive ? p.label : idle ? 'Idle' : `Go to slide ${i + 1}`}
              className="flex items-center gap-1 rounded-full font-semibold text-white transition-all duration-200 ease-in-out"
              style={{
                position: 'relative',
                overflow: idle && !isActive ? 'visible' : 'hidden',
                backgroundColor: p.dogEarColor + (isActive ? 'cc' : idle ? '28' : '55'),
                padding: isActive ? '2px 8px' : '0',
                width:  isActive ? 'auto' : '8px',
                height: isActive ? 'auto' : '8px',
                minWidth: isActive ? undefined : '8px',
                fontSize: '10px',
                lineHeight: '16px',
                flexShrink: 0,
                cursor: idle && !isActive ? 'default' : 'pointer',
              }}
            >
              {/* Hourglass peeking out of idle (inactive) dot */}
              {idle && !isActive && (
                <Hourglass
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 12,
                    height: 12,
                    color: p.dogEarColor,
                    opacity: 0.85,
                    pointerEvents: 'none',
                    flexShrink: 0,
                  }}
                />
              )}
              <Icon
                style={{
                  width: 10, height: 10,
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  maxWidth: isActive ? '80px' : '0px',
                  opacity: isActive ? 1 : 0,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  transition: 'max-width 0.2s ease, opacity 0.15s',
                }}
              >
                {p.label}
              </span>
            </button>
          );
        })}

        {/* Balloon dot — virtual last position */}
        <button
          onClick={e => { e.stopPropagation(); goTo(BALLOON_IDX); }}
          aria-label="Open children bubble"
          className="flex items-center gap-1 rounded-full font-semibold text-white overflow-hidden transition-all duration-200 ease-in-out"
          style={{
            backgroundColor: isBalloonActive ? 'rgba(90,90,105,0.95)' : 'rgba(120,120,135,0.75)',
            padding: isBalloonActive ? '2px 8px' : '0',
            width:  isBalloonActive ? 'auto' : '8px',
            height: isBalloonActive ? 'auto' : '8px',
            minWidth: isBalloonActive ? undefined : '8px',
            fontSize: '10px',
            lineHeight: '16px',
            flexShrink: 0,
          }}
        >
          <MessageCircle
            style={{
              width: 10, height: 10,
              opacity: isBalloonActive ? 1 : 0,
              transition: 'opacity 0.15s',
              flexShrink: 0,
              color: 'white',
            }}
          />
          <span
            style={{
              maxWidth: isBalloonActive ? '80px' : '0px',
              opacity: isBalloonActive ? 1 : 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              transition: 'max-width 0.2s ease, opacity 0.15s',
              color: 'white',
            }}
          >
            子Want
          </span>
        </button>
      </div>

      {/* Slide area */}
      <div
        className="relative flex-1 min-h-0 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={contentIdx}
          className={[
            'absolute inset-0 overflow-hidden',
            animClass === 'slide-exit-left'   ? 'animate-slide-exit-left'   :
            animClass === 'slide-exit-right'  ? 'animate-slide-exit-right'  :
            animClass === 'slide-enter-right' ? 'animate-slide-enter-right' :
            animClass === 'slide-enter-left'  ? 'animate-slide-enter-left'  : '',
          ].filter(Boolean).join(' ')}
        >
          <WantCardContent
            want={current}
            isChild={true}
            hasChildren={false}
            isFocused={false}
            onView={onView}
            onViewAgents={onViewAgents}
            onViewResults={onViewResults}
            onViewChat={onViewChat}
            onEdit={onEdit}
            onDelete={onDelete}
            onSuspend={onSuspend}
            onResume={onResume}
            onShowReactionConfirmation={onShowReactionConfirmation}
            isInnerFocused={isInnerFocused}
            onEnterInnerFocus={onEnterInnerFocus}
            onExitInnerFocus={onExitInnerFocus}
          />
        </div>

        {/* Left arrow */}
        {hasPrev && (
          <button
            onClick={e => { e.stopPropagation(); const p = prevLeftIdx(isBalloonActive ? BALLOON_IDX : idx); if (p >= 0) goTo(p); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-12 rounded-r-lg bg-black/25 hover:bg-black/45 active:bg-black/60 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-4 h-4 text-white drop-shadow" />
          </button>
        )}

        {/* Right arrow */}
        {hasNext && (
          <button
            onClick={e => { e.stopPropagation(); const n = nextRightIdx(idx); if (n < BALLOON_IDX) goTo(n); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-7 h-12 rounded-l-lg bg-black/25 hover:bg-black/45 active:bg-black/60 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-4 h-4 text-white drop-shadow" />
          </button>
        )}
      </div>

    </div>
  );
});
