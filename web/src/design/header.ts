/**
 * The header's right-hand buttons, drawn as the control pill draws its cells
 * (shared/controlPill with the sheet design): a sunken tray, each button a
 * raised card in it, the two ends rounded with the tray. A lit button keeps
 * its solid fill — a small area, so it may be saturated (see dashboard/STYLE.md).
 */

export const HEADER_TRAY =
  'flex items-stretch self-stretch -my-1 sm:-my-2 min-w-0 overflow-hidden gap-1 p-1 rounded-full ' +
  'bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 ' +
  'shadow-[inset_1px_2px_4px_rgba(15,23,42,0.14)] ' +
  // Each button sits in a Tooltip's wrapper, so the ends are found through it.
  '[&>:first-child_button]:rounded-l-full [&>:last-child_button]:rounded-r-full';

/** Every button in the tray: a card's shape, whatever it is filled with. */
export const HEADER_CELL =
  'flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full rounded-xl ' +
  'shadow-[1px_2px_4px_rgba(15,23,42,0.16)] transition-all duration-150 focus:outline-none';

/** An unlit button: the card's own ground, in the words' colour. */
export const HEADER_CELL_UNLIT = 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700';

/** The word under the icon, as the pill's: not shouted. */
export const HEADER_LABEL = 'text-[9px] font-medium leading-none hidden sm:block';
