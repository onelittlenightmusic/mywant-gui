import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { NumberSliderInput } from '@/components/common/NumberSliderInput';
import { WantCardLayout } from '../../WantCardLayout';
import { useCharacterStore } from '@/stores/characterStore';
import { auraMarkFor, AuraMark } from '@/types/character';

const GearContentSection: React.FC<WantCardPluginProps> = ({
  want, isInnerFocused, onExitInnerFocus, onSliderActiveChange,
}) => {
  const gearValue = typeof want.state?.current?.value === 'number' ? want.state.current.value : 1;
  const gearMin = typeof want.state?.current?.min === 'number' ? want.state.current.min : 0;
  const gearMax = typeof want.state?.current?.max === 'number' ? want.state.current.max : 5;
  const gearStep = typeof want.state?.current?.step === 'number' ? want.state.current.step : 0.1;

  const [localValue, setLocalValue] = useState(gearValue);

  // Aura-default marking: x/X marks the currently-shown speed value as *my*
  // character's default — shown as an aura-colored downward triangle at that
  // value's position on the track. Same pattern as GoingCardPlugin/
  // SwitchCardPlugin, just placed by percent instead of a fixed knob spot.
  const wantId = want.metadata?.id;
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const setAuraDefault = useCharacterStore(s => s.setAuraDefault);
  const wantType = want.metadata?.type;
  const marks = characters
    .map(c => ({ color: c.color, mark: auraMarkFor(c, wantType, 'current', 'value') }))
    .filter((m): m is { color: string; mark: AuraMark } => m.mark !== undefined)
    .map(({ color, mark }) => ({ color, value: Number(mark.value) }));
  const handleMarkDefault = useCallback(() => {
    if (!wantId || !wantType || !myCharacterId) return;
    const mine = characters.find(c => c.id === myCharacterId);
    const currentValueStr = String(localValue);
    const marked = mine ? auraMarkFor(mine, wantType, 'current', 'value') : undefined;
    const next = marked?.value === currentValueStr ? '' : currentValueStr;
    setAuraDefault(wantId, wantType, 'current', 'value', next);
  }, [wantId, wantType, myCharacterId, characters, localValue, setAuraDefault]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Value captured when inner focus starts — used to revert on cancel
  const committedRef = useRef(gearValue);

  // Sync from server unless inner-focused (would override in-progress navigation)
  useEffect(() => {
    if (!isInnerFocused) setLocalValue(gearValue);
  }, [gearValue, isInnerFocused]);

  // Capture the committed value when entering inner focus
  useEffect(() => {
    if (isInnerFocused) committedRef.current = localValue;
  }, [isInnerFocused]);

  const commitToApi = useCallback(async (value: number) => {
    const id = want.metadata?.id;
    if (!id) return;
    try {
      await fetch(`/api/v1/webhooks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', value }),
      });
    } catch (err) {
      console.error('[GearCard] webhook failed:', err);
    }
  }, [want.metadata?.id]);

  // Mouse drag: update locally and commit immediately via debounce
  const handleMouseChange = useCallback((newValue: number) => {
    const clamped = Math.min(gearMax, Math.max(gearMin, newValue));
    setLocalValue(clamped);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitToApi(clamped), 150);
  }, [gearMin, gearMax, commitToApi]);

  const isDirty = !!isInnerFocused && localValue !== committedRef.current;

  // Inner focus: left/right→adjust, Enter/A→confirm, Escape/B→revert+exit
  useInputActions({
    enabled: !!isInnerFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onNavigate: (dir) => {
      if (dir === 'left') setLocalValue(v => Math.max(gearMin, v - gearStep));
      else if (dir === 'right') setLocalValue(v => Math.min(gearMax, v + gearStep));
    },
    onConfirm: () => {
      commitToApi(localValue);
      onExitInnerFocus?.();
    },
    onCancel: () => {
      setLocalValue(committedRef.current);
      onExitInnerFocus?.();
    },
    onButtonX: handleMarkDefault,
  });

  return (
    <WantCardLayout
      centerContent
      content={
        <div
          className="w-full px-2"
          onPointerEnter={() => onSliderActiveChange?.(true)}
          onPointerLeave={() => onSliderActiveChange?.(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <NumberSliderInput
            value={localValue}
            min={gearMin}
            max={gearMax}
            step={gearStep}
            onChange={handleMouseChange}
            isDirty={isDirty}
            label="speed"
            stopPropagation
            inheritFontSize
            marks={marks}
          />
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['gear'],
  ContentSection: GearContentSection,
});
