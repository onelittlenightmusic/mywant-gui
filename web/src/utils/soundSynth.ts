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

/** High metallic ping — two adjacent wants just became correlated */
export function connectionMade(c: AudioContext): void {
  const t = c.currentTime;
  const partials: [number, number, number][] = [
    [2800, 0.10, 0.55],
    [4200, 0.07, 0.40],
    [5600, 0.04, 0.28],
  ];
  partials.forEach(([freq, amp, decay]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(amp, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.start(t);
    osc.stop(t + decay + 0.01);
  });
}

/** Snap — want dropped/repositioned on the canvas */
export function wantDropped(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.07);
  gain.gain.setValueAtTime(0.20, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.start(t);
  osc.stop(t + 0.08);
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

/** Robot cursor movement — same whoosh as card open/focus. */
export function robotMove(c: AudioContext): void {
  whoosh(c, 'up');
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

/** Soft footstep — CursorMan moves one grid cell */
export function cursorStep(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);
  gain.gain.setValueAtTime(0.07, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.start(t);
  osc.stop(t + 0.06);
}

/**
 * Landing on a tile — a want or a thing (カチャッ).
 *
 * Two clicks of filtered noise a breath apart, the second lower and longer: a
 * latch catching, which is what stepping onto a tile is — the character is now
 * standing on something, not beside it. Under them, a very short low thump for
 * the weight arriving. Noise rather than tones, so it reads as an object and
 * not as a note, and stays apart from the step's soft sine and the bump's knock.
 */
export function tileLand(c: AudioContext): void {
  const t = c.currentTime;
  const click = (start: number, freq: number, dur: number, amp: number) => {
    const frames = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 4;
    const gain = c.createGain();
    gain.gain.setValueAtTime(amp, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(c.destination);
    src.start(start);
    src.stop(start + dur);
  };
  // カ — the first contact, bright and almost instant.
  click(t, 3800, 0.018, 0.55);
  // チャッ — the latch settling, a little lower and a little longer.
  click(t + 0.032, 2300, 0.05, 0.45);

  const body = c.createOscillator();
  const bodyGain = c.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(170, t);
  body.frequency.exponentialRampToValueAtTime(80, t + 0.04);
  bodyGain.gain.setValueAtTime(0.12, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  body.connect(bodyGain);
  bodyGain.connect(c.destination);
  body.start(t);
  body.stop(t + 0.05);
}

/**
 * Walking into something that will not move.
 *
 * A step's twin, pitched down and given a body: the same gesture met by an
 * object rather than by floor. Low and short, because it is not an error — it
 * is the sound of the room being where it is.
 */
export function cursorBump(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  // A touch of noise-like detune under the tone, so it lands as a thud rather
  // than a musical note: a wall is not in key with anything.
  const osc2 = c.createOscillator();
  const gain2 = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc2.connect(gain2); gain2.connect(c.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.09);
  gain.gain.setValueAtTime(0.10, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
  osc.start(t); osc.stop(t + 0.11);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(95, t);
  osc2.frequency.exponentialRampToValueAtTime(48, t + 0.07);
  gain2.gain.setValueAtTime(0.05, t);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc2.start(t); osc2.stop(t + 0.09);
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
 * Fanfare — a stage cleared (でででーん!).
 *
 * The only sound in here that marks an achievement rather than an action, so it
 * is built like one: a rising triad taken in three quick steps and then the
 * octave, held as a full chord while it rings out. The steps are what make it
 * read as going somewhere; the held chord is the arrival. Everything else in
 * this file is a click, a step or a bell, all under a third of a second — this
 * one is allowed its second and a half, because it is punctuation at the end of
 * a stage rather than feedback on a keypress.
 *
 * Brass-ish by mixing a square an octave up under a triangle fundamental: a
 * plain sine reads as a chime, and a chime is what the sparkle already is.
 */
export function fanfare(c: AudioContext): void {
  const t = c.currentTime;
  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

  // One note of the fanfare. `hold` carries the final chord past the steps.
  const blow = (freq: number, at: number, dur: number, amp: number) => {
    const start = t + at;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    // A brass attack is quick but not instant — 12ms is the difference between
    // blown and struck.
    gain.gain.exponentialRampToValueAtTime(amp, start + 0.012);
    gain.gain.setValueAtTime(amp, start + dur * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(start); osc.stop(start + dur + 0.02);

    // The edge that makes it a horn rather than a flute, kept well under the
    // fundamental so it colours the note instead of becoming one.
    const bite = c.createOscillator();
    const biteGain = c.createGain();
    bite.type = 'square';
    bite.frequency.value = freq * 2;
    biteGain.gain.setValueAtTime(0.0001, start);
    biteGain.gain.exponentialRampToValueAtTime(amp * 0.10, start + 0.012);
    biteGain.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.6);
    bite.connect(biteGain); biteGain.connect(c.destination);
    bite.start(start); bite.stop(start + dur + 0.02);
  };

  // Three steps up...
  blow(C5, 0.00, 0.16, 0.16);
  blow(E5, 0.10, 0.16, 0.16);
  blow(G5, 0.20, 0.18, 0.17);
  // ...then the arrival, the whole chord together and left to ring.
  blow(C6, 0.34, 1.05, 0.19);
  blow(G5, 0.34, 1.05, 0.11);
  blow(E5, 0.34, 1.05, 0.09);
  blow(C5, 0.34, 1.10, 0.10);
}

/**
 * A short soft blip, rising — a suggestion bubble just appeared beside a
 * dragged tile (a field-match recommendation, or a constellation prompt).
 *
 * Deliberately quiet and brief: this fires every time two cards land near
 * each other while dragging, which happens constantly, and must read as a
 * notice rather than compete with connectionMade or sparkle, which mark the
 * user actually having said yes to something.
 */
export function suggestShown(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(760, t + 0.05);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

/**
 * The same blip, falling — a suggestion was waved off rather than taken.
 *
 * Paired with suggestShown the way handoverIn/handoverOut are paired: same
 * voice, opposite direction, so the ear tells "a suggestion appeared" from
 * "a suggestion was dismissed" without either being mistaken for the
 * different, positive sound a completed connection makes.
 */
export function suggestDismissed(c: AudioContext): void {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(620, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.05);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.07);
}

/**
 * A single crisp snap (パチッ) — a connection just actually happened, the
 * sound half of Fliction. One sound for both its shapes: a want-want ripple
 * and a thing-thing spark are the same kind of event — a suggestion that just
 * got a "yes" — and sounding alike is what says so.
 *
 * Built from filtered noise rather than a tone: a snap has no pitch, only a
 * transient, and stacking oscillators the way sparkle does reads as a chime
 * rather than a snap. A burst of noise through a highpass that only lets the
 * top end through, gone in under 50ms, with one even shorter click layered
 * right on the attack for the "crack" itself — the same trick a real spark
 * mic'd up close is mostly high-frequency noise with a hard onset.
 */
export function fliction(c: AudioContext): void {
  const t = c.currentTime;

  // The body of the snap: filtered noise, gone almost immediately.
  const dur = 0.05;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2800;
  hp.Q.value = 0.7;

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.4, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(hp);
  hp.connect(noiseGain);
  noiseGain.connect(c.destination);
  src.start(t);
  src.stop(t + dur);

  // The crack itself: one very short, very high click right at the attack,
  // under the noise so the two read as one event rather than two.
  const click = c.createOscillator();
  const clickGain = c.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(4200, t);
  clickGain.gain.setValueAtTime(0.14, t);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
  click.connect(clickGain);
  clickGain.connect(c.destination);
  click.start(t);
  click.stop(t + 0.015);
}
/**
 * A short cut through the air (ヒュッ) — the wire being flicked out.
 *
 * Noise, not a tone, for fliction's reason: air has no pitch, and a sawtooth
 * sweep (whoosh, which card-open uses) reads as a machine rising rather than
 * something moving THROUGH something. The band sweeps up fast and the tail is
 * shorter than the attack is loud, which is the shape of a swing passing the
 * ear: it arrives already going, and it is gone before you can follow it.
 *
 * Kept to ~110ms on purpose. This plays on every press of a skill that is
 * pressed repeatedly, and anything with a body to it becomes a drone at four
 * presses in a row.
 */
export function swish(c: AudioContext): void {
  const t = c.currentTime;
  const dur = 0.11;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Shaped as it is written rather than by a gain ramp: a swing is loudest
    // just after it starts and then gets out of the way.
    const k = i / frames;
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 1.6);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;

  // The sweep is what makes it a movement and not a hiss: the band climbs
  // through the whole of it, so the noise seems to pass by.
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(700, t);
  bp.frequency.exponentialRampToValueAtTime(5200, t + dur);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp);
  bp.connect(gain);
  gain.connect(c.destination);
  src.start(t);
  src.stop(t + dur);
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
