import { playSound, type SoundEvent } from './sounds';

/**
 * An animation that can make a sound — the one way an element is animated
 * when what it shows has a sound of its own.
 *
 * A motion and its sound were two calls that had to be kept together by hand:
 * `el.animate(...)` here, `playSound(...)` at whichever moment the caller
 * guessed, and a reduced-motion check written again beside each. So a sound
 * drifted off the frame it belonged to (a burst heard before it was seen, or
 * after it had faded), and a user who asked for less motion lost the sound
 * along with the movement. Here the sound is part of the motion: said with
 * it, `soundAt` ms in — at the frame it belongs to — and heard even when the
 * movement is left out.
 */
export interface Motion {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions & { duration: number };
  /** What it sounds like (sounds.ts), if anything. */
  sound?: SoundEvent;
  /** When the sound lands, in ms after the motion starts. 0: with it. */
  soundAt?: number;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export interface PlayedMotion {
  /** The animation, or null when there was none to run (reduced motion, no element). */
  animation: Animation | null;
  /** Settles when it is over — finished or cancelled; at once with no animation. */
  done: Promise<void>;
  /** Stops it, and its sound if that has not been heard yet. */
  cancel: () => void;
}

/**
 * Run a motion on an element, with its sound. `silent` leaves the sound out —
 * for a second drawing of the same moment (the want in the list and on the
 * board), which should be seen twice and heard once.
 */
export function playMotion(el: Element | null, m: Motion, opts: { silent?: boolean } = {}): PlayedMotion {
  let timer: ReturnType<typeof setTimeout> | null = null;
  if (m.sound && !opts.silent) {
    const sound = m.sound;
    if (!m.soundAt) playSound(sound);
    else timer = setTimeout(() => { timer = null; playSound(sound); }, m.soundAt);
  }
  const still = !el || typeof (el as HTMLElement).animate !== 'function' || prefersReducedMotion();
  const animation = still ? null : el!.animate(m.keyframes, m.options);
  const done = animation
    ? new Promise<void>(resolve => {
        animation.addEventListener('finish', () => resolve());
        animation.addEventListener('cancel', () => resolve());
      })
    : Promise.resolve();
  return {
    animation,
    done,
    cancel: () => {
      if (timer) { clearTimeout(timer); timer = null; }
      animation?.cancel();
    },
  };
}
