/**
 * The waveforms themselves — how each sound is made, and nothing about when.
 *
 * Split from sounds.ts so the catalogue beside it can be read as a list. These
 * are pure builders: given a running AudioContext they schedule their notes and
 * return. Which gesture plays which one lives in soundCatalog.ts; whether
 * anything plays at all lives in sounds.ts.
 *
 * ── The concept: a box garden (箱庭) ─────────────────────────────────────────
 *
 * Everything is a small hard thing — a pebble — and every action is one pebble
 * touching the floor of the box, faintly. One action, one tap. No pairs, no
 * runs, no chords, no thud of the floor, no room around it: those all made a
 * tap into a gesture, and a gesture is not a pebble.
 *
 * So the only thing that tells the actions apart is the size of the stone —
 * its pitch, each action a little different from the next (PITCH, below). The
 * taps are cut above ~2.4kHz and gone in under 20ms.
 *
 * Walking is the one exception, and only in its top end: it is the same pebble,
 * with the brightness left on, so a step is never mistaken for a deed.
 *
 * No two taps are identical: each is nudged a little in pitch and loudness, the
 * way two real pebbles never land the same, so a sound heard on every step does
 * not turn into a machine.
 */

/**
 * Every tap's stone, smallest number = biggest stone. Neighbours sit about a
 * semitone apart: close enough to be one family, far enough to tell apart.
 */
export const PITCH = {
  bump: 500,
  press: 530,
  place: 560,
  drop: 590,
  land: 620,
  close: 650,
  out: 680,
  dismiss: 710,
  open: 740,
  in: 780,
  suggest: 820,
  confirm: 860,
  connect: 900,
  flick: 940,
  tick: 980,
  done: 1020,
  // Underfoot: the same stone, a size smaller, with its brightness left on.
  step: 1250,
  roll: 1150,
} as const;

// ── The floor ─────────────────────────────────────────────────────────────────

interface Buses {
  /** Pebbles: everything above the floor's register is cut. */
  floor: AudioNode;
  /** Footsteps: straight out, top end on. */
  bright: AudioNode;
}

const _buses = new WeakMap<BaseAudioContext, Buses>();

function buses(c: BaseAudioContext): Buses {
  const have = _buses.get(c);
  if (have) return have;
  const floor = c.createBiquadFilter();
  floor.type = 'lowpass';
  floor.frequency.value = 2400;
  floor.Q.value = 0.5;
  floor.connect(c.destination);
  const b = { floor, bright: c.destination };
  _buses.set(c, b);
  return b;
}

/** A small random nudge: 1 ± spread/2. */
function jitter(spread: number): number {
  return 1 + (Math.random() - 0.5) * spread;
}

// ── The one primitive ─────────────────────────────────────────────────────────

export interface PebbleOpts {
  /** The stone's size, as pitch — one of PITCH. */
  freq: number;
  /** Seconds from now. Only the few sounds that are a rhythm use it. */
  at?: number;
  /** Loudness. Faint: 0.08–0.2. */
  amp?: number;
  /** Footsteps only: leave the top end on. */
  bright?: boolean;
}

/**
 * One pebble touching the floor of the box.
 *
 * Three sine modes at the non-integer ratios of a small stiff body (a bell or
 * a string would sit on whole multiples), struck with no attack at all; the
 * upper ones die first, the lowest is gone in ~15ms. A 2ms grain of noise on
 * top is the contact itself — what makes it hard rather than plucked.
 */
export function pebble(c: AudioContext, o: PebbleOpts): void {
  const out = o.bright ? buses(c).bright : buses(c).floor;
  const t = c.currentTime + (o.at ?? 0);
  const freq = o.freq * jitter(0.04);
  const amp = (o.amp ?? 0.14) * jitter(0.25);

  const modes: [ratio: number, gain: number, decay: number][] = [
    [1, 1, 0.015],
    [2.76, 0.5, 0.009],
    [5.4, 0.3, 0.005],
  ];
  for (const [ratio, g0, decay] of modes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    g.gain.setValueAtTime(amp * g0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + decay + 0.003);
  }

  const frames = Math.max(1, Math.floor(c.sampleRate * 0.002));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const ng = c.createGain();
  ng.gain.value = amp * 0.5;
  src.connect(ng); ng.connect(out);
  src.start(t);
}

/** One tap of the given stone — what nearly every sound here is. */
export const tap = (freq: number, amp?: number) =>
  (c: AudioContext) => pebble(c, { freq, amp });

// ── The sounds ────────────────────────────────────────────────────────────────

export const gridMove = tap(PITCH.tick, 0.1);
export const wantPlaced = tap(PITCH.place, 0.18);
export const buttonPress = tap(PITCH.press, 0.18);
export const hapticClick = tap(PITCH.tick, 0.07);
export const handoverIn = tap(PITCH.in, 0.14);
export const handoverOut = tap(PITCH.out, 0.13);
export const confirmIn = tap(PITCH.confirm, 0.16);
export const sparkle = tap(PITCH.done, 0.14);
export const chime = tap(PITCH.done, 0.16);
export const pillExpand = tap(PITCH.open, 0.1);
export const pillShrink = tap(PITCH.close, 0.1);

/**
 * A card opening or closing. ('whoosh' is the old name, kept because the
 * callers know it by that.)
 */
export function whoosh(c: AudioContext, direction: 'up' | 'down'): void {
  pebble(c, { freq: direction === 'up' ? PITCH.open : PITCH.close, amp: 0.13 });
}

/**
 * A coding agent hands the turn back. For somebody not looking at the screen,
 * so it is the one sound allowed a rhythm — three taps of the same stone,
 * a gap before the last — and the loudest; each tap is still just a pebble.
 */
export function ring(c: AudioContext): void {
  pebble(c, { freq: PITCH.done, amp: 0.3 });
  pebble(c, { freq: PITCH.done, at: 0.13, amp: 0.28 });
  pebble(c, { freq: PITCH.done, at: 0.34, amp: 0.32 });
}
