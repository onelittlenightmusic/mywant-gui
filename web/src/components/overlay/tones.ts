/**
 * What an overlay's actions mean, and how big its pieces are.
 *
 * Every overlay the app puts over a card or the board — a card's long-press
 * actions, Shift+Enter, a yes/no, the board's bubbles — is the same object: a
 * box of cells, an icon over a word, one of them ringed where the keys are. An
 * overlay says what each action MEANS (its tone); how that looks is the active
 * overlay design's business (see design.ts), and an extension can bring a
 * design of its own.
 *
 * See scripts/check-overlays.mjs, which fails the build when overlay styling
 * turns up outside components/overlay.
 */

/**
 * What an action means, which is what decides its colour.
 *
 *   confirm  yes, OK, create, save, start, approve — go ahead
 *   cancel   no, cancel, close, back — leave without doing anything
 *   danger   delete, deny — cannot be taken back, or refuses something
 *   primary  the ordinary action: open, edit, detail
 *   caution  suspend, archive, drop — reversible, but stops something
 *   info     go somewhere, call someone, a pre-selected choice
 *   accent   a setting set apart from the ordinary actions: credentials, "home"
 *   special  what is about a person or a presentation: ride, aura, inspect, display
 *   muted    one of several equal choices, none of them recommended
 */
export type OverlayTone =
  | 'confirm' | 'cancel' | 'danger' | 'primary' | 'caution'
  | 'info' | 'accent' | 'special' | 'muted';

export const OVERLAY_TONES: readonly OverlayTone[] = [
  'confirm', 'cancel', 'danger', 'primary', 'caution', 'info', 'accent', 'special', 'muted',
];

/**
 * Sizes of a free-standing overlay: one cell per choice, at most MAX_ROW to a
 * row, and a box tall enough for a header over one row of cells. Layout, not
 * look — every design lays out on the same grid, so a bubble sized for one
 * fits the other.
 */
export const OVERLAY_CELL_PX = 72;
export const OVERLAY_MAX_ROW = 6;
export const OVERLAY_HEIGHT_PX = 108;

/** Stagger between cells as they come in, in ms. */
export const OVERLAY_STAGGER_MS = 30;
