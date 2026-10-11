import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WantCardPluginProps, WantTileFaceProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import {
  EVERY_PRESETS, TimerMode, parseAt, angleForEvery, WEEKDAY_VALS,
} from '@/components/forms/timerUtils';
import { stateString, tileFacePalette, untilLabel, useNow } from '../../tileFace/tileFaceKit';
import { TimerEveryDial } from '@/components/forms/TimerEveryDial';
import { TimerClockFace } from '@/components/forms/TimerClockFace';
import { EnumToggleGroup } from '@/components/common/EnumToggleGroup';

const TIMER_MODE_OPTIONS = [{ value: 'every' }, { value: 'at' }];

const TimerContentSection: React.FC<WantCardPluginProps> = ({
  want, isChild, isControl, isFocused, isInnerFocused, onExitInnerFocus, isExpanded,
}) => {
  const stateEvery        = (want.state?.internal?.every         as string) || '';
  const stateAt           = (want.state?.internal?.at            as string) || '';
  const stateTimerMode    = (want.state?.internal?.timer_mode    as string) || 'every';
  const stateAtRecurrence = (want.state?.internal?.at_recurrence as string) || '';
  const stateAtWeekday    = (want.state?.internal?.at_weekday    as string) || '';
  const timerTargetParam  = (want.state?.internal?.target_param  as string) || '';

  const [mode, setMode]               = useState<TimerMode>(stateTimerMode === 'at' ? 'at' : 'every');
  const [localEvery, setLocalEvery]   = useState(stateEvery);
  const [atH24, setAtH24]             = useState(() => parseAt(stateAt).h24);
  const [atMin, setAtMin]             = useState(() => parseAt(stateAt).min);
  const [atRecurrence, setAtRecurrence] = useState(stateAtRecurrence);
  const [atWeekday, setAtWeekday]     = useState(stateAtWeekday);

  const everyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef     = useRef(stateEvery);
  // Always-current snapshot of all timer fields for use inside debounce closures.
  const timerStateRef    = useRef({ mode, localEvery, atH24, atMin, atRecurrence, atWeekday });

  useEffect(() => { if (!isInnerFocused) setLocalEvery(stateEvery); }, [stateEvery, isInnerFocused]);
  useEffect(() => { const p = parseAt(stateAt); setAtH24(p.h24); setAtMin(p.min); }, [stateAt]);
  useEffect(() => { setAtRecurrence(stateAtRecurrence); }, [stateAtRecurrence]);
  useEffect(() => { setAtWeekday(stateAtWeekday); }, [stateAtWeekday]);
  useEffect(() => { setMode(stateTimerMode === 'at' ? 'at' : 'every'); }, [stateTimerMode]);
  useEffect(() => { if (isInnerFocused) committedRef.current = localEvery; }, [isInnerFocused, localEvery]);
  useEffect(() => { timerStateRef.current = { mode, localEvery, atH24, atMin, atRecurrence, atWeekday }; });

  // Send all timer fields as a single webhook; overrides let callers supply just-changed values
  // before the corresponding setState has flushed to timerStateRef.
  const sendWebhook = useCallback((overrides: Record<string, string> = {}) => {
    const id = want.metadata?.id;
    if (!id) return;
    const s = timerStateRef.current;
    const at = `${String(s.atH24).padStart(2, '0')}:${String(s.atMin).padStart(2, '0')}`;
    fetch(`/api/v1/webhooks/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'set',
        timer_mode: s.mode,
        every: s.localEvery,
        at,
        at_recurrence: s.atRecurrence,
        at_weekday: s.atWeekday,
        ...overrides,
      }),
    }).catch(err => console.error('[TimerCard] webhook failed:', err));
  }, [want.metadata?.id]);

  const handleModeSwitch = (newMode: TimerMode) => {
    setMode(newMode);
    sendWebhook({ timer_mode: newMode });
  };

  const isDirty = !!isInnerFocused && localEvery !== committedRef.current;

  useInputActions({
    enabled: !!isInnerFocused && mode === 'every',
    captureInput: true,
    ignoreWhenInputFocused: false,
    onNavigate: (dir) => {
      const idx = EVERY_PRESETS.indexOf(localEvery);
      if (dir === 'up' || dir === 'right') {
        setLocalEvery(EVERY_PRESETS[Math.min(EVERY_PRESETS.length - 1, idx < 0 ? 0 : idx + 1)]);
      } else {
        setLocalEvery(EVERY_PRESETS[Math.max(0, idx < 0 ? EVERY_PRESETS.length - 1 : idx - 1)]);
      }
    },
    onConfirm: () => { sendWebhook({ every: localEvery }); onExitInnerFocus?.(); },
    onCancel:  () => { setLocalEvery(committedRef.current); onExitInnerFocus?.(); },
  });

  // Compact view: small toggle + scaled dial
  if (!isExpanded) {
    const SCALE = 0.75;
    const DIAL_PX = 140;
    const scaledPx = Math.round(DIAL_PX * SCALE); // 105

    return (
      <WantCardLayout
        top={
          <div
            className="mb-1 px-1"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <EnumToggleGroup
              value={mode}
              onChange={val => handleModeSwitch(val as TimerMode)}
              options={TIMER_MODE_OPTIONS}
            />
          </div>
        }
        centerContent
        content={
          <div style={{ width: scaledPx, height: scaledPx, overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ transform: `scale(${SCALE})`, transformOrigin: 'top left', width: DIAL_PX, height: DIAL_PX }}>
              {mode === 'every' ? (
                <TimerEveryDial
                  every={localEvery}
                  isDirty={isDirty}
                  stopPropagation
                  onSelect={(preset) => {
                    setLocalEvery(preset);
                    if (isInnerFocused) onExitInnerFocus?.();
                    if (everyDebounceRef.current) clearTimeout(everyDebounceRef.current);
                    everyDebounceRef.current = setTimeout(() => sendWebhook({ every: preset }), 400);
                  }}
                />
              ) : (
                <TimerClockFace
                  atH24={atH24}
                  atMin={atMin}
                  atRecurrence={atRecurrence}
                  atWeekday={atWeekday}
                  stopPropagation
                  onAtChange={(at) => {
                    const p = parseAt(at);
                    setAtH24(p.h24);
                    setAtMin(p.min);
                    sendWebhook({ at });
                  }}
                  onRecurrenceChange={(r) => {
                    setAtRecurrence(r);
                    sendWebhook({ at_recurrence: r });
                  }}
                  onAtWeekdayChange={(wd) => {
                    setAtWeekday(wd);
                    sendWebhook({ at_weekday: wd });
                  }}
                />
              )}
            </div>
          </div>
        }
      />
    );
  }

  // Full dial view for expanded card
  return (
    <WantCardLayout
      top={
        <div
          className="px-2 pt-2 pb-1"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          <EnumToggleGroup
            value={mode}
            onChange={val => handleModeSwitch(val as TimerMode)}
            options={TIMER_MODE_OPTIONS}
          />
        </div>
      }
      content={
        <div className="overflow-auto px-1 py-1">
          {mode === 'every' ? (
            <TimerEveryDial
              every={localEvery}
              isDirty={isDirty}
              stopPropagation
              onSelect={(preset) => {
                setLocalEvery(preset);
                if (isInnerFocused) onExitInnerFocus?.();
                if (everyDebounceRef.current) clearTimeout(everyDebounceRef.current);
                everyDebounceRef.current = setTimeout(() => sendWebhook({ every: preset }), 400);
              }}
              rightSlot={
                <>
                  {isDirty && (
                    <div className="absolute right-0 -top-5 font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded shadow-sm border border-yellow-200 pointer-events-none">
                      OK?
                    </div>
                  )}
                  <span className="text-gray-400 dark:text-gray-500 font-mono truncate leading-none"
                    title={timerTargetParam}>
                    {timerTargetParam || 'timer'}
                  </span>
                  <span className={`font-mono font-bold leading-tight ${isDirty ? 'text-yellow-500 dark:text-yellow-400' : 'text-blue-500 dark:text-blue-400'}`}
                    style={{ transition: 'color 0.2s' }}>
                    {localEvery || '--'}
                  </span>
                </>
              }
            />
          ) : (
            <TimerClockFace
              atH24={atH24}
              atMin={atMin}
              atRecurrence={atRecurrence}
              atWeekday={atWeekday}
              stopPropagation
              onAtChange={(at) => {
                const p = parseAt(at);
                setAtH24(p.h24);
                setAtMin(p.min);
                sendWebhook({ at });
              }}
              onRecurrenceChange={(r) => {
                setAtRecurrence(r);
                sendWebhook({ at_recurrence: r });
              }}
              onAtWeekdayChange={(wd) => {
                setAtWeekday(wd);
                sendWebhook({ at_weekday: wd });
              }}
              rightExtra={
                <span className="text-gray-400 dark:text-gray-500 font-mono truncate leading-none"
                  title={timerTargetParam}>
                  {timerTargetParam || 'timer'}
                </span>
              }
            />
          )}
        </div>
      }
    />
  );
};

// ── Tile face ────────────────────────────────────────────────────────────────

/** The next time an `at` timer fires: today or tomorrow, or that weekday. */
function nextAtFire(h24: number, min: number, recurrence: string, weekday: string, now: number): number {
  const d = new Date(now);
  d.setHours(h24, min, 0, 0);
  const idx = WEEKDAY_VALS.indexOf(weekday);
  if (recurrence === 'week' && idx >= 0) {
    const jsDay = (idx + 1) % 7;                       // WEEKDAY_VALS starts on Monday
    d.setDate(d.getDate() + ((jsDay - d.getDay() + 7) % 7));
    if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  } else if (d.getTime() <= now) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

/** '5m' → '5分ごと'. */
function everyLabel(every: string): string {
  const m = /^(\d+)\s*([smhd])$/.exec(every);
  if (!m) return every;
  const unit = { s: '秒', m: '分', h: '時間', d: '日' }[m[2] as 's' | 'm' | 'h' | 'd'];
  return `${m[1]}${unit}ごと`;
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

/**
 * The timer's tile face: a real clock. In `at` mode its hands stand at the
 * time it fires, and in the last hour an arc on the rim runs from now to then,
 * shrinking as it comes. In `every` mode the hand points at its interval on
 * the same ladder the card's dial uses. Under it, the same in words.
 */
const TimerTileFace: React.FC<WantTileFaceProps> = ({ want, width, height, isLight }) => {
  const now = useNow();
  const palette = tileFacePalette(isLight);
  const mode = stateString(want.state, 'timer_mode') === 'at' ? 'at' : 'every';
  const every = stateString(want.state, 'every');

  const vbH = Math.max(60, Math.round((100 * height) / Math.max(1, width)));
  const panelH = vbH - 10;
  const r = Math.max(14, Math.min(30, (panelH - 22) / 2));
  const cx = 50, cy = 5 + 4 + r;

  let hands: React.ReactNode = null;
  let arc: React.ReactNode = null;
  let label = '';

  if (mode === 'at') {
    const { h24, min } = parseAt(stateString(want.state, 'at'));
    const next = nextAtFire(h24, min, stateString(want.state, 'at_recurrence'),
      stateString(want.state, 'at_weekday'), now);
    label = untilLabel(next, now);
    const hourTip = polar(cx, cy, r * 0.5, ((h24 % 12) + min / 60) * 30);
    const minTip = polar(cx, cy, r * 0.78, min * 6);
    hands = (
      <>
        <line x1={cx} y1={cy} x2={hourTip.x} y2={hourTip.y} stroke={palette.ink} strokeWidth="3.4" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={minTip.x} y2={minTip.y} stroke={palette.accent} strokeWidth="2.2" strokeLinecap="round" />
      </>
    );
    const remainingMin = (next - now) / 60_000;
    if (remainingMin > 0 && remainingMin <= 60) {
      const from = (new Date(now).getMinutes() + new Date(now).getSeconds() / 60) * 6;
      const sweep = remainingMin * 6;
      const a = polar(cx, cy, r, from);
      const b = polar(cx, cy, r, from + sweep);
      arc = (
        <path d={`M ${a.x} ${a.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${b.x} ${b.y}`}
          fill="none" stroke="#e8772e" strokeWidth="4" strokeLinecap="round" />
      );
    }
  } else {
    label = every ? everyLabel(every) : '';
    const i = EVERY_PRESETS.indexOf(every);
    // The card's dial ladder (angleForEvery), turned from its frame to the clock's.
    const deg = i >= 0 ? angleForEvery(i) * (180 / Math.PI) + 90 : 0;
    const tip = polar(cx, cy, r * 0.8, deg);
    hands = <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={palette.accent} strokeWidth="2.6" strokeLinecap="round" />;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 100 ${vbH}`} role="img"
      aria-label={['timer', label].filter(Boolean).join(' ')}
      style={{ display: 'block', fontFamily: 'inherit' }}>
      <rect x="5" y="5" width="90" height={panelH} rx="9" fill={palette.panel} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.accent} strokeWidth="2" />
      {[0, 90, 180, 270].map(d => {
        const o = polar(cx, cy, r, d), n = polar(cx, cy, r - 4, d);
        return <line key={d} x1={o.x} y1={o.y} x2={n.x} y2={n.y} stroke={palette.ink} strokeWidth="1.6" strokeLinecap="round" />;
      })}
      {arc}
      {hands}
      <circle cx={cx} cy={cy} r="2.6" fill={palette.ink} />
      {label && (
        <text x="50" y={panelH + 1} textAnchor="middle" fill={palette.ink} fontSize="11" fontWeight="700">{label}</text>
      )}
    </svg>
  );
};

registerWantCardPlugin({
  types: ['timer'],
  ContentSection: TimerContentSection,
  TileFace: TimerTileFace,
});
