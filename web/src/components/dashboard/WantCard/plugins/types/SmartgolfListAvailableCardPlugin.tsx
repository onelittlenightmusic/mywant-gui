import React from 'react';
import { ExternalLink } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { openWithGuide, type WebGuide } from '@/lib/webGuide';

/**
 * The open slots of every store watched, on one line of time running down:
 * at 10:00 these stores are free, at 10:30 those. The question is "when can I
 * go, and where", so time leads and the stores hang off it.
 *
 * Down, not across: a maximized card grows down, and a day's slots are many.
 * Each store in a row is the way to its booking page.
 */
interface Slot {
  room?: string;
  date?: string;
  time?: string;
  store?: string;
  url?: string;
  /** The way to this slot on its booking page (lib/webGuide): the room
   *  chosen, the time lit and the CursorMan on it. */
  goto?: WebGuide;
}

/** A store's colour, so the eye finds 北新宿 down the column without reading. */
const STORE_TONES = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
];

/** "北新宿店/右打席予約(Room01)" → "北新宿店" — a slot recorded before it carried its store. */
function storeOf(s: Slot): string {
  if (s.store) return s.store;
  const head = (s.room ?? '').split('/')[0].trim();
  return head || '?';
}

/** "2026-11-01" → "今日" / "明日" / "11/3". */
function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return '今日';
  if (days === 1) return '明日';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Row { time: string; stores: { store: string; url?: string; goto?: Slot['goto']; rooms: number }[] }
interface Day { date: string; rows: Row[] }

function timeline(slots: Slot[]): Day[] {
  const sorted = [...slots]
    .filter(s => s.date && s.time)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const days: Day[] = [];
  for (const s of sorted) {
    let day = days[days.length - 1];
    if (!day || day.date !== s.date) days.push(day = { date: s.date!, rows: [] });
    let row = day.rows[day.rows.length - 1];
    if (!row || row.time !== s.time) day.rows.push(row = { time: s.time!, stores: [] });
    const name = storeOf(s);
    const hit = row.stores.find(x => x.store === name);
    if (hit) hit.rooms += 1;
    // Two rooms free at one store and time are one chip; it goes to the first.
    else row.stores.push({ store: name, url: s.url, goto: s.goto, rooms: 1 });
  }
  return days;
}

const SmartgolfListAvailableContent: React.FC<WantCardPluginProps> = ({ want, isExpanded }) => {
  const cur = want.state?.current ?? {};
  const raw = cur.smartgolf_all_available_times ?? want.state?.final_result;
  const slots: Slot[] = Array.isArray(raw) ? raw : [];
  const days = timeline(slots);

  // The same store, the same colour, on every row.
  const stores = [...new Set(slots.map(storeOf))].sort();
  const tone = (store: string) => STORE_TONES[stores.indexOf(store) % STORE_TONES.length];

  /**
   * Straight to the store's booking page in a new tab, as the reserved card's
   * store name does — at the slot itself where the MyWant extension can take
   * it there (lib/webGuide) — and the press stopped, so the card under it does
   * not open its panel as well.
   */
  const open = (url: string, goto?: WebGuide) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openWithGuide(want.metadata?.id ?? '', url, goto);
  };

  const content = (
    <div
      className={`h-full flex flex-col gap-1 px-2.5 py-2 text-[12px] ${isExpanded ? 'overflow-y-auto' : 'overflow-hidden'}`}
      onMouseDown={isExpanded ? e => e.stopPropagation() : undefined}
    >
      {days.length === 0 && (
        <div className="text-gray-500 dark:text-gray-400">空きはありません</div>
      )}
      {days.map(day => (
        <div key={day.date} className="flex flex-col">
          <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mt-1 mb-0.5">{dayLabel(day.date)}</div>
          {day.rows.map((row, i) => (
            <div key={row.time} className="flex gap-2">
              {/* The time, on the line running down. */}
              <div className="w-10 flex-shrink-0 flex flex-col items-center">
                <span className="tabular-nums font-bold text-gray-800 dark:text-gray-200 leading-6">{row.time}</span>
                {i < day.rows.length - 1 && <span className="flex-1 w-0.5 bg-gray-400/40" />}
              </div>
              <div className="flex-1 min-w-0 flex flex-wrap gap-1 py-0.5 pb-1.5">
                {row.stores.map(s => {
                  const label = (
                    <>
                      {s.store}
                      {s.rooms > 1 && <span className="opacity-70">×{s.rooms}</span>}
                      {s.url && <ExternalLink className="w-3 h-3 opacity-50" />}
                    </>
                  );
                  const cls = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${tone(s.store)}`;
                  return s.url ? (
                    <button
                      key={s.store}
                      type="button"
                      data-inner-focus
                      title={`${s.store}の予約ページを開く`}
                      onClick={open(s.url, s.goto)}
                      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                      className={`${cls} hover:brightness-95 hover:underline`}
                    >
                      {label}
                    </button>
                  ) : (
                    <span key={s.store} className={cls}>{label}</span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['smartgolf_list_available'],
  ContentSection: SmartgolfListAvailableContent,
  hideFinalResult: true,
});
