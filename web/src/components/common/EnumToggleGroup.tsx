import React, {
  useRef, useCallback, useEffect,
  useImperativeHandle, forwardRef, useState,
} from 'react';
import { useInputActions } from '@/hooks/useInputActions';
import { DogEarFlags } from './DogEarFlags';
import { DogEarBookmarks } from './DogEarBookmarks';

export interface EnumToggleGroupOption {
  value: string;
  label?: string;
  /** Optional Lucide-compatible icon component rendered before the label */
  icon?: React.ComponentType<{ className?: string }>;
}

export interface EnumToggleGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: EnumToggleGroupOption[];
  className?: string;
  disabled?: boolean;
  /** When true, pills wrap to multiple rows and long labels break at ~10 chars (max 4 lines). */
  wrap?: boolean;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** When true, cursor ring is shown even without DOM focus (e.g. gamepad inner-focus mode). */
  showCursor?: boolean;
  /** Fired whenever the navigation cursor lands on a different option (not necessarily selected/confirmed). */
  onCursorChange?: (value: string) => void;
  /** Per-option mark colors (e.g. characters who marked this option as their default), keyed by option value. */
  getMarkColors?: (value: string) => string[];
  /** Badge shape for getMarkColors — 'flag' (default, folded-corner dog-ear) or 'star'. */
  markStyle?: 'flag' | 'star';
  /** x/X key or gamepad X button, fired while a pill has native DOM focus (gamepad path — see the parent's own useInputActions for the keyboard path). */
  onButtonX?: () => void;
}

export interface EnumToggleGroupHandle {
  focus: () => void;
  moveCursor: (dir: 'left' | 'right') => void;
  confirm: () => void;
}

/**
 * Segmented-control toggle switch for enum parameters.
 *
 * Selected option has blue background + shadow directly on the button.
 * Centered within its parent. Mouse/touch drag-scrollable when options overflow.
 *
 * Keyboard and gamepad both route through useInputActions, so behaviour is
 * described once in terms of actions rather than once per input device:
 *
 *   navigate left/right (←/→ / D-pad)  → move the cursor between pills
 *   confirm             (Enter / A)    → select the cursored pill
 *   cancel              (Esc / Space / B) → blur, handing focus back
 *   onButtonX           (x / X)        → e.g. mark this option as aura-default
 *
 * Anything not claimed above (↑/↓ …) falls through to the parent for
 * between-item navigation. Space cancels rather than selects: useInputActions
 * groups plain Space with Escape (equivalently gamepad B) across the app.
 */
