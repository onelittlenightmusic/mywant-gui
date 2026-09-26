import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  label: string;
  shortcut?: string;
  /** Place the tooltip below the element instead of above. */
  below?: boolean;
  /** Programmatically force the tooltip visible (e.g. keyboard/gamepad focus). */
  forceVisible?: boolean;
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ label, shortcut, below = false, forceVisible = false, children }) => {
  const [hovered, setHovered] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const calcPos = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      top: below
        ? rect.bottom + window.scrollY + 8
        : rect.top   + window.scrollY - 8,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  };

  const show = () => { calcPos(); setHovered(true); };
  const hide = () => setHovered(false);

  /**
   * A tooltip explains a control before you commit to it, and a touch has no
   * "before" — the finger lands and the thing happens. So a tap has nothing to
   * be told, and the label only got in the way.
   *
   * It got in the way permanently, in fact. iOS emulates hover on tap and does
   * not emulate the leaving of it: `mouseenter` fired, `mouseleave` never came,
   * and the tooltip for whichever button was last pressed stayed on screen
   * until something else was touched. Pressing the pad button left "Hide Pad"
   * floating over the board.
   *
   * Two rules fix it. Hover only counts from a mouse — a pointer that can be
   * somewhere without pressing. And any press dismisses, whatever the pointer:
   * once you have committed, the label has said all it had to say.
   */
  const onPointerEnter = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') show(); };

  /**
   * Focus shows it only when focus arrived by keyboard.
   *
   * A tap focuses the button too, which is the other half of why the label
   * stuck: `onFocus` fired on touch and `onBlur` waited for focus to move
   * somewhere else. `:focus-visible` is the browser's own answer to "did they
   * mean to be here", and it is false for a tap.
   */
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (typeof el.matches === 'function' && el.matches(':focus-visible')) show();
  };

  // Recalculate position whenever forceVisible flips on.
  useEffect(() => { if (forceVisible) calcPos(); }, [forceVisible]);

  const visible = hovered || forceVisible;

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onPointerEnter={onPointerEnter}
      onPointerLeave={hide}
      onPointerDown={hide}
      onPointerCancel={hide}
      onFocus={onFocus}
      onBlur={hide}
    >
      {children}
      {visible &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: below ? 'translate(-50%, 0%)' : 'translate(-50%, -100%)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            {!below && (
              <div className="bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap inline-flex items-center gap-1.5">
                {label}
                {shortcut && (
                  <kbd className="bg-gray-600 dark:bg-gray-300 text-gray-200 dark:text-gray-700 text-xs px-1 py-0.5 rounded font-mono leading-none">
                    {shortcut}
                  </kbd>
                )}
              </div>
            )}
            {!below && (
              <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800 dark:border-t-gray-100" />
            )}
            {below && (
              <div className="w-0 h-0 mx-auto border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800 dark:border-b-gray-100" />
            )}
            {below && (
              <div className="bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap inline-flex items-center gap-1.5">
                {label}
                {shortcut && (
                  <kbd className="bg-gray-600 dark:bg-gray-300 text-gray-200 dark:text-gray-700 text-xs px-1 py-0.5 rounded font-mono leading-none">
                    {shortcut}
                  </kbd>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
