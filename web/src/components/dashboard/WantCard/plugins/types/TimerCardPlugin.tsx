import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import {
  EVERY_PRESETS, TimerMode, parseAt,
} from '@/components/forms/timerUtils';
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

registerWantCardPlugin({
  types: ['timer'],
  ContentSection: TimerContentSection,
});
