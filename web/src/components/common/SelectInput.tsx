import React, {
  useState, useRef, useCallback, useEffect, useLayoutEffect, forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useInputActions } from '@/hooks/useInputActions';
import { classNames } from '@/utils/helpers';

export interface SelectOption {
  value: string;
  label?: string;
}

export interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Use semi-transparent background so card background icons show through */
  transparent?: boolean;
  /** Compact sizing for use inside want cards (smaller padding, smaller font) */
  compact?: boolean;
  /** Pass-through: fires when trigger is focused (closed state). */
  onFocus?: (e: React.FocusEvent) => void;
  /** Pass-through: fires when focus leaves the entire widget. */
  onBlur?: (e: React.FocusEvent) => void;
  /**
   * Pass-through: fires on keydown while the dropdown is CLOSED.
   * Parents use this for between-item arrow-key navigation.
   */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /**
   * Called when Escape is pressed while the dropdown is CLOSED (keyboard) or
   * when the Gamepad B button is pressed while the trigger is focused.
   * SelectInput stops native Escape propagation so the caller's handler is
   * the sole consumer — outer useEscapeKey / handleEscapeKey will not fire.
   * Intended for the "exit inner focus → return focus to want card" action.
   */
  onEscape?: () => void;
}

export interface SelectInputHandle {
  focus: () => void;
}

/**
 * Custom dropdown with full keyboard + gamepad support.
 *
 * Both devices are routed through useInputActions, so behaviour is described
 * once in terms of actions rather than once per input device:
 *
 * Closed state (trigger focused):
 *   confirm  (Enter / A)            → open
 *   cancel   (Escape / Space / B)   → onEscape (exit inner focus)
 *   ArrowUp/Down                    → delegated to parent (between-item nav)
 *
 * Open state:
 *   navigate (ArrowUp/Down / D-pad) → move highlighted option
 *   confirm  (Enter / A)            → select highlighted option → close
 *   cancel   (Escape / Space / B)   → close without changing the value
 *
 * Space cancels rather than confirms: useInputActions groups plain Space with
 * Escape (equivalently gamepad B) across the whole app.
 */
