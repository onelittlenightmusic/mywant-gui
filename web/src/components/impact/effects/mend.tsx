import React from 'react';
import { neon, type ImpactEffect } from '../effect';

/** A mend: a neon green blur closing in round the want, a glow welling up inside it, fading. */
const GREEN = '#2bff88';

export const mendImpact: ImpactEffect = {
  motions: [
    {
      keyframes: [
        { transform: 'scale(1.35)', opacity: 0 },
        { transform: 'scale(1.04)', opacity: 1, offset: 0.3 },
        { transform: 'scale(1)', opacity: 0.9, offset: 0.6 },
        { transform: 'scale(0.96)', opacity: 0 },
      ],
      options: { duration: 950, easing: 'ease-out', fill: 'forwards' },
      sound: 'impactMend',
    },
    {
      keyframes: [{ opacity: 0 }, { opacity: 0.75, offset: 0.35 }, { opacity: 0 }],
      options: { duration: 950, easing: 'ease-out', fill: 'forwards' },
    },
  ],
  Draw: ({ at, ink }) => {
    const green = ink(GREEN);
    return (
      <>
        <div ref={at(0)} style={{
          position: 'absolute', inset: '-22%', borderRadius: '28%', opacity: 0,
          border: `7px solid ${green}`,
          boxShadow: `${neon(green, 22)}, inset 0 0 28px 10px ${green}`,
          filter: 'blur(4px)',
        }} />
        <div ref={at(1)} style={{
          position: 'absolute', inset: '-8%', borderRadius: '24%', opacity: 0,
          background: `radial-gradient(circle, ${green}00 30%, ${green}99 70%, ${green}00 100%)`,
          filter: 'blur(6px)',
        }} />
      </>
    );
  },
};
