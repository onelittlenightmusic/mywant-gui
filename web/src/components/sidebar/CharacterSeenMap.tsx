import React, { useLayoutEffect, useRef, useState } from 'react';
import type { CharacterSeen } from '@/api/client';
import type { Character } from '@/types/character';
import { Slot } from '@/extensions/Slot';
import { extensionSlot } from '@/extensions/registry';
import { useCharacterStore } from '@/stores/characterStore';
import { CharacterBadge } from '@/components/dashboard/CharacterBadge';

/**
 * 見たことのマップ: the board around a character as they have seen it today
 * (GET /characters/{id}/seen). The board itself is the extension's that has
 * one (the seenBoard slot: the canvas draws a window onto its own board, only
 * what they saw on it); this lays over it what is the character's — the
 * cells they have not seen (fog), those they saw but do not see now (a veil),
 * the mood of what they heard on a tile (a dot), and the characters, as the
 * board draws them. Without a board there is no map.
 */

/** The cells shown, centred on where they stand. */
const COLS = 13;
const ROWS = 7;

export const MOOD_HEX: Record<string, string> = {
  joy: '#fbbf24', eager: '#0ea5e9', calm: '#10b981',
  waiting: '#8b5cf6', worried: '#f97316', sad: '#94a3b8',
};

export const CharacterSeenMap: React.FC<{ character: Character; seen: CharacterSeen }> = ({ character, seen }) => {
  const characters = useCharacterStore(s => s.characters);
  const hasBoard = extensionSlot('seenBoard').length > 0;
  const placed = !!seen.now || seen.seen.length > 0;

  // One cell's width, in px, from the room the tab gives the map.
  const box = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setStep(el.clientWidth / COLS);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasBoard, placed]);

  if (!hasBoard) return null;
  // Centred on where they stand, else where they were seen last.
  const last = seen.seen.reduce<{ x: number; y: number; at: string } | null>((a, c) => (!a || c.at > a.at ? c : a), null);
  const centre = seen.now ?? (last ? { x: last.x, y: last.y } : null);
  if (!centre) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">今日はまだ盤面に出ていません。</p>;
  }
  const x0 = centre.x - Math.floor(COLS / 2);
  const y0 = centre.y - Math.floor(ROWS / 2);
  const seenAt = new Map(seen.seen.map(c => [`${c.x},${c.y}`, c.at]));
  const seesNow = (x: number, y: number) =>
    !!seen.now && Math.abs(x - seen.now.x) <= seen.radius && Math.abs(y - seen.now.y) <= seen.radius;
  const ring = MOOD_HEX[seen.mood] ?? MOOD_HEX.calm;
  const fogInk = 'rgba(148,163,184,0.30)';
  const fogImage = `repeating-linear-gradient(45deg, ${fogInk} 0 3px, transparent 3px 7px)`;
  const time = (at: string) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const at = (x: number, y: number): React.CSSProperties => ({ position: 'absolute', left: (x - x0) * step, top: (y - y0) * step });
  const byId = new Map(characters.map(c => [c.id, c]));

  // Not seen: fog. Seen, but out of sight now: a veil, so what is there is faint.
  const cover: React.ReactNode[] = [];
  for (let y = y0; y < y0 + ROWS; y++) {
    for (let x = x0; x < x0 + COLS; x++) {
      const when = seenAt.get(`${x},${y}`);
      if (when && seesNow(x, y)) continue;
      cover.push(
        <div key={`c-${x},${y}`} title={when ? `${time(when)}に見た` : 'まだ見ていない'}
          className={when ? 'bg-gray-50/55 dark:bg-gray-900/55' : 'bg-slate-100 dark:bg-slate-900'}
          style={{ ...at(x, y), width: step + 0.5, height: step + 0.5, backgroundImage: when ? undefined : fogImage }} />,
      );
    }
  }
  const face = (c: { avatar?: string; avatarImage?: string; shape?: string; color?: string }, size: number, key: string, x: number, y: number, title: string, glow?: string) => (
    <div key={key} title={title} className="flex items-center justify-center"
      style={{ ...at(x, y), width: step, height: step, zIndex: 3 }}>
      <CharacterBadge avatar={c.avatar || '🙂'} image={c.avatarImage} shape={c.shape} color={c.color || '#64748b'}
        size={size} strokeWidth={2.5} fontSize={size * 0.56}
        style={{ filter: `drop-shadow(0 2px 3px rgba(0,0,0,0.4))${glow ? ` drop-shadow(0 0 4px ${glow})` : ''}` }} />
    </div>
  );

  return (
    <div>
      <div ref={box} className="relative w-full overflow-hidden rounded-md bg-gray-50 dark:bg-gray-800/60"
        style={{ aspectRatio: `${COLS} / ${ROWS}` }}
        role="img" aria-label={`${character.name}が今日見たもの`}>
        {step > 0 && (
          <>
            <Slot name="seenBoard" x0={x0} y0={y0} cols={COLS} rows={ROWS} step={step} tiles={seen.tiles} />
            <div className="absolute inset-0" style={{ zIndex: 2 }}>
              {cover}
              {seen.tiles.filter(t => t.mood).map(t => (
                <span key={`m-${t.id}`} className="absolute rounded-full"
                  title={`${t.name}${t.say ? `「${t.say}」` : ''}`}
                  style={{
                    left: (t.x - x0 + 0.78) * step, top: (t.y - y0 + 0.04) * step, width: step * 0.2, height: step * 0.2,
                    background: MOOD_HEX[t.mood!] ?? MOOD_HEX.calm, boxShadow: '0 0 0 1.5px rgba(255,255,255,0.85)',
                  }} />
              ))}
            </div>
            {seen.others.map(o => {
              const c = byId.get(o.id);
              return face({ avatar: o.avatar, avatarImage: c?.avatarImage, shape: c?.shape, color: o.color ?? c?.color },
                step * 0.62, `o-${o.id}`, o.x, o.y, o.name);
            })}
            {seen.now && face(character, step * 0.78, 'me', seen.now.x, seen.now.y, character.name, ring)}
          </>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundImage: fogImage }} />まだ見ていない
        </span>
        <span>薄いところ: 今は見えない</span>
        <span>右上の点: 聞いたときの気分</span>
      </div>
    </div>
  );
};
