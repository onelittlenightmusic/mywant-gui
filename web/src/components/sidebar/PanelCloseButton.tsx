import React from 'react';
import { X } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { CONTROL, CONTROL_ICON_CLASS } from '@/design/controls';
import { HostFramedPanel } from '@/lib/nativeHost';

/**
 * The way out of a panel. One button, wherever it is drawn.
 *
 * There were two: the frame's header carried one for every panel that used it,
 * and the want and thing panels — which draw no header, because the card at the
 * top already names them — grew their own. They were different sizes, different
 * glyph sizes and different distances from the edge, so which panel you were in
 * changed what closing looked like and how hard it was to hit.
 *
 * Both call this now. A panel decides WHERE its close goes; it does not get to
 * decide what one looks like.
 *
 * `md`, not `sm`: leaving is not an incidental act however small the glyph is.
 * And never flush with the panel's edge — on a phone the panel is the full
 * width of the screen, and the outermost few millimetres belong to iOS, where
 * the back-swipe starts, so a touch that begins there never reaches the page.
 */
export const PanelCloseButton: React.FC<{
  onClick: () => void;
  /** Skipped in the keyboard order where the frame already handles that. */
  tabIndex?: number;
  className?: string;
}> = ({ onClick, tabIndex, className }) => {
  // In a sheet an app frames, the close is the app's (its bar, drawn
  // natively) — one way out, wherever the panel would have put its own.
  if (React.useContext(HostFramedPanel)) return null;
  return (
  <button
    onClick={onClick}
    tabIndex={tabIndex}
    aria-label="Close"
    title="Close"
    className={classNames(
      CONTROL.md,
      'min-w-[44px] flex items-center justify-center rounded-lg flex-shrink-0',
      'text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none',
      className,
    )}
  >
    <X className={CONTROL_ICON_CLASS.md} />
  </button>
  );
};
