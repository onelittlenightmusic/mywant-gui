import React from 'react';
import { classNames } from '@/utils/helpers';
import { SliderDefaultMarks } from './SliderDefaultMarks';

export interface NumberSliderInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  isDirty?: boolean;
  /** Label on the left of the value row. Omit when the caller shows the name elsewhere. */
  label?: string;
  /** Stop click/change event propagation (needed inside want cards) */
  stopPropagation?: boolean;
  className?: string;
  /** Aura-default value marks (downward triangles) placed along the track */
  marks?: { color: string; value: number }[];
  /** Drop the built-in text sizes so the surrounding context decides them.
   *  Want cards set one size for all their content (CARD_CONTENT_SIZE); the
   *  sidebar and parameter forms keep the fixed sizes below. */
  inheritFontSize?: boolean;
}

export const NumberSliderInput: React.FC<NumberSliderInputProps> = ({
  value, min, max, step = 1, onChange,
  isDirty = false, label, stopPropagation = false, className, marks,
  inheritFontSize = false,
}) => {
  const stop = (e: React.SyntheticEvent) => { if (stopPropagation) e.stopPropagation(); };
  const size = (cls: string) => (inheritFontSize ? '' : cls);

  return (
    <div className={classNames('space-y-1', className)}>
      <div className={classNames('relative flex items-center justify-between text-gray-500 dark:text-gray-400', size('text-xs'))}>
        {label !== undefined && (
          <span className="font-medium truncate mr-2">{label}</span>
        )}
        <span className={classNames(
          'font-mono tabular-nums font-semibold', size('text-sm'),
          label === undefined ? 'ml-auto' : '',
          isDirty ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200',
        )}>
          {value}
        </span>
        {isDirty && (
          <div className={classNames('absolute right-0 -top-5 font-medium text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded shadow-sm border border-yellow-200 pointer-events-none', size('text-[10px]'))}>
            OK?
          </div>
        )}
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => { stop(e); onChange(Number(e.target.value)); }}
          onClick={stop}
          className={classNames(
            'w-full h-2 rounded-lg appearance-none cursor-pointer accent-sky-500',
            isDirty ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-gray-200 dark:bg-gray-700',
          )}
        />
        {marks && marks.length > 0 && (
          <SliderDefaultMarks
            marks={marks.map(m => ({
              color: m.color,
              percent: max === min ? 0 : ((m.value - min) / (max - min)) * 100,
            }))}
          />
        )}
      </div>
      <div className={classNames('flex justify-between text-gray-400 dark:text-gray-500', size('text-[10px]'))}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};
