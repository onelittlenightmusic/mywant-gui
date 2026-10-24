/**
 * Something landing on a want — an attack's hit, a mend, a freeze — drawn
 * over whatever shows that want (its tile on the board, its card in the
 * list), with its sound.
 *
 * The moments come from impactStore: the acting want's `impact` field, turned
 * round to the want it acted on. Each one is drawn once, over the box this is
 * put in (it fills its positioned parent unless `style` places it), and goes
 * when its motion is over. Three looks:
 *
 *   attack — a neon red burst of fire, white-hot inside, well past the want, a ring ahead of it
 *   mend   — a neon green blur closing round the want and fading
 *   freeze — a big neon yellow clock popping up, its hand spinning and stopping dead
 *
 * Every motion is a utils/motion Motion, its sound part of it; the sound is
 * made by the first drawing of the moment (claimImpactSound).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { subscribeImpacts, claimImpactSound, type ImpactKind, type ImpactMoment } from '@/stores/impactStore';
import { playMotion, type Motion } from '@/utils/motion';

export type ImpactColors = Record<ImpactKind, string> & { core: string };

/**
 * Neon: an impact is the loudest thing on the screen for the moment it lasts,
 * louder than anything that stays — what lands has to be seen landing from
 * across the board. The board hands in its own, through its ink.
 */
export const DEFAULT_IMPACT_COLORS: ImpactColors = {
  attack: '#ff1f4b',
  core: '#fff700',
  mend: '#2bff88',
  freeze: '#ffe500',
};

const CENTRE = 'translate(-50%, -50%)';

/** The stopped clock's hands, dark on its yellow face. */
const CLOCK_HANDS = '#3a2a00';

