import React from 'react';

interface ProgressBarsProps {
  achievingPercentage: number;
}

/**
 * Horizontal battery indicator for the want card header.
 * Compact: body fills left-to-right, positive terminal nub on the right.
 * Colour: blue while charging → green at 100%.
 */
const BODY_H   = 7;   // body height (px)
const NUB_W    = 3;   // nub width  (px)
const NUB_H    = 4;   // nub height (px) — shorter than body, centred vertically

export const ProgressBars: React.FC<ProgressBarsProps> = ({ achievingPercentage }) => {
  const clamped  = Math.max(0, Math.min(100, achievingPercentage));
  const isFull   = clamped >= 100;

  const fillColor = isFull ? '#22c55e' : '#60a5fa';
  const fillGlow  = isFull
    ? '0 0 5px rgba(34,197,94,0.85)'
    : '0 0 4px rgba(96,165,250,0.75)';

  return (
    <div
      className="flex items-center flex-shrink-0 pointer-events-none select-none"
      title={`${clamped}%`}
    >
      {/* Battery body */}
      <div
        style={{
          /* mobile 28px, sm 36px — keep it compact */
          width: 'clamp(28px, 5vw, 36px)',
          height: BODY_H,
          border: '1.5px solid rgba(0,0,0,0.22)',
          borderRadius: '2px 0 0 2px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.06)',
          boxSizing: 'border-box',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {clamped > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${clamped}%`,
              backgroundColor: fillColor,
              boxShadow: fillGlow,
              transition: 'width 0.7s ease-out, background-color 0.5s ease',
            }}
          />
        )}
      </div>

      {/* Positive terminal nub — right side */}
      <div
        style={{
          width: NUB_W,
          height: NUB_H,
          background: 'rgba(0,0,0,0.28)',
          borderRadius: '0 2px 2px 0',
          flexShrink: 0,
        }}
      />
    </div>
  );
};
