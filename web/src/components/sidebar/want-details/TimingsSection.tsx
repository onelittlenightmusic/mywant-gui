import React from 'react';
import { BellRing, MessageCircle, BellOff } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { FIELD_CARD_SURFACE } from '@/design/cards';
import type { TimingDef } from '@/types/wantType';
import type { VoiceSpec } from '@/types/want';
import { TimingCube } from '@/components/common/TimingCube';
import { solidTypeColor } from '@/components/dashboard/WantCardFace';

/** The labels a want chose its timings in before spec.voice — still read when
 *  it has none, and let go when it is set (engine core/result_timings.go). */
const MURMUR = 'murmur';
const NOTIFY = 'notify';

/** How a want tells of its answer at a timing: not at all, a murmur on the
 *  board, or a murmur that also goes to the devices as their notification
 *  (one and the same, by one id: read on the board, gone from the devices). */
type Telling = 'none' | 'murmur' | 'notify';

/**
 * When the want tells of its answer: each of its type's timings (a song
 * changing, the album changing, coming near a saved place), each told in one
 * of three ways — なし, つぶやき (its tile's "♪"), つぶやき＋通知 (and the
 * devices' notification). Written to the want's spec.voice — { murmur:
 * [names], notify: [names] }, notify always within murmur; with neither
 * written, the type's own say — shown, and a press makes it the want's own.
 */
export const TimingsSection: React.FC<{
  timings: TimingDef[];
  voice: VoiceSpec | undefined;
  /** A want's choice as labels held it before spec.voice. */
  labels: Record<string, string>;
  /** The new voice (undefined: back to the type's say). */
  onChange: (voice: VoiceSpec | undefined) => void;
  /** The want's type and its category: each timing's cube is in its colour. */
  typeName?: string;
  category?: string;
}> = ({ timings, voice, labels, onChange, typeName, category }) => {
  const cubeColor = solidTypeColor(typeName ?? '', category ?? '');
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

  // A notice is a murmur too: notified at a timing is told as both.
  const tellingAt = (name: string): Telling =>
    notifyAt.has(name) ? 'notify' : murmurAt.has(name) ? 'murmur' : 'none';

  const choose = (name: string, telling: Telling) => {
    const murmur = new Set(murmurAt);
    const notify = new Set(notifyAt);
    murmur.delete(name);
    notify.delete(name);
    if (telling !== 'none') murmur.add(name);
    if (telling === 'notify') notify.add(name);
    // Notified ones are murmured too, wherever they came from (labels).
    notify.forEach(n => murmur.add(n));
    // In the type's order, so the list reads as the section does. Both lists
    // written, so what is shown is what the want holds.
    const ordered = (set: Set<string>) => timings.map(t => t.name).filter(n => set.has(n));
    onChange({ murmur: ordered(murmur), notify: ordered(notify) });
  };
  const reset = () => onChange(undefined);
  const own = !!voice || MURMUR in labels || NOTIFY in labels;

  const choices: Array<{ telling: Telling; label: string; Icon: React.ElementType }> = [
    { telling: 'none', label: 'なし', Icon: BellOff },
    { telling: 'murmur', label: 'つぶやき', Icon: MessageCircle },
    { telling: 'notify', label: '＋通知', Icon: BellRing },
  ];
  // One pill, three ways: なし / つぶやき / つぶやき＋通知.
  const pill = (name: string) => {
    const at = tellingAt(name);
    return (
      <div role="radiogroup" aria-label="伝え方"
        className="shrink-0 inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
        {choices.map(({ telling, label, Icon }) => {
          const on = at === telling;
          return (
            <button
              key={telling}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(name, telling)}
              title={telling === 'notify' ? 'つぶやき＋通知' : label}
              className={classNames(
                'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
                on
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {timings.map(t => (
        <div key={t.name} className={classNames('flex items-center gap-2 rounded-lg px-2.5 py-2', FIELD_CARD_SURFACE)}>
          <TimingCube icon={t.icon} color={cubeColor} size={32} title={t.description || t.name} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.description || t.name}</div>
            <div className="text-[10px] font-mono text-gray-400 truncate">
              {t.name}{t.onChange ? ` · onChange ${t.onChange}` : ''}{t.onIncrease ? ` · onIncrease ${t.onIncrease}` : ''}{t.onDecrease ? ` · onDecrease ${t.onDecrease}` : ''}{t.if ? ` · if ${t.if}` : ''}
            </div>
          </div>
          {pill(t.name)}
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