export const EnumToggleGroup = forwardRef<EnumToggleGroupHandle, EnumToggleGroupProps>(({
  value,
  onChange,
  options,
  className,
  disabled = false,
  wrap = false,
  onFocus,
  onBlur,
  onKeyDown,
  showCursor = false,
  onCursorChange,
  getMarkColors,
  markStyle = 'flag',
  onButtonX,
}, ref) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const scrollRef     = useRef<HTMLDivElement>(null);
  const buttonRefs    = useRef<(HTMLButtonElement | null)[]>([]);

  // --- drag-to-scroll ---
  const dragActiveRef  = useRef(false);
  const dragStartX     = useRef(0);
  const dragStartScroll = useRef(0);
  const dragDistRef    = useRef(0);   // total px moved since mousedown

  const handleDragStart = useCallback((clientX: number) => {
    const el = scrollRef.current;
    if (!el) return;
    dragActiveRef.current  = true;
    dragStartX.current     = clientX;
    dragStartScroll.current = el.scrollLeft;
    dragDistRef.current    = 0;
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!dragActiveRef.current || !scrollRef.current) return;
    const dx = clientX - dragStartX.current;
    dragDistRef.current = Math.abs(dx);
    scrollRef.current.scrollLeft = dragStartScroll.current - dx;
  }, []);

  const handleDragEnd = useCallback(() => {
    dragActiveRef.current = false;
  }, []);

  // Mouse events on scroll zone
  const onMouseDown  = useCallback((e: React.MouseEvent) => { handleDragStart(e.clientX); }, [handleDragStart]);
  const onMouseMove  = useCallback((e: React.MouseEvent) => { handleDragMove(e.clientX); }, [handleDragMove]);
  const onMouseUp    = useCallback(() => { handleDragEnd(); }, [handleDragEnd]);
  const onMouseLeave = useCallback(() => { handleDragEnd(); }, [handleDragEnd]);

  // Touch events on scroll zone
  const onTouchStart = useCallback((e: React.TouchEvent) => { handleDragStart(e.touches[0].clientX); }, [handleDragStart]);
  const onTouchMove  = useCallback((e: React.TouchEvent) => { handleDragMove(e.touches[0].clientX); }, [handleDragMove]);
  const onTouchEnd   = useCallback(() => { handleDragEnd(); }, [handleDragEnd]);

  // --- selection state ---
  const selectedIndex = options.findIndex(o => o.value === value);
  const [cursorIndex, setCursorIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const cursorIndexRef = useRef(cursorIndex);
  cursorIndexRef.current = cursorIndex;

  const [isFocused, setIsFocused] = useState(false);
  const isFocusedRef = useRef(false);
  isFocusedRef.current = isFocused;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;

  // Notify whenever the cursor lands on a different option (hover/keyboard/gamepad nav).
  useEffect(() => {
    const opt = optionsRef.current[cursorIndex];
    if (opt) onCursorChangeRef.current?.(opt.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorIndex]);

  // Sync cursor only when the selected value changes externally.
  // Intentionally omits `options` from deps — options reference changes on every
  // parent render even when content is identical, which would reset the cursor
  // position while the user is navigating.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const idx = optionsRef.current.findIndex(o => o.value === value);
    if (idx >= 0) setCursorIndex(idx);
  }, [value]);

  // Expose focus()
  useImperativeHandle(ref, () => ({
    focus: () => buttonRefs.current[cursorIndexRef.current]?.focus(),
    moveCursor: (dir: 'left' | 'right') => moveCursor(dir),
    confirm: () => { const opt = options[cursorIndexRef.current]; if (opt) onChange(opt.value); },
  }));

  const scrollIntoView = useCallback((index: number) => {
    buttonRefs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  const moveCursor = useCallback((dir: 'left' | 'right') => {
    setCursorIndex(prev => {
      const next = dir === 'right'
        ? Math.min(prev + 1, options.length - 1)
        : Math.max(prev - 1, 0);
      setTimeout(() => { buttonRefs.current[next]?.focus(); scrollIntoView(next); }, 0);
      return next;
    });
  }, [options.length, scrollIntoView]);

  // Keyboard + gamepad, described once as actions rather than once per device.
  //
  // captureInput (not captureGamepad): this widget no longer keeps a private
  // keyboard implementation, so the same exclusive claim has to cover both
  // devices. Under captureGamepad only the pad was routed here and the keyboard
  // ran a duplicate switch below — two copies of one behaviour, free to drift.
  useInputActions({
    enabled: isFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    // Focus-derived claim: the pills live inside this container.
    focusScope: () => containerRef.current,
    onNavigate: (dir) => {
      if (dir === 'left')  moveCursor('left');
      if (dir === 'right') moveCursor('right');
    },
    onConfirm: () => { const opt = optionsRef.current[cursorIndexRef.current]; if (opt) onChange(opt.value); },
    /**
     * Give the keys back to whatever this group is inside, rather than to
     * nobody.
     *
     * It used to be a bare blur, which lands focus on <body> — outside the
     * panel these pills usually live in. The panel then stops counting as
     * focused, its card grid's exclusive claim goes stale (a focus-derived
     * claim is only live while the focus is inside it), and the ring jumps up
     * to the panel's embedded card. Cancel is supposed to walk back one rung,
     * and a rung you fall off is not one.
     *
     * The nearest focusable ancestor is that rung: inside a card grid it is the
     * grid, which is exactly where B from a card's editor should land.
     */
    onCancel:  () => {
      buttonRefs.current[cursorIndexRef.current]?.blur();
      containerRef.current?.closest<HTMLElement>('[tabindex]')?.focus();
    },
    onButtonX: onButtonX,
  });

  // Only DOM-level concerns remain here; the behaviour lives in the hook above.
  //
  // Each pill is a real <button>, so the browser natively activates it on
  // Enter/Space and fires onClick — which would select on top of the hook's own
  // confirm, firing onChange twice for one press. Suppress the browser's
  // duplicate activation and let the action pipeline do the work.
  //
  // Everything the hook does not claim (Up/Down, Escape, …) still falls through
  // to the parent for between-item navigation, exactly as before. Note plain
  // Space now cancels rather than selects: useInputActions groups it with
  // Escape / gamepad B app-wide.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); return; }
    onKeyDown?.(e);
  }, [onKeyDown]);

  const handleButtonFocus = useCallback((e: React.FocusEvent, index: number) => {
    setCursorIndex(index);
    if (!isFocusedRef.current) { setIsFocused(true); onFocus?.(e); }
  }, [onFocus]);

  const handleButtonBlur = useCallback((e: React.FocusEvent) => {
    const rel = e.relatedTarget as Node | null;
    if (!rel || !containerRef.current?.contains(rel)) {
      setIsFocused(false);
      onBlur?.(e);
    }
  }, [onBlur]);

  const pills = options.map((opt, index) => {
    const isSelected = opt.value === value;
    const isCursor   = index === cursorIndex && (isFocused || showCursor);
    const OptIcon    = opt.icon;
    const markColors = getMarkColors?.(opt.value) ?? [];

    return (
      <button
        key={opt.value}
        ref={el => { buttonRefs.current[index] = el; }}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (dragDistRef.current > 4) return;
          setCursorIndex(index);
          onChange(opt.value);
        }}
        onMouseEnter={() => setCursorIndex(index)}
        onFocus={e => handleButtonFocus(e, index)}
        onBlur={handleButtonBlur}
        onKeyDown={handleKeyDown}
        className={[
          'relative flex items-center gap-1 px-2.5 py-1 text-xs rounded-xl',
          'focus:outline-none transition-all duration-150',
          wrap ? 'flex-shrink-0 text-center break-words' : 'flex-shrink-0 whitespace-nowrap',
          isSelected
            ? 'bg-blue-500 dark:bg-blue-600 text-white font-medium shadow-sm'
            : isCursor
              ? 'bg-blue-200 dark:bg-blue-700/50 text-blue-700 dark:text-blue-200'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-transparent',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].filter(Boolean).join(' ')}
        style={wrap ? { maxWidth: '5.5rem' } : undefined}
      >
        {OptIcon && <OptIcon className="w-3 h-3 flex-shrink-0" />}
        {wrap ? (
          <span style={{
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-all',
          }}>
            {opt.label ?? opt.value}
          </span>
        ) : (opt.label ?? opt.value)}
        {markStyle === 'star'
          ? <DogEarBookmarks colors={markColors} size={9} />
          : <DogEarFlags colors={markColors} size={9} />}
      </button>
    );
  });

  return (
    // Outer: full-width, clips overflow so inner can scroll
    <div
      ref={containerRef}
      className={`w-full overflow-hidden ${className ?? ''}`}
    >
      {/* Scroll zone: drag-scrollable, hides scrollbar */}
      <div
        ref={scrollRef}
        className="overflow-x-auto select-none"
        style={{ scrollbarWidth: 'none', cursor: dragActiveRef.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Track: fit-content pill; mx-auto centers when fits, left-aligns when scrollable */}
        <div className="flex rounded-2xl bg-gray-100 dark:bg-gray-700/60 p-0.5 gap-0 w-fit mx-auto">
          {pills}
        </div>
      </div>
    </div>
  );
});

EnumToggleGroup.displayName = 'EnumToggleGroup';
