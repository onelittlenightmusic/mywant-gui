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

/**
 * How loud a sound is — one of these, and nothing in between. A sound says
 * which kind of moment it is; how loud that kind is is said here, once, for
 * every sound there is. Picked one by one, the loudnesses had drifted apart
 * (a checklist's press four times the arrival around it), and fixing one sound
 * left the next as it was.
 */
export const VOLUME = {
  /** What comes with getting somewhere: a step, a panel coming up, a want's voice. */
  faint: 0.04,
  /** Moving among things: a focus step, a pill, a suggestion, a flick. */
  soft: 0.08,
  /** A deed: placing, pressing, connecting, going in and coming out. */
  firm: 0.14,
  /** The game moving on, or a blow landing in a battle. */
  loud: 0.22,
  /** Calling someone back to the screen. */
  alarm: 0.3,
} as const;
export type Volume = keyof typeof VOLUME;

/** All of it at once: every sound goes out through this. */
const MASTER_VOLUME = 1;

// ── The floor ─────────────────────────────────────────────────────────────────

interface Buses {
  /** Pebbles: everything above the floor's register is cut. */
  floor: AudioNode;
  /** Footsteps: straight out, top end on. */
  bright: AudioNode;
  /** Straight out, at the master volume — what the other two go into. */
  master: AudioNode;
}

const _buses = new WeakMap<BaseAudioContext, Buses>();

