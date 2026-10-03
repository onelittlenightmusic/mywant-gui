import React, { useEffect, useMemo } from 'react';
import { Check, Waypoints, X } from 'lucide-react';
import { useConstellationStore } from '@/stores/constellationStore';
import { useConstellationFilterStore, type FilterPage } from '@/stores/constellationFilterStore';
import type { Constellation } from '@/types/constellation';
import { classNames } from '@/utils/helpers';

/** Whether a constellation holds anything of the kind a list shows. */
function holds(c: Constellation, page: FilterPage): boolean {
  if (c.kind === page) return c.members.length > 0;
  if (c.kind !== 'mixed') return false;
  return c.members.some(m => c.memberKinds?.[m] === page);
}

/** The members of the chosen constellations, for a list to narrow to — or null
 *  when none is chosen (everything shows). */
export function useConstellationFilter(page: FilterPage): Set<string> | null {
  const selected = useConstellationFilterStore(s => s.selected[page]);
  const constellations = useConstellationStore(s => s.constellations);
  const fetch = useConstellationStore(s => s.fetchConstellations);
  useEffect(() => { if (selected.length && constellations.length === 0) void fetch(); }, [selected.length, constellations.length, fetch]);
  return useMemo(() => {
    if (selected.length === 0) return null;
    const out = new Set<string>();
    for (const c of constellations) {
      if (!selected.includes(c.name)) continue;
      for (const m of c.members) out.add(m);
    }
    return out;
  }, [selected, constellations]);
}

/**
 * Narrow a list to constellations: every constellation holding something the
 * list shows, as a pill; the chosen ones lit. What the list shows is what any
 * chosen one holds. Shared by the want list and the thing list.
 */
export const ConstellationFilterPanel: React.FC<{ page: FilterPage }> = ({ page }) => {
  const constellations = useConstellationStore(s => s.constellations);
  const fetch = useConstellationStore(s => s.fetchConstellations);
  const selected = useConstellationFilterStore(s => s.selected[page]);
  const toggle = useConstellationFilterStore(s => s.toggle);
  const clear = useConstellationFilterStore(s => s.clear);
  useEffect(() => { void fetch(); }, [fetch]);
  const offered = useMemo(
    () => constellations.filter(c => holds(c, page)).sort((a, b) => a.name.localeCompare(b.name)),
    [constellations, page],
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Waypoints className="w-4 h-4 text-gray-500" />
        <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">
          {selected.length ? `${selected.length} 個の星座で絞り込み中` : '星座を選ぶと、その星座のものだけを表示します'}
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={() => clear(page)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            <X className="w-3 h-3" />クリア
          </button>
        )}
      </div>
      {offered.length === 0 ? (
        <p className="text-sm text-gray-400">星座がまだありません。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {offered.map(c => {
            const on = selected.includes(c.name);
            const color = c.color ?? '#38bdf8';
            const count = c.kind === 'mixed' ? c.members.filter(m => c.memberKinds?.[m] === page).length : c.members.length;
            return (
              <button
                key={`${c.kind}:${c.name}`}
                type="button"
                data-free-cursor-item
                onClick={() => toggle(page, c.name)}
                className={classNames(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                  on ? 'text-white' : 'text-gray-700 dark:text-gray-200 bg-white/60 dark:bg-gray-800/60',
                )}
                style={on ? { backgroundColor: color, borderColor: color } : { borderColor: `${color}88` }}
                aria-pressed={on}
              >
                {on ? <Check className="w-3.5 h-3.5" /> : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                {c.name}
                <span className={classNames('text-xs', on ? 'text-white/80' : 'text-gray-400')}>{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
