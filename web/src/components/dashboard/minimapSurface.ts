import { classNames } from '@/utils/helpers';

/**
 * The minimap panel's surface — its ground and its edge. Its own module, and a
 * small one, so that the same panel drawn elsewhere (the browser extension's
 * Canvas mode, through mywant-guiex's embed bundle) is this panel rather than a
 * copy of its look, without carrying WantMinimap's stores along with it.
 */
export function minimapSurfaceClass(isCanvasMode: boolean): string {
  return classNames(
    'border-gray-300/60 dark:border-gray-700/50',
    isCanvasMode
      ? 'bg-slate-100/50 dark:bg-gray-900/60'
      : 'bg-slate-100/90 dark:bg-gray-900/80 p-4 overflow-hidden',
  );
}
