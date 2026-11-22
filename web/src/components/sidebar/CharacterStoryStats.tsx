import React, { useEffect, useState } from 'react';
import { apiClient, type CharacterStoryStats as Stats } from '@/api/client';
import { TabContent, TabSection } from '@/components/sidebar/DetailsSidebar';
import { classNames } from '@/utils/helpers';

/**
 * A character's story in figures: when it is about (the parts of the day,
 * and where it goes in each — its ask ledger), what it looks at most (wants
 * opened, tiles stood on), and what it did. What the widget's "wants worth a
 * look" and the robot's suggestions lean on (want_looked_at.go).
 */

/** The story's kinds of event, in words. */
const KIND_WORDS: Record<string, string> = {
  'want.open': 'want を開いた',
  'want.close': 'want を閉じた',
  'want.arrive': 'タイルに乗った',
  'want.leave': 'タイルを離れた',
  'canvas.move': '盤上を移動',
  'view.change': '表示を切り替え',
  'chat.ask': 'ロボットに聞いた',
  'chat.answer': 'ロボットが答えた',
  'turn.outcome': '答えの評価',
  'act.done': '段取りを実行',
  say: '話した',
};

export const CharacterStoryStats: React.FC<{ characterId: string }> = ({ characterId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setStats(null);
    setError('');
    apiClient.getCharacterStoryStats(characterId)
      .then(s => { if (live) setStats(s); })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [characterId]);

  if (error) {
    return <TabContent><p className="text-sm text-red-600 dark:text-red-400">ストーリーを読めませんでした: {error}</p></TabContent>;
  }
  if (!stats) {
    return <TabContent><p className="text-sm text-gray-500 dark:text-gray-400">読み込み中…</p></TabContent>;
  }
  const top = stats.wants[0]?.score || 1;
  const kinds = Object.entries(stats.kinds).sort((a, b) => b[1] - a[1]);

  return (
    <TabContent>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        直近 {stats.days} 日 · 記録 <span className="tabular-nums">{stats.events.toLocaleString()}</span> 件
      </p>

      <TabSection title="時間帯" className="mb-3">
        <ul className="space-y-1.5">
          {stats.parts.map(p => (
            <li key={p.part}
              className={classNames('flex items-baseline gap-3 rounded-md px-2 py-1',
                p.part === stats.now && 'bg-indigo-50 dark:bg-indigo-900/30')}>
              <span className="w-10 shrink-0 text-sm font-medium text-gray-800 dark:text-gray-100">{p.part}</span>
              <span className="w-16 shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">{p.events.toLocaleString()} 件</span>
              <span className="min-w-0 text-sm text-gray-700 dark:text-gray-200 truncate">
                {p.home
                  ? <>いつもの行き先 <b>{p.home}</b> <span className="text-xs text-gray-500 dark:text-gray-400">（{p.asks}/{p.of}）</span></>
                  : <span className="text-xs text-gray-400 dark:text-gray-500">いつもの行き先はまだない</span>}
              </span>
            </li>
          ))}
        </ul>
      </TabSection>

      <TabSection title="よく見る want" className="mb-3">
        {stats.wants.length === 0
          ? <p className="text-xs text-gray-500 dark:text-gray-400">まだありません</p>
          : (
            <ol className="space-y-2">
              {stats.wants.map(w => (
                <li key={w.id} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-gray-800 dark:text-gray-100 truncate">{w.name}</span>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      開いた {w.opens} · 乗った {w.arrives}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(4, (w.score / top) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
      </TabSection>

      <TabSection title="記録の種類">
        <div className="flex flex-wrap gap-1.5">
          {kinds.map(([k, n]) => (
            <span key={k} className="inline-flex items-baseline gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200">
              {KIND_WORDS[k] ?? k} <span className="tabular-nums text-gray-500 dark:text-gray-400">{n.toLocaleString()}</span>
            </span>
          ))}
        </div>
      </TabSection>
    </TabContent>
  );
};
