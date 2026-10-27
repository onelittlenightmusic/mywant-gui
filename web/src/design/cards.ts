/**
 * A field card's face — the quiet sheet's card, for the values a panel shows.
 *
 * A parameter, a state field, a label, a want's name and type: each is a card
 * of its own, and every one of them is the same card — white (slate in the
 * dark), set down with its shadow to the lower right as the overlays' cells
 * and the tab you are on are (components/overlay/design.ts, design/tabs.ts).
 * What kind of value it holds is said by its small icon, in the kind's colour;
 * the card itself is no longer tinted by it. A wide tinted face made every
 * card a different colour, and the panel read as many things instead of one.
 */
export const FIELD_CARD_SURFACE =
  'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-[2px_3px_6px_rgba(15,23,42,0.08)]';

/** Pointed at: lifted a little further. */
export const FIELD_CARD_HOVER = 'hover:shadow-[3px_4px_10px_rgba(15,23,42,0.14)]';

/** The name over a card's value. */
export const FIELD_CARD_LABEL = 'text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-none';
