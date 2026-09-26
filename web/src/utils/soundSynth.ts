/**
 * The waveforms themselves — how each sound is made, and nothing about when.
 *
 * Split from sounds.ts so the catalogue beside it can be read as a list. These
 * are pure builders: given a running AudioContext they schedule their notes and
 * return. Which gesture plays which one lives in soundCatalog.ts; whether
 * anything plays at all lives in sounds.ts.
 */
// ── Sound synthesizers ────────────────────────────────────────────────────────
// Each function receives a guaranteed-running AudioContext.

/** Short tick — one grid step during keyboard drag */
export function gridMove(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1100, t);
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.055);
  gain.gain.setValueAtTime(0.13, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  osc.start(t);
  osc.stop(t + 0.06);
}

/** Pop/thud — want placed on the canvas */
export function wantPlaced(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  gain.gain.setValueAtTime(0.22, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  osc.start(t);
  osc.stop(t + 0.13);
  // Short click for crispness
  const osc2 = c.createOscillator();
  const gain2 = c.createGain();
  osc2.connect(gain2);
  gain2.connect(c.destination);
  osc2.type = 'square';
  osc2.frequency.value = 1200;
  gain2.gain.setValueAtTime(0.06, t);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  osc2.start(t);
  osc2.stop(t + 0.03);
}

/**
 * Whoosh — card open/close/maximize/minimize.
 * 'up'  : pitch sweeps low→high (open / maximize)
 * 'down': pitch sweeps high→low (close / minimize)
 */
export function whoosh(c: AudioContext, direction: 'up' | 'down'): void {
  const t = c.currentTime;
  const dur = 0.14;
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sawtooth';
  filter.type = 'bandpass';
  filter.Q.value = 4;
  const [f0, f1] = direction === 'up' ? [260, 900] : [900, 260];
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.10, t + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

/**
 * Sparkle chime — ascending bell arpeggio (キラーん).
 * Four sine-wave bell tones with harmonics, staggered 60ms apart.
 */
export function chime(c: AudioContext): void {
  const t = c.currentTime;
  const notes = [
    { freq: 880,  delay: 0.00, amp: 0.22, decay: 0.55 },
    { freq: 1047, delay: 0.06, amp: 0.20, decay: 0.50 },
    { freq: 1319, delay: 0.12, amp: 0.18, decay: 0.45 },
    { freq: 1760, delay: 0.18, amp: 0.16, decay: 0.65 },
  ];
  notes.forEach(({ freq, delay, amp, decay }) => {
    const start = t + delay;
    // Fundamental
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amp, start + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    osc.start(start); osc.stop(start + decay + 0.01);
    // 2nd harmonic shimmer
    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.connect(gain2); gain2.connect(c.destination);
    osc2.type = 'sine'; osc2.frequency.value = freq * 2;
    gain2.gain.setValueAtTime(0, start);
    gain2.gain.linearRampToValueAtTime(amp * 0.12, start + 0.004);
    gain2.gain.exponentialRampToValueAtTime(0.0001, start + decay * 0.4);
    osc2.start(start); osc2.stop(start + decay * 0.4 + 0.01);
  });
}

/**
 * A footstep pressing a button-form want (direction/going/gear) down into
 * its socket.
 *
 * cursorBump's own family — same two-oscillator thud shape, shorter and
 * pitched higher, on request — this is something giving way and hitting
 * bottom, not a step meeting something that holds its ground. No ring-out,
 * no sustain, over before the eye finishes registering the cap sinking: a
 * mechanical clunk, not a knock.
 */
export function buttonPress(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const osc2 = c.createOscillator();
  const gain2 = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc2.connect(gain2); gain2.connect(c.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(720, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.025);
  gain.gain.setValueAtTime(0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.start(t); osc.stop(t + 0.035);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(440, t);
  osc2.frequency.exponentialRampToValueAtTime(190, t + 0.02);
  gain2.gain.setValueAtTime(0.07, t);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
  osc2.start(t); osc2.stop(t + 0.025);
}

/**
 * Tactile-style click — audio substitute for haptic vibration on platforms
 * with no Vibration API (all iOS browsers, since Chrome/Firefox-on-iOS are
 * WebKit under the hood same as Safari — Apple never implements
 * navigator.vibrate there). See utils/haptic.ts's playHapticClick, which
 * pairs this with navigator.vibrate?.() so it's a no-op double-call on
 * platforms where real vibration works.
 */
export function hapticClick(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.04);
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.start(t);
  osc.stop(t + 0.05);
}

/**
 * Two soft descending notes — the keys just went into the detail panel.
 *
 * Paired with handoverOut below: this one is pitched and deliberate, that one
 * is a breath. Together they are the in and the out of the same move, and on a
 * gamepad the sound is the fastest report of which way the input just went.
 *
 * Not one of the whooshes. cardOpen/cardClose already mean "a card opened or
 * closed", which is a different event that can happen in the same beat — the
 * panel opening as you arrive on a card, say. Handing the keys over is about
 * where input is, not about what is on screen, so it says so in its own voice.
 */
export function handoverIn(c: AudioContext): void {
  const t = c.currentTime;
  // A falling second rather than a rising one, chosen by ear against the rest
  // of the set: rising read as "opened", which is the event this is NOT.
  const notes: [number, number][] = [[720, 0], [480, 0.06]];
  notes.forEach(([freq, delay]) => {
    const start = t + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.13, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.08);
  });
}

/**
 * A soft puff — the keys just came back out of the panel to the card grid.
 *
 * Noise through a lowpass that closes as it decays, so it reads as a breath out
 * rather than a note. Deliberately unpitched: coming back out is a release, and
 * the pitched pair above is what going in sounds like.
 *
 * This is the only sound in the app built from a buffer source, which is also
 * how the regression suite tells it apart from everything else — see the
 * page-tour case in e2e/input-pipeline.spec.mjs.
 */
export function handoverOut(c: AudioContext): void {
  const t = c.currentTime;
  const dur = 0.13;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  // Faded across the buffer as well as by the gain below — the taper is what
  // stops it ending on an audible edge.
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = c.createBufferSource();
  src.buffer = buffer;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1;
  lp.frequency.setValueAtTime(1800, t);
  lp.frequency.exponentialRampToValueAtTime(320, t + dur);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.30, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(lp);
  lp.connect(gain);
  gain.connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

/**
 * Three quick descending notes — a choice was taken, one level further in.
 *
 * Two things mean that: picking an entry in the hamburger menu, and going into
 * a card's own controls from the card itself. Both are a commitment rather than
 * a move, which is why neither uses the step tick, and both are distinct from
 * merely handing a panel the keys (handoverIn) — you can hand the keys over and
 * change your mind, but a choice has landed on something.
 *
 * Three notes rather than the handover pair's two, falling faster and further,
 * so the family reads as: tick to move, two notes to enter, three to commit.
 */
export function confirmIn(c: AudioContext): void {
  const t = c.currentTime;
  const notes: [number, number][] = [[880, 0], [660, 0.045], [440, 0.09]];
  notes.forEach(([freq, delay]) => {
    const start = t + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.11, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.06);
  });
}

/**
 * Sparkle — a card's action overlay just flashed open.
 *
 * The overlay appears all at once over the card, so the sound is a flash too:
 * high partials sweeping *up* over about a tenth of a second, well above the
 * register the handover pair sits in. It has to be distinct from those two:
 * all three can happen within a second of each other while walking into a
 * panel and opening a card's actions.
 *
 * Close to connectionMade in register, deliberately: both are "something just
 * lit up". This one glides rather than sitting on fixed partials, which is what
 * makes it read as a flash instead of a bell.
 */
export function sparkle(c: AudioContext): void {
  const t = c.currentTime;
  // Three voices a fifth or so apart, each sliding up and dying fast. Staggered
  // by a few ms so it shimmers rather than arriving as one chord.
  const voices: [number, number, number, number][] = [
    // [from, to, peak gain, start offset]
    [1800, 3400, 0.085, 0],
    [2700, 5100, 0.055, 0.012],
    [3600, 6800, 0.035, 0.024],
  ];
  voices.forEach(([from, to, amp, delay]) => {
    const start = t + delay;
    const dur = 0.11;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(amp, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + dur + 0.01);
  });
}

/**
 * Desk bell — one struck note, ring and fade (チーン).
 *
 * The one sound in here aimed at somebody who is not looking at the screen: it
 * says the coding agent has stopped and the turn is yours. So it is a single
 * strike rather than an arpeggio (a run of notes reads as decoration, a strike
 * reads as a summons), and it rings for a good second — long enough to carry
 * across a room, which is where the person waiting for it usually is.
 *
 * Two partials a fifth apart, the upper one decaying faster: that inharmonic
 * ping is most of what makes a struck bell sound struck rather than blown.
 */
export function ring(c: AudioContext): void {
  const t = c.currentTime;
  const partials = [
    { freq: 1318.5, amp: 0.26, decay: 1.10 }, // E6 — the note you hear
    { freq: 1975.5, amp: 0.10, decay: 0.45 }, // B6 — the strike, gone quickly
    { freq: 2637.0, amp: 0.05, decay: 0.30 }, // E7 — the click of the hammer
  ];
  partials.forEach(({ freq, amp, decay }) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    // A near-instant attack: a bell has no swell, and 3ms of one is the
    // difference between struck and switched on.
    gain.gain.linearRampToValueAtTime(amp, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.start(t); osc.stop(t + decay + 0.01);
  });
}

/**
 * The control pill sliding open or shut — a breath of air (シュッ), not a note.
 *
 * Noise through a wide bandpass whose centre travels with the pill's edge:
 * up the spectrum as it opens, down as it folds back. Unlike swish, which is
 * a hand cutting the air and so is loudest at once, this swells in and trails
 * off — wind going past rather than a blow — because the pill eases in and out
 * too. A low Q keeps it airy; a narrow band starts to whistle.
 * webext/webext-src/pill.js plays a copy of this: change them together.
 */
function pillAir(c: AudioContext, open: boolean): void {
  const t = c.currentTime;
  const dur = open ? 0.24 : 0.18;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;

  // Nothing below the breath: a wide band still lets low noise through, and
  // at the bottom of the sweep that reads as a thud (ボコッ), not air.
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  const [f0, f1] = open ? [1200, 4800] : [4400, 1100];
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur);

  const gain = c.createGain();
  const peak = open ? 0.22 : 0.18;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + dur * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(hp);
  hp.connect(bp);
  bp.connect(gain);
  gain.connect(c.destination);
  src.start(t);
  src.stop(t + dur);
}

/** The control pill opening out of its status sign. See pillAir. */
export function pillExpand(c: AudioContext): void {
  pillAir(c, true);
}

/** The control pill folding back into its status sign. See pillAir. */
export function pillShrink(c: AudioContext): void {
  pillAir(c, false);
}