/** Each look, as its parts: what is drawn, and how each moves. The first part carries the sound. */
const MOTIONS: Record<ImpactKind, Motion[]> = {
  attack: [
    // The fire: white-hot in the middle, yellow, then red to its edge —
    // bursting well past the want, and burning out.
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
    // The blast's ring, racing ahead of the fire.
    {
      keyframes: [
        { transform: `${CENTRE} scale(0.25)`, opacity: 1 },
        { transform: `${CENTRE} scale(1.4)`, opacity: 0.9, offset: 0.5 },
        { transform: `${CENTRE} scale(2.1)`, opacity: 0 },
      ],
      options: { duration: 560, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    },
    // The flash: the whole want lit for an instant.
    {
      keyframes: [
        { opacity: 0.95 },
        { opacity: 0 },
      ],
      options: { duration: 220, easing: 'ease-out', fill: 'forwards' },
    },
  ],
  mend: [
    // The blur: closing in round the want, bright, and fading.
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
    // The glow inside it, welling up.
    {
      keyframes: [
        { opacity: 0 },
        { opacity: 0.75, offset: 0.35 },
        { opacity: 0 },
      ],
      options: { duration: 950, easing: 'ease-out', fill: 'forwards' },
    },
  ],
  freeze: [
    // The clock: pops up big, stays while its hand stops, and fades.
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
    // A yellow shock ring behind it as it stops.
    {
      keyframes: [
        { transform: `${CENTRE} scale(0.5)`, opacity: 0 },
        { transform: `${CENTRE} scale(0.6)`, opacity: 1, offset: 0.2 },
        { transform: `${CENTRE} scale(1.9)`, opacity: 0 },
      ],
      options: { duration: 900, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    },
  ],
};

/** One moment, drawn until its motion is over. */
const Burst: React.FC<{ m: ImpactMoment; colors: ImpactColors; onDone: () => void }> = ({ m, colors, onDone }) => {
  const parts = useRef<Array<Element | null>>([]);
  const done = useRef(onDone);
  done.current = onDone;
  const me = useRef({});

  useLayoutEffect(() => {
    const motions = MOTIONS[m.kind];
    const silent = !claimImpactSound(m, me.current);
    const played = motions.map((mo, i) => playMotion(parts.current[i], mo, { silent: silent || i > 0 }));
    // Reduced motion: nothing to watch, so it is gone with its sound.
    const longest = Math.max(...motions.map(mo => mo.options.duration));
    const t = setTimeout(() => done.current(), played.some(p => p.animation) ? longest + 40 : 0);
    return () => { clearTimeout(t); played.forEach(p => p.cancel()); };
  }, [m]);

  const at = (i: number) => (el: Element | null) => { parts.current[i] = el; };
  // Sized off the want's height, so a wide card and a square tile burst alike.
  const middle = (size: string): React.CSSProperties => ({
    position: 'absolute', left: '50%', top: '50%', height: size, aspectRatio: '1',
    transform: `${CENTRE} scale(0)`, opacity: 0,
  });
  const neon = (c: string, r: number) => `0 0 ${r}px ${c}, 0 0 ${r * 2.2}px ${c}`;

  if (m.kind === 'attack') {
    const { attack: red, core } = colors;
    return (
      <>
        <div ref={at(0)} style={{
          ...middle('210%'), borderRadius: '50%',
          background: `radial-gradient(circle, #ffffff 0%, ${core} 16%, ${core} 24%, ${red} 42%, ${red}e6 56%, ${red}00 70%)`,
          filter: `drop-shadow(0 0 18px ${red}) saturate(1.4)`,
        }} />
        <div ref={at(1)} style={{
          ...middle('140%'), borderRadius: '50%',
          border: `6px solid ${core}`, boxShadow: `${neon(red, 14)}, inset ${neon(red, 10).split(', ')[0]}`,
        }} />
        <div ref={at(2)} style={{
          position: 'absolute', inset: 0, borderRadius: '14%', opacity: 0,
          background: `${core}aa`, boxShadow: neon(red, 22),
        }} />
      </>
    );
  }
  if (m.kind === 'mend') {
    const green = colors.mend;
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
  }
  // A stopped clock.
  const yellow = colors.freeze;
  return (
    <>
      <div ref={at(2)} style={{
        ...middle('150%'), borderRadius: '50%',
        border: `5px solid ${yellow}`, boxShadow: neon(yellow, 16),
      }} />
      <div ref={at(0)} style={{ ...middle('130%'), filter: `drop-shadow(0 0 10px ${yellow}) drop-shadow(0 0 24px ${yellow})` }}>
        {/* A yellow face, its hands dark on it: read at a glance, even on a
            yellow-lit board. */}
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={yellow} strokeWidth={2.4} strokeLinecap="round">
          <circle cx="12" cy="12" r="9.5" fill={`${yellow}e6`} />
          <line x1="12" y1="1" x2="12" y2="2.5" />
          <g stroke={CLOCK_HANDS}>
            <line x1="12" y1="12" x2="15.5" y2="12" />
            <line ref={at(1)} x1="12" y1="12" x2="12" y2="5.5"
              style={{ transformBox: 'view-box', transformOrigin: '12px 12px' }} />
            <circle cx="12" cy="12" r="1" fill={CLOCK_HANDS} />
          </g>
        </svg>
      </div>
    </>
  );
};

interface Props {
  /** The want acted on, by name — what an `impact`'s `to` names. */
  wantName: string | undefined;
  colors?: ImpactColors;
  /** Where it is drawn; by default over the whole of its positioned parent. */
  style?: React.CSSProperties;
  /** Told while something is being drawn — for a parent that has to lift it over its neighbours. */
  onActive?: (active: boolean) => void;
}

export const WantImpact: React.FC<Props> = ({ wantName, colors = DEFAULT_IMPACT_COLORS, style, onActive }) => {
  const [moments, setMoments] = useState<ImpactMoment[]>([]);

  useEffect(() => {
    if (!wantName) return;
    // Only the newest few: a want under a storm of hits shows a storm, not a queue.
    return subscribeImpacts(wantName, m => setMoments(ms => [...ms.slice(-3), m]));
  }, [wantName]);

  const active = moments.length > 0;
  const told = useRef(onActive);
  told.current = onActive;
  useEffect(() => { told.current?.(active); }, [active]);

  if (!active) return null;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', ...style }}>
      {moments.map(m => (
        <Burst key={m.id} m={m} colors={colors}
          onDone={() => setMoments(ms => ms.filter(x => x.id !== m.id))} />
      ))}
    </div>
  );
};