export const SelectInput = forwardRef<SelectInputHandle, SelectInputProps>(({
  value,
  onChange,
  options,
  placeholder = '— select —',
  className,
  disabled = false,
  transparent = false,
  compact = false,
  onFocus,
  onBlur,
  onKeyDown,
  onEscape,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isTriggerFocused, setIsTriggerFocused] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);

  // Stable refs so gamepad callbacks always see latest values without stale closures
  const highlightedIndexRef = useRef(highlightedIndex);
  highlightedIndexRef.current = highlightedIndex;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  React.useImperativeHandle(ref, () => ({
    focus: () => triggerRef.current?.focus(),
  }));

  const open = useCallback(() => {
    if (disabled) return;
    const idx = options.findIndex(o => o.value === value);
    setHighlightedIndex(idx >= 0 ? idx : 0);
    // Capture trigger position for portal-rendered dropdown
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  }, [disabled, options, value]);

  const close = useCallback(() => {
    setIsOpen(false);
    // Return focus to trigger after closing
    triggerRef.current?.focus();
  }, []);

  const confirm = useCallback((index: number) => {
    const opt = optionsRef.current[index];
    if (opt) onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [onChange]);

  // When dropdown first opens, center the selected item in the list
  useLayoutEffect(() => {
    if (!isOpen) return;
    const item = selectedItemRef.current;
    const list = listRef.current;
    if (item && list) {
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const targetScrollTop =
        list.scrollTop + (itemRect.top - listRect.top) - listRect.height / 2 + itemRect.height / 2;
      list.scrollTop = Math.max(0, targetScrollTop);
    }
  }, [isOpen]); // only on open, not on every highlight change

  // Scroll highlighted option into view while navigating
  useLayoutEffect(() => {
    if (!isOpen) return;
    const item = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]); // intentionally excludes isOpen to avoid fighting the centering

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, close]);

  // ── Input: closed + trigger focused → confirm opens, cancel exits ───────────
  // Keyboard and gamepad both arrive here as the same action, so there is one
  // description of what this widget does rather than one per input device.
  useInputActions({
    enabled: !isOpen && isTriggerFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    // Focus-derived claim: valid only while focus is actually on the trigger.
    focusScope: () => containerRef.current,
    onConfirm: open,
    onCancel: () => onEscape?.(),
  });

  // ── Input: open → navigate / confirm / cancel ───────────────────────────────
  // captureInput (not captureGamepad): this widget no longer keeps a private
  // keyboard handler, so the same exclusive claim must cover both devices.
  // Under captureGamepad only the gamepad was routed here and the keyboard was
  // left to a duplicate onKeyDown below — the two copies were free to drift,
  // and papering over the resulting double-fire is what justKeydownHandledRef
  // used to do.
  useInputActions({
    enabled: isOpen,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    // The open list keeps focus on the trigger, so the container still scopes it.
    focusScope: () => containerRef.current,
    onNavigate: (dir) => {
      if (dir === 'up') {
        setHighlightedIndex(i => (i > 0 ? i - 1 : optionsRef.current.length - 1));
      } else if (dir === 'down') {
        setHighlightedIndex(i => (i < optionsRef.current.length - 1 ? i + 1 : 0));
      }
    },
    onTabForward: () => {
      setHighlightedIndex(i => (i < optionsRef.current.length - 1 ? i + 1 : 0));
    },
    onTabBackward: () => {
      setHighlightedIndex(i => (i > 0 ? i - 1 : optionsRef.current.length - 1));
    },
    onConfirm: () => confirm(highlightedIndexRef.current),
    onCancel: close,
  });

  // No behaviour lives here any more — it all arrives as an action from the
  // hooks above. Two things still need handling at the DOM level:
  //
  // 1. The trigger is a real <button>, so the browser natively activates it on
  //    Enter/Space (firing onClick). The hooks already turn those keys into
  //    confirm/cancel, so letting both run means a single Enter press opens the
  //    dropdown via the native click and then immediately confirms it closed on
  //    keyup. Suppressing the browser's duplicate activation is all that is
  //    needed; the widget's behaviour stays in one place.
  // 2. Arrow keys while CLOSED are deliberately not claimed by the hooks, so
  //    they fall through to the parent for between-item navigation, as before.
  //
  // Enter/Escape/Space are otherwise absent on purpose. Space used to confirm
  // here, but useInputActions groups plain Space with Escape/cancel
  // (equivalently gamepad B) app-wide, and following that convention is the
  // point of routing through it.
  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return; }
    if (isOpen) return;   // while open, the hooks own every key
    onKeyDown?.(e);
  }, [isOpen, onKeyDown]);

  const currentLabel = options.find(o => o.value === value)?.label ?? value;

  return (
    <div ref={containerRef} className={classNames('relative', className ?? '')}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
        onFocus={(e) => {
          setIsTriggerFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsTriggerFocused(false);
          if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            onBlur?.(e);
          }
        }}
        className={classNames(
          'w-full flex items-center justify-between gap-2',
          compact ? 'px-2 py-0.5 rounded border text-[11px]' : 'px-2 py-1 sm:px-3 sm:py-2 rounded sm:rounded-md border text-xs sm:text-sm',
          'text-left transition-colors focus:outline-none focus:ring-2',
          isOpen
            ? `border-blue-400 ring-2 ring-blue-400 ${transparent ? 'bg-white/80 dark:bg-gray-800/70' : 'bg-white dark:bg-gray-800'}`
            : `${transparent ? 'border-gray-200/70 dark:border-gray-600/60 bg-white/70 dark:bg-gray-800/60' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}`,
          'text-gray-900 dark:text-gray-100',
          'hover:border-blue-400 dark:hover:border-blue-500',
          'focus:ring-blue-400 focus:border-blue-400',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={currentLabel ? '' : 'text-gray-400 dark:text-gray-500'}>
          {currentLabel || placeholder}
        </span>
        <ChevronDown
          className={classNames(
            'w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-150',
            isOpen ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Dropdown list — portal-rendered so it escapes overflow:hidden card boundaries */}
      {isOpen && dropdownPos && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className={classNames(
            'max-h-60 overflow-y-auto',
            'rounded-md border border-gray-200 dark:border-gray-600',
            'bg-white dark:bg-gray-800 shadow-lg',
            'py-1',
          )}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                ref={isSelected ? selectedItemRef : undefined}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); confirm(i); }}
                className={classNames(
                  'px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm cursor-pointer select-none',
                  i === highlightedIndex
                    ? 'bg-blue-500 text-white'
                    : isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {opt.label ?? opt.value}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
});

SelectInput.displayName = 'SelectInput';
