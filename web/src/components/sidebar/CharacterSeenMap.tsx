import React from 'react';
import type { CharacterSeen } from '@/api/client';
import type { Character } from '@/types/character';
import { classNames } from '@/utils/helpers';

/**
 * 見たことのマップ: the board around a character as they have seen it today
 * (GET /characters/{id}/seen). A cell they have not seen is fog; a tile they
 * saw keeps the mood of what they heard from it, faint when it is out of
 * their sight now; other characters show only where they see them now.
 */

/** The cells shown, centred on where they stand. */
const COLS = 9;
const ROWS = 5;

export const MOOD_HEX: Record<string, string> = {
  joy: '#fbbf24', eager: '#0ea5e9', calm: '#10b981',
  waiting: '#8b5cf6', worried: '#f97316', sad: '#94a3b8',
};

const FOG = 'repeating-linear-gradient(45deg, rgba(148,163,184,0.18) 0 3px, transparent 3px 7px)';

export const CharacterSeenMap: React.FC<{ character: Character; seen: CharacterSeen }> = ({ character, seen }) => {
  // Centred on where they stand, else where they were seen last.
  const last = seen.seen.reduce<{ x: number; y: number; at: string } | null>((a, c) => (!a || c.at > a.at ? c : a), null);
  const centre = seen.now ?? (last ? { x: last.x, y: last.y } : null);
  if (!centre) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">今日はまだ盤面に出ていません。</p>;
  }
  const seenAt = new Map(seen.seen.map(c => [`${c.x},${c.y}`, c.at]));
  const tileAt = new Map(seen.tiles.map(t => [`${t.x},${t.y}`, t]));
  const otherAt = new Map(seen.others.map(o => [`${o.x},${o.y}`, o]));
  const x0 = centre.x - Math.floor(COLS / 2);
  const y0 = centre.y - Math.floor(ROWS / 2);
  const ring = MOOD_HEX[seen.mood] ?? MOOD_HEX.calm;

  const cells: React.ReactNode[] = [];
  for (let y = y0; y < y0 + ROWS; y++) {
    for (let x = x0; x < x0 + COLS; x++) {
      const key = `${x},${y}`;
      const at = seenAt.get(key);
      const tile = tileAt.get(key);
      const other = otherAt.get(key);
      const me = seen.now && seen.now.x === x && seen.now.y === y;
      const time = at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const title = !at ? 'まだ見ていない'
        : [tile && `${tile.name}${tile.say ? `「${tile.say}」` : ''}`, other && other.name, me && character.name, `${time}に見た`]
          .filter(Boolean).join(' · ');
      cells.push(
        <div key={key} title={title}
          className={classNames('relative aspect-square rounded-[3px]', at ? 'bg-gray-50 dark:bg-gray-800/60' : 'bg-gray-100/60 dark:bg-gray-900/60')}
          style={at ? undefined : { backgroundImage: FOG }}>
          {tile && (
            <div className={classNames(
              'absolute inset-[2px] rounded-[3px] flex items-center justify-center overflow-hidden',
              'text-[8px] leading-none font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700',
              !tile.now && 'opacity-45',
            )}
              style={{ border: `1.5px solid ${tile.mood ? MOOD_HEX[tile.mood] ?? '#cbd5e1' : '#cbd5e1'}`, borderStyle: tile.kind === 'thing' ? 'dashed' : 'solid' }}>
              <span className="truncate px-[1px]">{tile.name.slice(0, 3)}</span>
            </div>
          )}
          {other && !me && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px]"
              style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,.35))' }}>{other.avatar || '🙂'}</div>
          )}
          {me && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-[82%] w-[82%] rounded-full flex items-center justify-center text-[13px] bg-white dark:bg-gray-900"
                style={{ boxShadow: `0 0 0 2px ${ring}, 0 0 6px ${ring}` }}>
                {character.avatar || '🙂'}
              </div>
            </div>
          )}
        </div>,
      );
    }
  }

  return (
    <div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>{cells}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundImage: FOG }} />まだ見ていない</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-gray-300 opacity-45" />今は見えない</span>
        <span>枠の色: 聞いたときの気分</span>
      </div>
    </div>
  );
};
