import React from 'react';
import { CX, CY, R_FACE } from '@/components/forms/timerUtils';

/**
 * A clock showing one time — the timer's clock face (TimerClockFace) as a
 * picture: the same dial, nothing to press, both hands where the time puts
 * them. Fills its box.
 */
export const ClockDial: React.FC<{
  h: number;
  m: number;
  /** The hands' and the rim's colour. */
  ink: string;
  isLight: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({ h, m, ink, isLight, className, style }) => {
  const at = (turns: number, r: number) => {
    const a = turns * 2 * Math.PI - Math.PI / 2;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  };
  const hour = at(((h % 12) + m / 60) / 12, R_FACE * 0.5);
  const minute = at(m / 60, R_FACE * 0.78);
  const face = isLight ? '#ffffff' : '#0f172a';
  const tick = isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.55)';
  return (
    <svg viewBox="0 0 140 140" className={className} style={style} aria-hidden>
      {/* Lit from the upper left, like everything standing on the board. */}
      <defs>
        <radialGradient id="clockdial-lit" cx="34%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#fff" stopOpacity={isLight ? 0.6 : 0.18} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={R_FACE + 6} fill={face} stroke={ink} strokeWidth="5" />
      <circle cx={CX} cy={CY} r={R_FACE + 6} fill="url(#clockdial-lit)" />
      {Array.from({ length: 12 }, (_, i) => {
        const outer = at(i / 12, R_FACE - 1);
        const inner = at(i / 12, R_FACE - (i % 3 === 0 ? 11 : 6));
        return (
          <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke={tick} strokeWidth={i % 3 === 0 ? 4 : 2.5} strokeLinecap="round" />
        );
      })}
      <line x1={CX} y1={CY} x2={hour.x} y2={hour.y} stroke={ink} strokeWidth="8" strokeLinecap="round" />
      <line x1={CX} y1={CY} x2={minute.x} y2={minute.y} stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="6" fill={ink} />
    </svg>
  );
};
