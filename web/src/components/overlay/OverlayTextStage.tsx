import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { OverlayCell } from './OverlayCell';
import { OVERLAY_STAGGER_MS, type OverlayTone } from './tones';
import { useOverlayDesign } from './design';

export interface OverlayTextStageProps {
  /** What is being asked for, over the field ("New constellation", "Say"). */
  header: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Enter, or the submit cell. Not called with an empty value. */
  onSubmit: (value: string) => void;
  /** Escape, or the back cell. */
  onBack: () => void;
  placeholder?: string;
  maxLength?: number;
  submitLabel?: string;
  submitIcon?: React.ReactNode;
  submitTone?: OverlayTone;
  backLabel?: string;
  /** Submitting is not possible right now (saving already, say). */
  busy?: boolean;
  /** Take the focus, with the text selected, when the stage opens. Default: true. */
  autoFocus?: boolean;
}

/**
 * An overlay stage that asks for a few words: a header, a field, and under it
 * two cells — back and submit — so a finger can answer what Enter and Escape
 * answer on a keyboard.
 *
 * Drawn as the grid is, cells and all, so going from a menu into typing
 * changes what is asked and not what the box looks like.
 */
export const OverlayTextStage: React.FC<OverlayTextStageProps> = ({
  header, value, onChange, onSubmit, onBack, placeholder, maxLength = 80,
  submitLabel = 'OK', submitIcon, submitTone = 'confirm', backLabel = 'Back', busy = false,
  autoFocus = true,
}) => {
  const design = useOverlayDesign();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 30);
    return () => clearTimeout(t);
  }, [autoFocus]);

  const canSubmit = !!value.trim() && !busy;
  const submit = () => { if (canSubmit) onSubmit(value); };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ animation: design.enterAnimation }}>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-3 pt-2">
        <span className={`${design.header} justify-center`}>{header}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // isComposing off the native event, not React state: the Enter that
            // confirms an IME conversion (typing in Japanese) must not also
            // submit, mid-word.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
            else if (e.key === 'Escape') { e.preventDefault(); onBack(); }
          }}
          placeholder={placeholder}
          maxLength={maxLength}
          className={design.input}
        />
      </div>
      <div className="flex-shrink-0 grid grid-cols-2 h-10">
        <OverlayCell icon={<ArrowLeft className="w-4 h-4 text-white" />} label={backLabel} title={`${backLabel} (Esc)`}
          tone="cancel" onClick={onBack} />
        <OverlayCell icon={submitIcon ?? <Check className="w-4 h-4 text-white" />} label={submitLabel} title={`${submitLabel} (Enter)`}
          tone={submitTone} onClick={submit} disabled={!canSubmit} delay={OVERLAY_STAGGER_MS} />
      </div>
    </div>
  );
};
