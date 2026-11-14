import {
  gridMove, wantPlaced, whoosh, impactAttack, impactMend, impactFreeze, impactFeed, hapticClick, buttonPress, handoverIn, handoverOut, confirmIn, sparkle, chime, ring, pillExpand, pillShrink, pickChosen, overlayChoose,
} from './soundSynth';

/**
 * Every sound the app can play, in one list.
 *
 * There was no list before — there was a union of names, a separate map from
 * those names to waveforms, and the waveforms themselves, all interleaved down
 * one long file. Adding a sound meant editing three places that had to agree,
 * and nothing anywhere said what a sound was FOR, so the only way to find out
 * whether `sparkle` or `chime` was the right one to reach for was to read both
 * and guess. Names alone do not carry that: `confirmIn` and `handoverIn` are
 * both plausible for "entering something".
 *
 * So the catalogue is the source of truth. `when` is not decoration — it is the
 * question a caller actually has, answered next to the thing it is asking
 * about. SoundEvent is derived from these keys, so a new sound is one entry
 * here and nothing else, and a name that exists cannot fail to have a waveform.
 *
 * Sounds that belong to an extension's moments (the canvas's footsteps, its
 * knocks and landings) are not here: the extension registers them itself
 * (registerSounds, in sounds.ts).
 */
export interface SoundDef {
  /** What it sounds like. */
  what: string;
  /** The moment it belongs to. Read this before reaching for a sound. */
  when: string;
  /** Schedules the notes on an already-running context. */
  play: (c: AudioContext) => void;
  /**
   * Felt as well as heard: playing it also buzzes — a pad's rumble, a
   * phone's vibration, the app's tap (sounds.ts, FEEL). 'light' for
   * something coming up or going in, 'firm' for a choice made. None: heard
   * only.
   */
  feel?: Feel;
}

export type Feel = 'light' | 'firm';

export const SOUND_CATALOG = {
  // ── Moving around the board ──────────────────────────────────────────────
  gridMove: {
    what: 'One pebble (tick).',
    when: 'One grid step while dragging a want with the keyboard.',
    play: gridMove,
  },
  buttonPress: {
    what: 'One pebble (press).',
    when: 'A footstep presses a button-form want (direction/going/gear) down into its socket.',
    play: buttonPress,
  },

  // ── What lands on a want (components/impact) ───────────────────────────
  impactAttack: {
    what: 'A small burst of fire: a crack, a darkening puff, a falling thump.',
    when: "An attack's hit lands on a want (its `impact` is an attack).",
    play: impactAttack,
  },
  impactMend: {
    what: 'A soft rising breath, two glides a fifth apart.',
    when: 'A mend reaches a want (its `impact` is a mend).',
    play: impactMend,
  },
  impactFreeze: {
    what: 'A clock stopping: tick, tick, and the hand catching.',
    when: 'A freeze holds a want where it is (its `impact` is a freeze).',
    play: impactFreeze,
  },
  impactFeed: {
    what: 'A light "received": two rising taps and a bright glide.',
    when: 'A value handed on by a connection lands on a want (its `impact` is a feed).',
    play: impactFeed,
  },

  // ── Putting things on the board ──────────────────────────────────────────
  wantPlaced: {
    what: 'One pebble (place).',
    when: 'A want is set down on the canvas.',
    play: wantPlaced,
  },


  // ── Cards opening and closing ────────────────────────────────────────────
  cardOpen: {
    what: 'One pebble (open).',
    when: 'A card opens.',
    play: (c: AudioContext) => whoosh(c, 'up'),
  },
  cardClose: {
    what: 'One pebble (close).',
    when: 'A card closes.',
    play: (c: AudioContext) => whoosh(c, 'down'),
  },
  // Blowing a card up is going into it, and closing it is coming back out — the
  // same pair as inner focus and the hamburger menu, so the three read as one
  // gesture rather than three unrelated noises. Mapped here rather than at the
  // call site so every route to a maximised card agrees.
  cardMaximize: {
    what: 'The entering sound (same as confirmIn).',
    when: 'A card is blown up to full size.',
    play: confirmIn,
    feel: 'light',
  },
  cardMaximizeClose: {
    what: 'The leaving sound (same as handoverOut).',
    when: 'A maximised card is closed.',
    play: handoverOut,
  },

  // ── Who holds the keys ───────────────────────────────────────────────────
  handoverIn: {
    what: 'One pebble (in).',
    when: 'The board hands the keys to a panel.',
    play: handoverIn,
    feel: 'light',
  },
  handoverOut: {
    what: 'One pebble (out).',
    when: 'A panel gives the keys back to the board.',
    play: handoverOut,
  },
  confirmIn: {
    what: 'One pebble (confirm).',
    when: 'Going into something — A on a card, entering inner focus.',
    play: confirmIn,
    feel: 'light',
  },
  pickChosen: {
    what: 'Two pebbles rising (connect, then a bright done).',
    when: 'Pick mode decided: a thing or want on the board (or the thing list) is taken as the parameter\'s value. Replaces the handover note back to the panel.',
    play: pickChosen,
    feel: 'firm',
  },
  overlayOpen: {
    what: 'One pebble (done).',
    when: "A card's action overlay comes up (OverlayActionGrid, or a store saying one is open).",
    play: sparkle,
    feel: 'light',
  },
  overlayChoose: {
    what: 'One pebble (confirm).',
    when: "An action chosen on a card's overlay (OverlayActionGrid) — a tap, A / Enter, or its letter. Comes with a haptic; the overlay closing after it says nothing.",
    play: overlayChoose,
    feel: 'firm',
  },
  hapticClick: {
    what: 'One pebble (tick), fainter.',
    when: 'Small confirmations that want a tick rather than a tune — a touch on the d-pad, a hold taking.',
    play: hapticClick,
    feel: 'light',
  },

  // ── Something happened ───────────────────────────────────────────────────
  sparkle: {
    what: 'One pebble (done).',
    when: 'A flourish on the canvas — an effect firing.',
    play: sparkle,
  },
  chime: {
    what: 'One pebble (done), a touch louder.',
    when: 'Something pleasant completed, in passing.',
    play: chime,
  },
  ring: {
    what: 'Three taps of one pebble, a gap before the last — the loudest thing here.',
    when: 'A coding agent hands the turn back. Aimed at somebody not looking at the screen, which is why it has a rhythm nothing else has.',
    play: ring,
  },
  // ── The global control pill ──────────────────────────────────────────────
  pillExpand: {
    what: 'One pebble (open), faint.',
    when: 'The shrunk global control pill (phone width) opens out of its status sign.',
    play: pillExpand,
  },
  pillShrink: {
    what: 'One pebble (close), faint.',
    when: 'The open global control pill folds back into its status sign — by a tap on the sign, a tap elsewhere, or Escape.',
    play: pillShrink,
  },
} as const satisfies Record<string, SoundDef>;

/** Every sound there is. Derived, so a name cannot exist without a waveform. */
/** The names of this app's own sounds. See sounds.ts for the ones extensions add. */
export type CatalogSound = keyof typeof SOUND_CATALOG;
