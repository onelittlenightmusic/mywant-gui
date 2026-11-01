import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { classNames } from '@/utils/helpers';

interface CommitInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  /** Use semi-transparent background (bg-white/70) so card background icons show through */
  transparent?: boolean;
}

/**
 * An input component that only commits its value when the user presses Enter.
 * Highlights in yellow when there are uncommitted changes.
 * When multiline=true, renders a vertically resizable textarea instead.
 */
export interface CommitInputHandle {
  commit: () => void;
  getValue: () => string;
  focus: () => void;
  /** Move the cursor / selection to the end of the current value */
  setCursorToEnd: () => void;
}

export const CommitInput = React.forwardRef<CommitInputHandle, CommitInputProps>(({
  value,
  onChange,
  className,
  onKeyDown,
  onBlur,
  onFocus: onFocusProp,
  hint,
  multiline = false,
  transparent = false,
  ...props
}, ref) => {
  const [localValue, setLocalValue] = useState<string>(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * While a word is being composed (Japanese: なかの → Space → 中野) the
   * field's look stays as it was. WebKit (the Mac and iPhone app's web view)
   * settles the word wrongly when a field is restyled mid-composition, and the
   * first letter of a word would turn it to "changed" yellow. Its value still
   * follows every keystroke: a field whose value stood still while the text
   * moved was set back each time by React, the composing reading wiped from it.
   */
  const composing = useRef(false);
  const typed = (v: string) => setLocalValue(v);
  const compositionProps = {
    onCompositionStart: () => { composing.current = true; },
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composing.current = false;
      setLocalValue(e.currentTarget.value);
    },
  };

  // Sync local value when prop value changes (unless focused)
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(value));
    }
  }, [value, isFocused]);

  const hasChanges = localValue !== String(value);

  // Expose methods to parent via ref
  React.useImperativeHandle(ref, () => ({
    commit: () => {
      if (hasChanges) {
        onChange(localValue);
      }
    },
    getValue: () => localValue,
    focus: () => {
      if (multiline) {
        textareaRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    },
    setCursorToEnd: () => {
      const el = multiline ? textareaRef.current : inputRef.current;
      if (el) {
        const len = el.value.length;
        try { el.setSelectionRange(len, len); } catch { /* number inputs don't support selection */ }
      }
    },
  }));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // The input method's Enter, settling a word, is not a commit: WebKit sends
    // it after the composition has ended, without isComposing but as keyCode
    // 229 — taken as one, it cancelled the word going in and left the field.
    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229)) {
      return;
    }
    if (e.key === 'Enter') {
      if (multiline) {
        if (e.shiftKey) {
          // Shift+Enter in textarea = newline, let default behavior happen
          return;
        }
        // Enter (without Shift) in textarea = commit, never insert newline
        e.preventDefault();
        if (hasChanges) {
          onChange(localValue);
        }
        textareaRef.current?.blur();
      } else {
        // Single-line input: Enter commits if changes, else bubbles up for form submit
        if (hasChanges) {
          e.preventDefault();
          onChange(localValue);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLocalValue(String(value));
      if (multiline) {
        textareaRef.current?.blur();
      } else {
        inputRef.current?.blur();
      }
    }

    if (onKeyDown) {
      onKeyDown(e as KeyboardEvent<HTMLInputElement>);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsFocused(false);
    // Auto-commit on blur for textarea so changes aren't lost when navigating away
    if (multiline && hasChanges) {
      onChange(localValue);
    }
    if (onBlur) {
      onBlur(e as React.FocusEvent<HTMLInputElement>);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsFocused(true);
    onFocusProp?.(e as React.FocusEvent<HTMLInputElement>);
  };

  // Not restyled while a word is composed (see `composing`).
  const looksChanged = hasChanges && !composing.current;
  const sharedClassName = classNames(
    'w-full px-2 py-1 sm:px-3 sm:py-2 border rounded sm:rounded-md focus:outline-none focus:ring-2 transition-colors text-xs sm:text-sm',
    looksChanged
      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600 focus:ring-yellow-400 text-gray-900 dark:text-gray-100'
      : transparent
        ? 'bg-white/70 dark:bg-gray-800/60 border-gray-200/70 dark:border-gray-600/60 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100'
        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100',
    className
  );

  return (
    <div className="relative flex-1">
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => typed(e.target.value)}
          {...compositionProps}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          onFocus={handleFocus}
          onBlur={handleBlur as React.FocusEventHandler<HTMLTextAreaElement>}
          placeholder={props.placeholder}
          disabled={props.disabled}
          rows={2}
          className={classNames(sharedClassName, 'resize-y min-h-[2.5rem]')}
        />
      ) : (
        <input
          {...props}
          ref={inputRef}
          value={localValue}
          onChange={(e) => typed(e.target.value)}
          {...compositionProps}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLInputElement>}
          onFocus={handleFocus}
          onBlur={handleBlur as React.FocusEventHandler<HTMLInputElement>}
          className={sharedClassName}
        />
      )}
      {looksChanged && (
        <div className="absolute right-2 -top-5 text-[10px] font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded shadow-sm border border-yellow-200 pointer-events-none animate-in fade-in slide-in-from-bottom-1">
          {hint ?? (multiline ? 'Enter to commit / Shift+Enter for newline' : 'Enter to commit')}
        </div>
      )}
    </div>
  );
});

CommitInput.displayName = 'CommitInput';
