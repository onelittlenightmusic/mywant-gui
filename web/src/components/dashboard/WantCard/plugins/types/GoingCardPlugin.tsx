import React, { useState, useEffect } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import { ToggleDefaultBookmarks } from '@/components/common/ToggleDefaultBookmarks';
import { useCharacterStore } from '@/stores/characterStore';
import { useWantStore } from '@/stores/wantStore';
import { auraMarkFor, AuraMark } from '@/types/character';

const GoingContentSection: React.FC<WantCardPluginProps> = ({
  want, isChild, isControl, isFocused, isInnerFocused, onExitInnerFocus,
}) => {
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  /**
   * Whether I am going — read from my own character, which is where the flag
   * lives (see the engine's character_motion want).
   *
   * This card used to read `going` off the going want itself, a field that want
   * has never had: a going want is an instruction, not a state, and the flag it
   * sets belongs to each character it is aimed at. So the toggle could only ever
   * show its own last press, and said STOPPED again the moment the card was
   * redrawn from the server.
   */
  const serverGoing = useWantStore(s => s.wants.some(w =>
    (w.metadata?.id) === `motion-${myCharacterId}` && w.state?.current?.going === true,
  ));

  const [localGoing, setLocalGoing] = useState(serverGoing);
  const [pending, setPending] = useState(false);

  useEffect(() => { setLocalGoing(serverGoing); }, [serverGoing]);

  // Aura-default marking: x/X marks the currently-shown state (on/off) as *my*
  // character's default for this toggle — shown as an aura-colored star at the
  // on- or off-knob position (whichever was marked), regardless of which state
  // the toggle is currently showing, so on- and off-marks stay visually
  // distinguishable. See ChoiceCardPlugin for the original (per-list-item)
  // version of this feature.
  const wantId = want.metadata?.id;
  const currentValueStr = String(localGoing);
  const characters = useCharacterStore(s => s.characters);
  const setAuraDefault = useCharacterStore(s => s.setAuraDefault);
  const wantType = want.metadata?.type;
  const marks = characters
    .map(c => ({ color: c.color, mark: auraMarkFor(c, wantType, 'current', 'going') }))
    .filter((m): m is { color: string; mark: AuraMark } => m.mark !== undefined)
    .map(({ color, mark }) => ({ color, value: mark.value === 'true' }));
  const handleMarkDefault = () => {
    if (!wantId || !wantType || !myCharacterId) return;
    const mine = characters.find(c => c.id === myCharacterId);
    const marked = mine ? auraMarkFor(mine, wantType, 'current', 'going') : undefined;
    const next = marked?.value === currentValueStr ? '' : currentValueStr;
    setAuraDefault(wantId, wantType, 'current', 'going', next);
  };

  const handleToggle = async () => {
    if (pending) return;
    const next = !localGoing;
    setLocalGoing(next);
    setPending(true);

    const id = want.metadata?.id;
    if (!id) { setPending(false); return; }
    try {
      // Naming the presser is what makes this work at all: a going want is an
      // instruction aimed at characters, and one that names nobody falls back
      // to the want's own target list — empty for a want nobody is standing on,
      // so the toggle applied to nobody and the character never moved. The same
      // payload a footstep queues, which is the point (see going_types.go).
      await fetch(`/api/v1/webhooks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: next ? 'going' : 'stopped',
          character_id: myCharacterId,
        }),
      });
    } catch (err) {
      console.error('[GoingCard] toggle failed:', err);
      setLocalGoing(!next);
    } finally {
      setPending(false);
    }
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
          aria-label="Going"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <div
            style={{
              width: compact ? 44 : 56,
              height: compact ? 24 : 30,
              borderRadius: 999,
              background: localGoing
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'linear-gradient(135deg, #6b7280, #4b5563)',
              boxShadow: localGoing
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
                left: localGoing ? (compact ? 23 : 29) : (compact ? 3 : 4),
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
        {localGoing ? 'GOING' : 'STOPPED'}
      </div>
    </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['going'],
  ContentSection: GoingContentSection,
});
