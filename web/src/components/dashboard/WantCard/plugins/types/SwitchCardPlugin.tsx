import React, { useState, useEffect } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import { postWantWebhook } from '@/utils/wantWebhook';
import { ToggleDefaultBookmarks } from '@/components/common/ToggleDefaultBookmarks';
import { useCharacterStore } from '@/stores/characterStore';
import { auraMarkFor, AuraMark } from '@/types/character';

const SwitchContentSection: React.FC<WantCardPluginProps> = ({
  want, isChild, isControl, isFocused, isInnerFocused, onExitInnerFocus,
}) => {
  const serverOn = want.state?.current?.on === true;
  const rawLabel = (want.state?.current?.label) || (want.spec?.params?.label);
  const label = typeof rawLabel === 'string' ? rawLabel : 'Switch';

  const [localOn, setLocalOn] = useState(serverOn);
  const [pending, setPending] = useState(false);

  useEffect(() => { setLocalOn(serverOn); }, [serverOn]);

  const handleToggle = async () => {
    if (pending) return;
    const next = !localOn;
    setLocalOn(next);
    setPending(true);

    const id = want.metadata?.id;
    if (!id) { setPending(false); return; }
    const ok = await postWantWebhook(id, { action: next ? 'on' : 'off' }, 'SwitchCard');
    if (!ok) setLocalOn(!next);
    setPending(false);
  };

  // Aura-default marking: x/X marks the currently-shown state (on/off) as *my*
  // character's default for this toggle — shown as an aura-colored star at the
  // on- or off-knob position (whichever was marked), regardless of which state
  // the toggle is currently showing, so on- and off-marks stay visually
  // distinguishable. See ChoiceCardPlugin for the original (per-list-item)
  // version of this feature.
  const wantId = want.metadata?.id;
  const currentValueStr = String(localOn);
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const setAuraDefault = useCharacterStore(s => s.setAuraDefault);
  const wantType = want.metadata?.type;
  const marks = characters
    .map(c => ({ color: c.color, mark: auraMarkFor(c, wantType, 'current', 'on') }))
    .filter((m): m is { color: string; mark: AuraMark } => m.mark !== undefined)
    .map(({ color, mark }) => ({ color, value: mark.value === 'true' }));
  const handleMarkDefault = () => {
    if (!wantId || !wantType || !myCharacterId) return;
    const mine = characters.find(c => c.id === myCharacterId);
    const marked = mine ? auraMarkFor(mine, wantType, 'current', 'on') : undefined;
    const next = marked?.value === currentValueStr ? '' : currentValueStr;
    setAuraDefault(wantId, wantType, 'current', 'on', next);
  };

  // Gamepad/keyboard inner focus: A→toggle, B→exit, x/X→mark aura-default
  useInputActions({
    enabled: !!isInnerFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onConfirm: handleToggle,
    onCancel: onExitInnerFocus,
    onButtonX: handleMarkDefault,
  });

  const compact = isChild || (isControl && !isFocused);

  return (
    <WantCardLayout
      centerContent
      content={
      <div
        className="flex flex-col items-center gap-2"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
      <div className={isInnerFocused ? 'ring-2 ring-sky-400 ring-offset-1 rounded-full' : undefined}>
        <button
          onClick={(e) => { e.stopPropagation(); handleToggle(); }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={pending}
          className="relative focus:outline-none"
          aria-label={label}
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <div
            style={{
              width: compact ? 44 : 56,
              height: compact ? 24 : 30,
              borderRadius: 999,
              background: localOn
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #6b7280, #4b5563)',
              boxShadow: localOn
                ? '0 0 8px rgba(34,197,94,0.4), inset 0 1px 2px rgba(0,0,0,0.15)'
                : 'inset 0 1px 3px rgba(0,0,0,0.25)',
              position: 'relative',
              transition: 'background 0.2s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: compact ? 3 : 4,
                left: localOn ? (compact ? 23 : 29) : (compact ? 3 : 4),
                width: compact ? 18 : 22,
                height: compact ? 18 : 22,
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                transition: 'left 0.18s ease',
              }}
            />
          </div>
          <ToggleDefaultBookmarks marks={marks} compact={compact} />
        </button>
      </div>
      <div className="text-gray-400 dark:text-gray-500 font-medium tracking-wide">
        {localOn ? 'ON' : 'OFF'}
      </div>
    </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['switch'],
  ContentSection: SwitchContentSection,
});
