import React, { useCallback, useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { apiClient, type ToldNotice } from '@/api/client';
import { TabContent } from '@/components/sidebar/DetailsSidebar';
import { useCharacterStore } from '@/stores/characterStore';
import { classNames } from '@/utils/helpers';

/**
 * The notices told — a want's answer shown as a device's own notification —
 * newest first, each with its 👍 / 👎, to change here: pressed, the rating is
 * this character's; pressed again, taken back. The last rating stands, and is
 * what Laya learns from (notices.go). Every character sees the same notices
 * (they go to every device but those turned off); a rating someone else gave
 * says whose.
 */
export const CharacterNotices: React.FC<{ characterId: string }> = ({ characterId }) => {
  const [notices, setNotices] = useState<ToldNotice[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string>('');
  const characters = useCharacterStore(s => s.characters);
  const nameOf = (id?: string) => characters.find(c => c.id === id)?.name ?? id ?? '';

  const load = useCallback(() => {
    apiClient.getNotices(100)
      .then(list => { setNotices(list); setError(''); })
      .catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rate = async (n: ToldNotice, up: boolean) => {
    const want = up ? 'up' : 'down';
    const next = n.rating === want ? 'none' : want;
    setBusy(n.id);
    try {
      await apiClient.rateNotice(n.id, next, characterId);
      setNotices(list => (list ?? []).map(x => x.id === n.id
        ? { ...x, rating: next === 'none' ? undefined : next, ratedBy: next === 'none' ? undefined : characterId }
        : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };

  if (error && !notices) {
    return <TabContent><p className="text-sm text-red-600 dark:text-red-400">通知を読めませんでした: {error}</p></TabContent>;
  }
  if (!notices) {
    return <TabContent><p className="text-sm text-gray-500 dark:text-gray-400">読み込み中…</p></TabContent>;
  }
  if (notices.length === 0) {
    return <TabContent><p className="text-sm text-gray-500 dark:text-gray-400">まだ通知はありません。want が通知するとここに並びます。</p></TabContent>;
  }
  const rated = notices.filter(n => n.rating).length;

  return (
    <TabContent>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        最近の通知 <span className="tabular-nums">{notices.length}</span> 件 · 評価済み <span className="tabular-nums">{rated}</span> 件
      </p>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{error}</p>}
      <ul className="space-y-2">
        {notices.map(n => {
          const at = new Date(n.at);
          const when = isNaN(at.getTime()) ? '' : at.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const someoneElse = n.rating && n.ratedBy && n.ratedBy !== characterId;
          return (
            <li key={n.id} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 min-w-0" data-free-cursor-item>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{n.want}</span>
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{when}</span>
              </div>
              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-200 break-words">{n.text}</p>
              {n.moment && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{n.moment}</p>}
              <div className="mt-2 flex items-center gap-2">
                {([true, false] as const).map(up => {
                  const on = n.rating === (up ? 'up' : 'down');
                  const Icon = up ? ThumbsUp : ThumbsDown;
                  return (
                    <button key={String(up)} type="button" disabled={busy === n.id}
                      onClick={() => rate(n, up)}
                      aria-pressed={on}
                      title={on ? '評価を取り消す' : up ? '知らせてよかった' : '知らせなくてよかった'}
                      className={classNames(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        on
                          ? (up ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300')
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700',
                        busy === n.id && 'opacity-50',
                      )}>
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
                {someoneElse && <span className="text-xs text-gray-500 dark:text-gray-400">{nameOf(n.ratedBy)} が評価</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </TabContent>
  );
};
