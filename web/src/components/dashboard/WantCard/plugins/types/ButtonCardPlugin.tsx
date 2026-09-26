import React, { useState, useEffect } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { useInputActions } from '@/hooks/useInputActions';
import { WantCardLayout } from '../../WantCardLayout';
import { postWantWebhook } from '@/utils/wantWebhook';
import { playSound } from '@/utils/sounds';

const ButtonContentSection: React.FC<WantCardPluginProps> = ({
  want, isChild, isControl, isFocused, isInnerFocused, onExitInnerFocus,
}) => {
  const pressedCount = typeof want.state?.current?.pressed_count === 'number'
    ? want.state.current.pressed_count : 0;
  const rawLabel = (want.state?.current?.label) || (want.spec?.params?.label);
  const label = typeof rawLabel === 'string' ? rawLabel : 'Push';

  const [isPressed, setIsPressed] = useState(false);
  const [localCount, setLocalCount] = useState(pressedCount);

  useEffect(() => { setLocalCount(prev => Math.max(prev, pressedCount)); }, [pressedCount]);

  const handlePress = async () => {
    if (isPressed) return;
    setIsPressed(true);
    setLocalCount(c => c + 1);
    playSound('buttonPress');
    setTimeout(() => setIsPressed(false), 150);

    const id = want.metadata?.id;
    if (!id) return;
    await postWantWebhook(id, { action: 'press' }, 'ButtonCard');
  };

  // Gamepad/keyboard inner focus: A/Enter→press, B/Escape→exit. Same
  // pattern SwitchCardPlugin's own toggle uses.
  useInputActions({
    enabled: !!isInnerFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onConfirm: handlePress,
    onCancel: onExitInnerFocus,
  });

  const compact = isChild || (isControl && !isFocused);
  const size = compact ? 44 : 54;
  const bezelPad = compact ? 4 : 6;

  return (
    <WantCardLayout
      centerContent
      content={
      <div
        className="flex flex-col items-center gap-1.5"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
      <div
        className={isInnerFocused ? 'ring-2 ring-sky-400 ring-offset-1 rounded-full' : undefined}
        style={{
          width: size + bezelPad * 2,
          height: size + bezelPad * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 45% 35%, #374151, #111827)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.06)',
          padding: bezelPad,
        }}
      >
        {/* Same glow the canvas tile's round button uses when sunk — see
            CanvasTileCard.tsx's own button-toggle-glow keyframes — so a
            press reads the same way here as it does on the board. */}
        {isPressed && (
          <style>{`
            @keyframes button-card-glow {
              0%, 100% { filter: drop-shadow(0 0 6px #ef4444) drop-shadow(0 0 14px #ef4444); }
              50% { filter: drop-shadow(0 0 11px #f87171) drop-shadow(0 0 24px #f87171); }
            }
          `}</style>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handlePress(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className={isPressed ? 'rounded-full font-semibold cursor-pointer select-none' : 'rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold cursor-pointer select-none'}
          style={{
            width: size,
            height: size,
            fontSize: compact ? 9 : 10,
            letterSpacing: '0.03em',
            background: isPressed ? '#dc2626' : undefined,
            color: isPressed ? '#fff' : undefined,
            boxShadow: isPressed
              ? 'inset 0 2px 4px rgba(0,0,0,0.18)'
              : '0 2px 0 rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
            transform: isPressed ? 'translateY(2px)' : 'translateY(0)',
            transition: 'transform 0.08s ease, box-shadow 0.08s ease, background 0.08s ease',
            animation: isPressed ? 'button-card-glow 1.4s ease-in-out infinite' : 'none',
          }}
        >
          {label}
        </button>
      </div>

      <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500 tabular-nums">
        <span>×</span>
        <span>{localCount}</span>
      </div>
    </div>
    }
    />
  );
};

registerWantCardPlugin({
  types: ['button'],
  ContentSection: ButtonContentSection,
});
