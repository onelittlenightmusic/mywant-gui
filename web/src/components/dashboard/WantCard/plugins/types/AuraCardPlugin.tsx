import React, { useState, useEffect } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../../CardFrame';
import { useCharacterStore } from '@/stores/characterStore';
import { postWantWebhook } from '@/utils/wantWebhook';
import { Sparkles } from 'lucide-react';

const AuraContentSection: React.FC<WantCardPluginProps> = ({
  want, isInnerFocused, onExitInnerFocus,
}) => {
  const characters = useCharacterStore(s => s.characters);
  const charId = (want.spec?.params?.characters as string[] | undefined)?.[0]
    ?? (want.state?.current?.characters as string[] | undefined)?.[0];
  const character = charId ? characters.find(c => c.id === charId) : undefined;
  const color = character?.color ?? '#a855f7';

  const cells = want.state?.current?.cells as Array<{ colors?: string[] }> | undefined;
  const cellCount = Array.isArray(cells) ? cells.length : 0;

  const serverActive = want.state?.current?.active === true;
  const [active, setActive] = useState(serverActive);
  const [pending, setPending] = useState(false);
  useEffect(() => { setActive(serverActive); }, [serverActive]);

  const handleToggleActive = async () => {
    if (pending) return;
    const next = !active;
    setActive(next);
    setPending(true);
    const id = want.metadata?.id;
    if (!id) { setPending(false); return; }
    const ok = await postWantWebhook(id, { action: next ? 'activate' : 'deactivate' }, 'AuraCard');
    if (!ok) setActive(!next);
    setPending(false);
  };

  // Gamepad/keyboard inner focus: A/Enter/Space→toggle active, B/Escape→exit
  useInputActions({
    enabled: !!isInnerFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onConfirm: handleToggleActive,
    onCancel: onExitInnerFocus,
  });

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          className={active ? 'aura-cell-active' : undefined}
          color={color}
          round
          icon={character?.avatar
            ? <span className="text-[1.8em] leading-none">{character.avatar}</span>
            : <Sparkles className="w-[2em] h-[2em]" style={{ color }} />}
          style={active ? ({ '--aura-glow-color': color } as React.CSSProperties) : undefined}
        />
      }
    >
      <CardFrameTitle>
        <span className="tabular-nums" style={{ color }}>{cellCount}</span>
        <span className="text-gray-500 dark:text-gray-400"> マス</span>
      </CardFrameTitle>
      <CardFrameNote>{active ? '描画中' : '停止中'}</CardFrameNote>

      {/* The one control, kept in the detail half so the eyecatch stays a
          picture of the aura rather than a picture with a switch on it. */}
      <div
        className={`mt-1 w-fit ${isInnerFocused ? 'ring-2 ring-sky-400 ring-offset-1 rounded-full' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleActive(); }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={pending}
          className="relative focus:outline-none"
          aria-label="Aura active"
          style={{ opacity: pending ? 0.7 : 1 }}
        >
          <div
            style={{
              width: 30, height: 16,
              borderRadius: 999,
              background: active ? color : 'rgba(120,120,120,0.4)',
              position: 'relative',
              transition: 'background 0.2s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: active ? 16 : 2,
                width: 12, height: 12,
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'left 0.18s ease',
              }}
            />
          </div>
        </button>
      </div>
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['aura'],
  ContentSection: AuraContentSection,
});
