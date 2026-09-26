import {
  gridMove, connectionMade, wantPlaced, wantDropped, whoosh, robotMove,
  hapticClick, cursorStep, cursorBump, tileLand, buttonPress, handoverIn, handoverOut,
  confirmIn, sparkle, chime, ring, fanfare, suggestShown, suggestDismissed,
  fliction, swish, pillExpand, pillShrink,
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
    what: 'Short tick.',
    when: 'One grid step while dragging a want with the keyboard.',
    play: gridMove,
  },
  cursorStep: {
    what: 'A soft footfall.',
    when: 'Each cell the character walks, by arrow key or by stick — both, so the two ways of walking do not sound like different things.',
    play: cursorStep,
  },
  cursorBump: {
    what: 'A low knock.',
    when: 'Walking into a want. Once, on arrival: the steps that follow while the highlight holds are footsteps, or standing beside a door sounds like hammering on it.',
    play: cursorBump,
  },
  tileLand: {
    what: 'A latch catching (カチャッ) — two noise clicks and a small thump.',
    when: 'The character arrives on a tile, want or thing alike — on foot, by a hop, or sent there by a tap. Once per tile: standing still on it, or the board redrawing underneath, is silent.',
    play: tileLand,
  },
  robotMove: {
    what: 'A rising whoosh.',
    when: 'The robot moves itself across the board.',
    play: robotMove,
  },
  buttonPress: {
    what: 'A low, short clunk (コトッ).',
    when: 'A footstep presses a button-form want (direction/going/gear) down into its socket.',
    play: buttonPress,
  },

  // ── Putting things on the board ──────────────────────────────────────────
  wantPlaced: {
    what: 'A settling thud.',
    when: 'A want is set down on the canvas.',
    play: wantPlaced,
  },
  wantDropped: {
    what: 'A duller, shorter thud.',
    when: 'A drag ends without placing anything.',
    play: wantDropped,
  },
  connectionMade: {
    what: 'Two tones meeting.',
    when: 'Two wants are connected.',
    play: connectionMade,
  },

  // ── Suggestions (Fliction's lead-in) ──────────────────────────────────────
  suggestShown: {
    what: 'A short soft blip, rising.',
    when: 'A suggestion bubble appears — a field-match recommendation, or a constellation prompt — from setting one card down beside another.',
    play: suggestShown,
  },
  suggestDismissed: {
    what: 'The same blip, falling.',
    when: 'A suggestion bubble is waved off without being taken — closed, clicked away from, or Escaped.',
    play: suggestDismissed,
  },
  fliction: {
    what: 'A single crisp snap (パチッ) — filtered noise, not a tone.',
    when: 'A connection actually happens on the canvas — a want-want field match Applied, or a thing-thing constellation confirmed. The sound half of Fliction, one voice for both its shapes.',
    play: fliction,
  },

  // ── Cards opening and closing ────────────────────────────────────────────
  cardOpen: {
    what: 'Whoosh, upward.',
    when: 'A card opens.',
    play: (c: AudioContext) => whoosh(c, 'up'),
  },
  cardClose: {
    what: 'Whoosh, downward.',
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
    what: 'A short rising pair.',
    when: 'The board hands the keys to a panel.',
    play: handoverIn,
  },
  handoverOut: {
    what: 'The same pair, falling.',
    when: 'A panel gives the keys back to the board.',
    play: handoverOut,
  },
  confirmIn: {
    what: 'A crisp inward tone.',
    when: 'Going into something — A on a card, entering inner focus.',
    play: confirmIn,
  },
  hapticClick: {
    what: 'A tiny click.',
    when: 'Small confirmations that want a tick rather than a tune.',
    play: hapticClick,
  },

  // ── Something happened ───────────────────────────────────────────────────
  sparkle: {
    what: 'A bright scatter.',
    when: 'A flourish on the canvas — an effect firing.',
    play: sparkle,
  },
  chime: {
    what: 'Ascending bell arpeggio (キラーん).',
    when: 'Something pleasant completed, in passing.',
    play: chime,
  },
  ring: {
    what: 'One struck desk bell (チーン), held about a second.',
    when: 'A coding agent hands the turn back. Aimed at somebody not looking at the screen, which is why it is one strike and not an arpeggio.',
    play: ring,
  },
  fanfare: {
    what: 'A rising triad and a held chord (でででーん).',
    when: 'A stage is cleared and the game moves to the next one. The one sound that marks an achievement rather than an action.',
    play: fanfare,
  },
  // ── The global control pill ──────────────────────────────────────────────
  pillExpand: {
    what: 'A breath of air going up (シュッ) — filtered noise, not a tone.',
    when: 'The shrunk global control pill (phone width) opens out of its status sign.',
    play: pillExpand,
  },
  pillShrink: {
    what: 'The same breath, going down and a little shorter.',
    when: 'The open global control pill folds back into its status sign — by a tap on the sign, a tap elsewhere, or Escape.',
    play: pillShrink,
  },
  // ── The Y slot ───────────────────────────────────────────────────────────
  skillSwish: {
    what: 'A short cut through the air (ヒュッ).',
    when: 'A skill in the Y slot moving something through the air: the wire flicked out on every press of it, a held thing let go of. Both are the same event as far as the ear is concerned — a hand moving fast — which is why they share it rather than each having a noise of its own.',
    play: swish,
  },
} as const satisfies Record<string, SoundDef>;

/** Every sound there is. Derived, so a name cannot exist without a waveform. */
export type SoundEvent = keyof typeof SOUND_CATALOG;
