import React from 'react';
import { BellRing, MessageCircle } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { FIELD_CARD_SURFACE } from '@/design/cards';
import type { TimingDef } from '@/types/wantType';
import type { VoiceSpec } from '@/types/want';

/** The labels a want chose its timings in before spec.voice — still read when
 *  it has none, and let go when it is set (engine core/result_timings.go). */
const MURMUR = 'murmur';
const NOTIFY = 'notify';

/**
 * When the want tells of its answer: each of its type's timings (a song
 * changing, the album changing, coming near a saved place), with whether the
 * want murmurs at it (its tile's "!") and notifies at it (a push). Written to
 * the want's spec.voice — { murmur: [names], notify: [names] }, an empty list
 * for none; with neither written, the type's own say — shown, and a press
 * makes it the want's own.
 */
export const TimingsSection: React.FC<{
  timings: TimingDef[];
  voice: VoiceSpec | undefined;
  /** A want's choice as labels held it before spec.voice. */
  labels: Record<string, string>;
  /** The new voice (undefined: back to the type's say). */
  onChange: (voice: VoiceSpec | undefined) => void;
}> = ({ timings, voice, labels, onChange }) => {
  const chosen = (list: string[] | undefined, key: string, byDefault: (t: TimingDef) => boolean): Set<string> => {
    if (list) return new Set(list);
    const raw = labels[key]?.trim();
    if (!raw) return new Set(timings.filter(byDefault).map(t => t.name));
    const out = new Set<string>();
    for (const name of raw.split(',').map(s => s.trim())) {
      if (name === 'all') timings.forEach(t => out.add(t.name));
      else if (name && name !== 'none') out.add(name);
    }
    return out;
  };
  const murmurAt = chosen(voice?.murmur, MURMUR, t => !!t.murmur);
  const notifyAt = chosen(voice?.notify, NOTIFY, t => !!t.notify);

  const toggle = (key: 'murmur' | 'notify', set: Set<string>, name: string) => {
    const next = new Set(set);
    if (next.has(name)) next.delete(name); else next.add(name);
    // In the type's order, so the list reads as the section does. Both lists
    // written, so what is shown is what the want holds.
    const ordered = (s: Set<string>) => timings.map(t => t.name).filter(n => s.has(n));
    onChange({
      murmur: ordered(key === 'murmur' ? next : murmurAt),
      notify: ordered(key === 'notify' ? next : notifyAt),
    });
  };
  const reset = () => onChange(undefined);
  const own = !!voice || MURMUR in labels || NOTIFY in labels;

  const cell = (on: boolean, Icon: React.ElementType, label: string, press: () => void) => (
    <button
      type="button"
      onClick={press}
      aria-pressed={on}
      title={label}
      className={classNames(
        'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
        on
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-2">
      {timings.map(t => (
        <div key={t.name} className={classNames('flex items-center gap-2 rounded-lg px-2.5 py-2', FIELD_CARD_SURFACE)}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.description || t.name}</div>
            <div className="text-[10px] font-mono text-gray-400 truncate">
              {t.name}{t.onChange ? ` · onChange ${t.onChange}` : ''}{t.onIncrease ? ` · onIncrease ${t.onIncrease}` : ''}{t.onDecrease ? ` · onDecrease ${t.onDecrease}` : ''}{t.if ? ` · if ${t.if}` : ''}
            </div>
          </div>
          {cell(murmurAt.has(t.name), MessageCircle, 'つぶやく', () => toggle('murmur', murmurAt, t.name))}
          {cell(notifyAt.has(t.name), BellRing, '通知', () => toggle('notify', notifyAt, t.name))}
        </div>
      ))}
      <div className="flex justify-end text-[11px] text-gray-400">
        {own ? (
          <button type="button" onClick={reset} className="underline hover:text-gray-600 dark:hover:text-gray-300">
            type の既定に戻す
          </button>
        ) : (
          <span>type の既定どおり</span>
        )}
      </div>
    </div>
  );
};