export function buses(c: BaseAudioContext): Buses {
  const have = _buses.get(c);
  if (have) return have;
  const master = c.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(c.destination);
  const floor = c.createBiquadFilter();
  floor.type = 'lowpass';
  floor.frequency.value = 2400;
  floor.Q.value = 0.5;
  floor.connect(master);
  const b = { floor, bright: master, master };
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
  /** How loud — one of VOLUME. */
  volume: Volume;
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
  const amp = VOLUME[o.volume] * jitter(0.25);

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
export const tap = (freq: number, volume: Volume) =>
  (c: AudioContext) => pebble(c, { freq, volume });

// ── The sounds ────────────────────────────────────────────────────────────────

export const gridMove = tap(PITCH.tick, 'soft');
export const wantPlaced = tap(PITCH.place, 'firm');
export const buttonPress = tap(PITCH.press, 'firm');
export const hapticClick = tap(PITCH.tick, 'soft');
export const handoverIn = tap(PITCH.in, 'firm');
export const handoverOut = tap(PITCH.out, 'firm');
export const confirmIn = tap(PITCH.confirm, 'firm');
export const sparkle = tap(PITCH.done, 'firm');
export const chime = tap(PITCH.done, 'firm');
export const pillExpand = tap(PITCH.open, 'soft');
export const pillShrink = tap(PITCH.close, 'soft');

/**
 * A card opening or closing. ('whoosh' is the old name, kept because the
 * callers know it by that.)
 */
export function whoosh(c: AudioContext, direction: 'up' | 'down'): void {
  pebble(c, { freq: direction === 'up' ? PITCH.open : PITCH.close, volume: 'firm' });
}

/**
 * A coding agent hands the turn back. For somebody not looking at the screen,
 * so it is the one sound allowed a rhythm — three taps of the same stone,
 * a gap before the last — and the loudest; each tap is still just a pebble.
 */
export function ring(c: AudioContext): void {
  pebble(c, { freq: PITCH.done, volume: 'alarm' });
  pebble(c, { freq: PITCH.done, at: 0.13, volume: 'alarm' });
  pebble(c, { freq: PITCH.done, at: 0.34, volume: 'alarm' });
}

// ── What lands on a want ─────────────────────────────────────────────────────
//
// The other exception: a connection's effect landing on a want — a hit, a
// mend, a freeze (the battle's impacts, components/impact). Each has to be
// told from the other two without looking, and from every tap above, so they
// keep a body a pebble does not: a puff, a glide, a tick that stops. Still
// faint, still through the floor, and each over in well under half a second.
//
// Each is as loud as one VOLUME; the numbers beside its layers are only how
// that loudness is shared among them — the mix, not the level.

/** A noise burst shaped by a filter: the body of a puff. */
function puff(c: AudioContext, out: AudioNode, t: number, o: {
  dur: number; amp: number; type: BiquadFilterType; from: number; to: number; q?: number;
}): void {
  const frames = Math.max(1, Math.floor(c.sampleRate * o.dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = o.type;
  f.Q.value = o.q ?? 0.8;
  f.frequency.setValueAtTime(o.from, t);
  f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.amp, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t); src.stop(t + o.dur + 0.01);
}

/** One sine, gliding from one pitch to another as it fades. */
function glide(c: AudioContext, out: AudioNode, t: number, from: number, to: number, dur: number, amp: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + dur + 0.01);
}

/**
 * A hit landing: a small fire bursting — a sharp crack of the contact, a puff
 * of fire that darkens as it spreads, and a thump under them. Pitched where a
 * laptop's speakers can say it: a thump alone sat below what they play and was
 * heard as nothing, so the body of the hit is in the crack and the puff, and
 * the thump starts high and falls. Past the floor's cut, unlike every tap, and
 * the loudest of the impacts: a hit has to be heard over the rest of a battle.
 */
export function impactAttack(c: AudioContext): void {
  const out = buses(c).master;
  const t = c.currentTime;
  const v = VOLUME.alarm * jitter(0.15);
  // The crack: bright, short.
  puff(c, out, t, { dur: 0.05, amp: 1.1 * v, type: 'bandpass', from: 3200, to: 1500, q: 1.4 });
  // The fire: a wide puff falling from bright to dark.
  puff(c, out, t + 0.01, { dur: 0.3, amp: v, type: 'lowpass', from: 4200, to: 380, q: 0.9 });
  // The thump, falling from where it is heard into where it is felt.
  glide(c, out, t, 260 * jitter(0.08), 70, 0.22, 1.2 * v);
}

/**
 * A value handed on, landing: a light "received" — two quick taps rising,
 * a bright glide under them, like a ticket gate letting you through.
 */
export function impactFeed(c: AudioContext): void {
  const out = buses(c).bright;
  const t = c.currentTime;
  pebble(c, { freq: PITCH.connect * 1.5, volume: 'firm', bright: true });
  pebble(c, { freq: PITCH.connect * 2, at: 0.07, volume: 'firm', bright: true });
  glide(c, out, t + 0.03, 1300 * jitter(0.03), 1950, 0.16, 0.4 * VOLUME.firm);
}

/**
 * A mend: a soft breath rising — a sine gliding up, a fifth above it a moment
 * later, under a faint airy hush. Nothing struck: it is something given.
 */
export function impactMend(c: AudioContext): void {
  const out = buses(c).floor;
  const t = c.currentTime;
  const base = 520 * jitter(0.04);
  const v = VOLUME.soft;
  glide(c, out, t, base, base * 1.5, 0.32, 1.1 * v);
  glide(c, out, t + 0.07, base * 1.5, base * 2, 0.3, 0.75 * v);
  puff(c, out, t, { dur: 0.34, amp: 0.45 * v, type: 'bandpass', from: 1400, to: 2300, q: 1.2 });
}

/**
 * A freeze: a clock that stops — two quick ticks, the second higher, then a
 * small dull clunk of the hand catching, and nothing after it.
 */
export function impactFreeze(c: AudioContext): void {
  const out = buses(c).floor;
  const t = c.currentTime;
  pebble(c, { freq: PITCH.tick * 1.6, volume: 'firm' });
  pebble(c, { freq: PITCH.tick * 1.8, at: 0.09, volume: 'firm' });
  glide(c, out, t + 0.2, 300, 220, 0.09, 1.15 * VOLUME.firm);
  puff(c, out, t + 0.2, { dur: 0.05, amp: 0.6 * VOLUME.firm, type: 'lowpass', from: 1200, to: 400 });
}
