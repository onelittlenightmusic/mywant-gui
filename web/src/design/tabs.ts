import { classNames } from '@/utils/helpers';

/**
 * How a strip of tabs looks — the quiet sheet's tabs.
 *
 * Three strips (a detail sheet's own tabs, its sub-tabs, the want form's) were
 * drawn alike by hand: an underlined row of uppercase words. They now take the
 * look of the overlays' sheet design (components/overlay/design.ts): the strip
 * is a tray sunk into the panel, and the tab you are on is a card set down in
 * it — white, its shadow to the lower right, the one light from the upper
 * left — while the others lie flat in the tray. Which tab it is shows by being
 * lifted, not by a rule under it; colour is kept for the icon of the one you
 * are on.
 */

/** The tray. `isBottom`: the strip is at the panel's foot, its edge on top. */
export function tabTrayClass(isBottom: boolean): string {
  return classNames(
    'flex flex-shrink-0 gap-1 p-1 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-700',
    'shadow-[inset_1px_2px_4px_rgba(15,23,42,0.08)]',
    isBottom ? 'border-t' : 'border-b',
  );
}

/** One tab — set down as a card when it is the one you are on. */
export function tabClass(active: boolean): string {
  return classNames(
    'flex-1 flex flex-col items-center justify-center gap-0.5 px-0.5 rounded-lg border transition-all relative min-w-0',
    active
      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 ' +
        'shadow-[2px_3px_6px_rgba(15,23,42,0.12)]'
      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ' +
        'hover:bg-white/60 dark:hover:bg-slate-800/50',
  );
}

/** A tab's icon: coloured only on the tab you are on. */
export function tabIconClass(active: boolean): string {
  return active ? 'text-blue-600 dark:text-blue-400' : '';
}

/** A tab's word: one size, not shouted. */
export const TAB_LABEL = 'hidden sm:block text-[11px] font-medium leading-tight truncate w-full text-center';

/**
 * Where a framing app draws the strip itself (useHostTabs): the room the tray
 * took — a tab's 52px and the tray's 4px either side — kept empty for it.
 */
export const TAB_HOST_ROOM = 'flex-shrink-0 h-[60px]';
