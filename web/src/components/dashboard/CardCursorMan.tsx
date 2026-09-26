import React from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { CursorManIcon } from '@/components/dashboard/CursorManIcon';
import { useCharacterStore } from '@/stores/characterStore';

interface CardCursorManProps {
  visible: boolean;
}

export const CardCursorMan: React.FC<CardCursorManProps> = ({ visible }) => {
  const isDarkMode = useDarkMode();
  const myCharacter = useCharacterStore(s => s.getMyCharacter());
  const myDefaultColor = useCharacterStore(s => s.myDefaultCursorColor);

  if (!visible) return null;

  // Pointer arrow color: character color or default dark/light
  const arrowColor = myCharacter
    ? myCharacter.color
    : (isDarkMode ? myDefaultColor : myDefaultColor);

  // Shadow color: character color or black
  const shadowColor = myCharacter ? myCharacter.color + '66' : 'rgba(0,0,0,0.45)';

  return (
    <div
      // Named so the "open details" offer can sit beside it, the way that offer
      // sits beside the CursorMan on the canvas. Only the focused card renders
      // one, so a document-wide lookup finds exactly the right character.
      data-card-cursorman="true"
      className="absolute z-[100] pointer-events-none flex flex-col items-center"
      style={{ top: '-10px', left: '10px', filter: `drop-shadow(0 4px 12px ${shadowColor})` }}
    >
      <CursorManIcon size={42} />
      <div style={{
        width: 0, height: 0,
        marginTop: '2px',
        borderLeft: '9px solid transparent',
        borderRight: '9px solid transparent',
        borderTop: myCharacter
          ? `11px solid ${arrowColor}`
          : `11px solid ${isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)'}`,
      }} />
      <div style={{
        width: '18px', height: '5px',
        borderRadius: '50%',
        marginTop: '2px',
        background: myCharacter
          ? myCharacter.color + '44'
          : (isDarkMode ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.20)'),
        filter: 'blur(4px)',
      }} />
    </div>
  );
};
