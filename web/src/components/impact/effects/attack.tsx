import React from 'react';
import { CENTRE, centred, neon, type ImpactEffect } from '../effect';

/**
 * An attack's hit: a neon red burst of fire, white-hot inside, well past the
 * want — a ring racing ahead of it, and the want lit for an instant.
 */
const RED = '#ff1f4b';
const FLAME = '#fff700';
const WHITE_HOT = '#ffffff';

export const attackImpact: ImpactEffect = {
  motions: [
    // The fire: bursting, and burning out.
    {
      keyframes: [
        { transform: `${CENTRE} scale(0.1)`, opacity: 1 },
        { transform: `${CENTRE} scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `${CENTRE} scale(1.35)`, opacity: 0.85, offset: 0.6 },
        { transform: `${CENTRE} scale(1.55)`, opacity: 0 },
      ],
      options: { duration: 620, easing: 'cubic-bezier(0.1, 0.85, 0.3, 1)', fill: 'forwards' },
      sound: 'impactAttack',
    },
    // The blast's ring, ahead of the fire.
    {
      keyframes: [
        { transform: `${CENTRE} scale(0.25)`, opacity: 1 },
        { transform: `${CENTRE} scale(1.4)`, opacity: 0.9, offset: 0.5 },
        { transform: `${CENTRE} scale(2.1)`, opacity: 0 },
      ],
      options: { duration: 560, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    },
    // The flash.
    {
      keyframes: [{ opacity: 0.95 }, { opacity: 0 }],
      options: { duration: 220, easing: 'ease-out', fill: 'forwards' },
    },
  ],
  Draw: ({ at, ink }) => {
    const red = ink(RED), flame = ink(FLAME), hot = ink(WHITE_HOT);
    return (
      <>
        <div ref={at(0)} style={{
          ...centred('210%'), borderRadius: '50%',
          background: `radial-gradient(circle, ${hot} 0%, ${flame} 16%, ${flame} 24%, ${red} 42%, ${red}e6 56%, ${red}00 70%)`,
          filter: `drop-shadow(0 0 18px ${red}) saturate(1.4)`,
        }} />
        <div ref={at(1)} style={{
          ...centred('140%'), borderRadius: '50%',
          border: `6px solid ${flame}`, boxShadow: `${neon(red, 14)}, inset 0 0 10px ${red}`,
        }} />
        <div ref={at(2)} style={{
          position: 'absolute', inset: 0, borderRadius: '14%', opacity: 0,
          background: `${flame}aa`, boxShadow: neon(red, 22),
        }} />
      </>
    );
  },
};
