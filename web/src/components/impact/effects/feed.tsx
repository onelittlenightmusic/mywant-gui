import React from 'react';
import { CENTRE, centred, neon, type ImpactEffect } from '../effect';
import type { Motion } from '@/utils/motion';

/**
 * A value handed on, landing: neon cyan ripples spreading from the want, one
 * after another, and the value itself popping up over it.
 */
const CYAN = '#22e6ff';
/** The value, dark on its cyan pill. */
const TEXT = '#032b33';

const ripple = (delay: number): Motion => ({
  keyframes: [
    { transform: `${CENTRE} scale(0.3)`, opacity: 0 },
    { transform: `${CENTRE} scale(0.45)`, opacity: 1, offset: 0.12 },
    { transform: `${CENTRE} scale(1.9)`, opacity: 0 },
  ],
  options: { duration: 820, delay, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'both' },
});

export const feedImpact: ImpactEffect = {
  motions: [
    { ...ripple(0), sound: 'impactFeed' },
    ripple(140),
    ripple(280),
    // The value: popping up over the want, rising a little, fading.
    {
      keyframes: [
        { transform: 'translate(-50%, 20%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%, -10%) scale(1.12)', opacity: 1, offset: 0.14 },
        { transform: 'translate(-50%, -10%) scale(1)', opacity: 1, offset: 0.24 },
        { transform: 'translate(-50%, -40%) scale(1)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%, -60%) scale(0.96)', opacity: 0 },
      ],
      options: { duration: 1300, easing: 'ease-out', fill: 'forwards' },
    },
  ],
  Draw: ({ m, at, ink }) => {
    const cyan = ink(CYAN), text = ink(TEXT);
    return (
      <>
        {[0, 1, 2].map(i => (
          <div key={i} ref={at(i)} style={{
            ...centred('120%'), borderRadius: '50%',
            border: `${5 - i}px solid ${cyan}`, boxShadow: `${neon(cyan, 12)}, inset 0 0 8px ${cyan}`,
          }} />
        ))}
        {m.value && (
          <div ref={at(3)} style={{
            position: 'absolute', left: '50%', bottom: '100%', opacity: 0,
            transform: 'translate(-50%, 20%) scale(0.4)', transformOrigin: '50% 100%',
            // Sized off the want it lands on (WantImpact is a size container), within reason.
            fontSize: 'clamp(11px, 24cqh, 30px)', fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap',
            padding: '0.25em 0.7em', borderRadius: '999px',
            color: text, background: cyan, boxShadow: neon(cyan, 14),
          }}>
            {m.value}
          </div>
        )}
      </>
    );
  },
};
