import React from 'react';

/**
 * A setting whose choices are a scale, drawn as one.
 *
 * Pills are right for a set of alternatives — light, dark, system are three
 * different answers. They are wrong for small/medium/large and 1×/2×/3×, which
 * are one answer at three strengths: laid out as pills, the reader has to
 * notice the order before the row means anything, and there is nothing to say
 * which way is "more". A track says it.
 *
 * The value is an index into `options`, so the caller keeps its own domain
 * (a string size, a number multiplier) and this never has to know about it.
 * Applies on release AND on drag, because these are looks you are trying on —
 * seeing it move is most of how you decide.
 */

/** Thumb diameter, matched to .mw-setting-slider's — the ticks have to know it
 *  to line up with where the thumb can actually stop. */
const THUMB = 14;

export interface SliderOption<T> {
  value: T;
  /** Shown under the track when this step is the one selected. */
  label: string;
  /** Shown beside the label; the row of settings all carry one. */
  icon?: React.ReactNode;
}

interface Props<T> {
  title: string;
  titleIcon?: React.ReactNode;
  options: SliderOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SettingSlider<T extends string | number>({
  title, titleIcon, options, value, onChange,
}: Props<T>) {
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const current = options[index];
  const max = options.length - 1;

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
        {titleIcon}{title}
      </p>
      <div className="flex items-center gap-2">
        {/* The track and its ticks share one box, so the ticks are spread across
            the track rather than across the row. They were siblings of the whole
            row before, which spread them under the label as well and left every
            tick short of the step it marks. */}
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={max}
            step={1}
            value={index}
            onChange={e => onChange(options[Number(e.target.value)].value)}
            data-free-cursor-item
            className="mw-setting-slider w-full block"
            aria-label={title}
          />
          {/* Inset by half a thumb: the thumb's CENTRE travels from 7px to
              width-7px, never to the very edge, so ticks flush with the ends
              would sit outside the range they are marking. */}
          <div className="flex justify-between mt-0.5" style={{ paddingLeft: THUMB / 2, paddingRight: THUMB / 2 }}>
            {options.map((o, i) => (
              <span
                key={String(o.value)}
                className={i === index
                  ? 'w-1 h-1 rounded-full bg-indigo-500'
                  : 'w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600'}
                // Each dot is 4px wide, so its own half has to come back off or
                // the row is 4px wider than the travel it describes.
                style={{ marginLeft: i === 0 ? -2 : 0, marginRight: i === options.length - 1 ? -2 : 0 }}
              />
            ))}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 min-w-[5.5rem] text-xs font-medium text-indigo-600 dark:text-indigo-300">
          {current?.icon}{current?.label}
        </span>
      </div>
    </div>
  );
}

SettingSlider.displayName = 'SettingSlider';
