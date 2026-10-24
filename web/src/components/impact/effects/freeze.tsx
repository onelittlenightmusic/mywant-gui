import React from 'react';
import { CENTRE, centred, neon, type ImpactEffect } from '../effect';

/**
 * A freeze: a big neon yellow clock popping up, its hand spinning round and
 * stopping dead, a shock ring behind it as it stops.
 */
const YELLOW = '#ffe500';
/** The hands, dark on the yellow face: read at a glance, even on a yellow-lit board. */
const HANDS = '#3a2a00';

export const freezeImpact: ImpactEffect = {
  motions: [
    // The clock: pops up, stays while its hand stops, and fades.
    {
      keyframes: [
        { transform: `${CENTRE} scale(0.3)`, opacity: 0 },
        { transform: `${CENTRE} scale(1.18)`, opacity: 1, offset: 0.12 },
        { transform: `${CENTRE} scale(1)`, opacity: 1, offset: 0.22 },
        { transform: `${CENTRE} scale(1)`, opacity: 1, offset: 0.82 },
        { transform: `${CENTRE} scale(0.9)`, opacity: 0 },
      ],
      options: { duration: 1400, easing: 'ease-out', fill: 'forwards' },
      sound: 'impactFreeze',
    },
    // Its hand: round fast, and stopped dead — a jolt where it catches, the
    // moment the sound's clunk lands.
    {
      keyframes: [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(320deg)', offset: 0.14 },
        { transform: 'rotate(312deg)', offset: 0.17 },
        { transform: 'rotate(316deg)', offset: 0.2 },
        { transform: 'rotate(316deg)' },
      ],
      options: { duration: 1400, easing: 'ease-out', fill: 'forwards' },
    },
    // The shock ring.
    {
      keyframes: [
        { transform: `${CENTRE} scale(0.5)`, opacity: 0 },
        { transform: `${CENTRE} scale(0.6)`, opacity: 1, offset: 0.2 },
        { transform: `${CENTRE} scale(1.9)`, opacity: 0 },
      ],
      options: { duration: 900, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    },
  ],
  Draw: ({ at, ink }) => {
    const yellow = ink(YELLOW), hands = ink(HANDS);
    return (
      <>
        <div ref={at(2)} style={{
          ...centred('150%'), borderRadius: '50%',
          border: `5px solid ${yellow}`, boxShadow: neon(yellow, 16),
        }} />
        <div ref={at(0)} style={{ ...centred('130%'), filter: `drop-shadow(0 0 10px ${yellow}) drop-shadow(0 0 24px ${yellow})` }}>
          <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={yellow} strokeWidth={2.4} strokeLinecap="round">
            <circle cx="12" cy="12" r="9.5" fill={`${yellow}e6`} />
            <line x1="12" y1="1" x2="12" y2="2.5" />
            <g stroke={hands}>
              <line x1="12" y1="12" x2="15.5" y2="12" />
              <line ref={at(1)} x1="12" y1="12" x2="12" y2="5.5"
                style={{ transformBox: 'view-box', transformOrigin: '12px 12px' }} />
              <circle cx="12" cy="12" r="1" fill={hands} />
            </g>
          </svg>
        </div>
      </>
    );
  },
};
