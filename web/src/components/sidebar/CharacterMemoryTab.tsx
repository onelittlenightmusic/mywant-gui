import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { apiClient, type CharacterMemory } from '@/api/client';
import type { Character } from '@/types/character';
import { TabContent, TabSection } from '@/components/sidebar/DetailsSidebar';
import { classNames } from '@/utils/helpers';

/**
 * 見たこと: what a character remembers hearing, and how they feel now.
 *
 * Wants murmur their news; a character standing near one hears it, and keeps
 * only what moved them — a few things at a time, the least moving forgotten
 * first (the server's character_memory.go). Their mood is the mood of what
 * moved them most, fading with time. This is all of it: nothing here is made
 * up from the board, only what they heard.
 */

/** How often it is read again: a murmur may come at any time. */
const POLL_MS = 15000;
/** How many they can remember at once (the server's memorySlots). */
const SLOTS = 5;

const MOOD_WORDS: Record<string, string> = {
  joy: 'うれしい', eager: 'はりきっている', calm: '落ち着いている',
  waiting: '待っている', worried: '気にしている', sad: 'しょんぼり',
};
const MOOD_DOT: Record<string, string> = {
  joy: 'bg-amber-400', eager: 'bg-sky-500', calm: 'bg-emerald-500',
  waiting: 'bg-violet-500', worried: 'bg-orange-500', sad: 'bg-slate-400',
};

/** "3分前", "2時間前", or the day and time when it is older. */
function ago(at: string, now: number): string {
  const t = Date.parse(at);
  if (Number.isNaN(t)) return '';
  const min = Math.round((now - t) / 60000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const CharacterMemoryTab: React.FC<{ character: Character }> = ({ character }) => {
  const [memory, setMemory] = useState<CharacterMemory | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    setMemory(null);
    setError('');
    const read = () => {
      apiClient.getCharacterMemory(character.id)
        .then(m => { if (live) { setMemory(m); setError(''); setNow(Date.now()); } })
        .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    };
    read();
    const t = setInterval(read, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, [character.id]);

  if (error && !memory) {
    return <TabContent><p className="text-sm text-red-600 dark:text-red-400">読めませんでした: {error}</p></TabContent>;
  }
  if (!memory) {
    return <TabContent><p className="text-sm text-gray-500 dark:text-gray-400">読み込み中…</p></TabContent>;
  }

  const mood = memory.mood || 'calm';
  const items = memory.memories ?? [];
  return (
    <TabContent>
      <TabSection title="いまの気分" className="mb-3">
        <div className="flex items-center gap-3">
          <span className={classNames('h-3 w-3 shrink-0 rounded-full', MOOD_DOT[mood] ?? MOOD_DOT.calm)} aria-hidden />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{MOOD_WORDS[mood] ?? mood}</span>
          {memory.intensity > 0 && (
            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" title={`強さ ${Math.round(memory.intensity * 100)}%`}>
              <div className={classNames('h-full rounded-full', MOOD_DOT[mood] ?? MOOD_DOT.calm)}
                style={{ width: `${Math.max(4, memory.intensity * 100)}%` }} />
            </div>
          )}
        </div>
      </TabSection>

      <TabSection title={`覚えていること（${items.length}/${SLOTS}）`}>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <Eye className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" aria-hidden />
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              まだ何も覚えていません。<br />近くの want がつぶやくと、{character.name} の心が動いたことだけを覚えます。
            </p>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {items.map(m => (
              <li key={`${m.wantId}:${m.at}`} className="min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className={classNames('h-2 w-2 shrink-0 rounded-full self-center', MOOD_DOT[m.mood] ?? MOOD_DOT.calm)}
                    title={MOOD_WORDS[m.mood] ?? m.mood} aria-hidden />
                  <span className="min-w-0 flex-1 text-xs font-medium text-gray-600 dark:text-gray-300 truncate">{m.wantName || m.wantId}</span>
                  <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{ago(m.at, now)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-100 leading-snug break-words">「{m.say}」</p>
                <div className="mt-1.5 flex items-center gap-2" title={`心が動いた強さ ${Math.round(m.impact * 100)}%`}>
                  <div className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={classNames('h-full rounded-full opacity-70', MOOD_DOT[m.mood] ?? MOOD_DOT.calm)}
                      style={{ width: `${Math.max(4, m.impact * 100)}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </TabSection>
    </TabContent>
  );
};
