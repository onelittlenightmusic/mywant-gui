import type React from 'react';
import type { ImpactMoment } from '@/stores/impactStore';
import type { Motion } from '@/utils/motion';

/**
 * One look of something landing on a want (effects/): what it draws, and how
 * each part of it moves — its sound on the first. The framework (WantImpact)
 * only runs them: it knows no look, no colour, no timing of its own.
 */
export interface ImpactEffect {
  /** One per part, by index: `at(i)` in Draw is the element motions[i] moves. */
  motions: Motion[];
  Draw: React.FC<ImpactDrawProps>;
}

export interface ImpactDrawProps {
  m: ImpactMoment;
  /** The ref for part i — the element motions[i] moves. */
  at: (i: number) => (el: Element | null) => void;
  /**
   * Every colour the look draws, passed through what it is drawn on: the
   * board's ink there (its tiers), unchanged elsewhere. A plain hex comes back,
   * for the look to add its own alpha to.
   */
  ink: (color: string) => string;
}

/** Centred on the want; every centred part's transform starts with it. */
export const CENTRE = 'translate(-50%, -50%)';

/**
 * A centred square part, sized off the want's height — so a wide card and a
 * square tile burst alike — and hidden until its motion shows it.
 */
export const centred = (size: string): React.CSSProperties => ({
  position: 'absolute', left: '50%', top: '50%', height: size, aspectRatio: '1',
  transform: `${CENTRE} scale(0)`, opacity: 0,
});

/**
 * A neon glow: a tight one and a wide one in the same colour. An impact is
 * the loudest thing on the screen for the moment it lasts — louder than
 * anything that stays — so what lands is seen landing from across the board.
 */
export const neon = (c: string, r: number) => `0 0 ${r}px ${c}, 0 0 ${r * 2.2}px ${c}`;
