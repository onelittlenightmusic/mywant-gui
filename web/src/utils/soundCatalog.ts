import {
  gridMove, wantPlaced, whoosh, hapticClick, buttonPress, handoverIn, handoverOut, confirmIn, sparkle, chime, ring, pillExpand, pillShrink,
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
}

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
  },
  hapticClick: {
    what: 'One pebble (tick), fainter.',
    when: 'Small confirmations that want a tick rather than a tune.',
    play: hapticClick,
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
