import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Ear, EarOff, Check } from 'lucide-react';
import type { Want, HearSpec } from '@/types/want';
import type { TimingDef, WantTypeDetailResponse } from '@/types/wantType';
import { apiClient } from '@/api/client';
import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { getTypeIcon, getCategoryIcon } from '@/components/dashboard/WantTypeVisuals';
import { solidTypeColor } from '@/components/dashboard/WantCardFace';
import { TimingCube } from '@/components/common/TimingCube';
import { FIELD_CARD_SURFACE } from '@/design/cards';
import { classNames } from '@/utils/helpers';

/**
 * Whose murmurs this want hears (spec.hear) — the board's Hear, read and
 * written here too. Each entry is a type it listens to and the moments of it
 * (each a cube, as the timing is drawn everywhere), and who that is now: the
 * engine hears the nearest want of the type within HEAR_RADIUS_CELLS of this
 * one on the board (server/hear.go), so the answer moves when wants do.
 *
 * Added by choosing a type and its moments (the ones it murmurs at); taken
 * away whole. The canvas offers the same when a want is set down beside
 * another, for the one beside it.
 */

/** How far a want hears, in cells (engine server/hear.go HearRadiusCells). */
const HEAR_RADIUS_CELLS = 10;

const idOf = (w: Want) => w.metadata?.id ?? w.id ?? '';
const cellOf = (w: Want | undefined) => {
  const x = Number(w?.metadata?.labels?.['mywant.io/canvas-x']);
  const y = Number(w?.metadata?.labels?.['mywant.io/canvas-y']);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

/** The timings a type murmurs at by default — what another want can hear. */
const heardTimings = (def: WantTypeDetailResponse | null | undefined): TimingDef[] =>
  (def?.timings ?? []).filter(t => t.murmur || t.notify);

/** A type's definition, read once (the client keeps it). */
function useTypeDef(type: string | undefined): WantTypeDetailResponse | null {
  const [def, setDef] = useState<WantTypeDetailResponse | null>(() => (type && apiClient.cachedWantType(type)) || null);
  useEffect(() => {
    if (!type) { setDef(null); return; }
    let live = true;
    apiClient.getWantType(type).then(d => { if (live) setDef(d); }).catch(() => {});
    return () => { live = false; };
  }, [type]);
  return def;
}

/**
 * A want as the board draws it, small: a block of its type's colour with its
 * glyph, a wall below — the cube the Hear bubble lines up, a timing's cube
 * (TimingCube) beside it pale. `dim`: not there to be heard just now.
 */
const WantCube: React.FC<{ type: string; category: string; label?: string; title?: string; dim?: boolean; size?: number }> = ({
  type, category, label, title, dim, size = 46,
}) => {
  const Icon = getTypeIcon(type) ?? getCategoryIcon(category);
  const color = solidTypeColor(type, category);
  const wall = Math.max(3, Math.round(size * 0.1));
  return (
    <span title={title} className={classNames('relative inline-block flex-none', dim && 'opacity-40 grayscale')}
      style={{ width: size, height: size + wall }}>
      <span aria-hidden className="absolute inset-x-0 bottom-0 rounded-[22%]"
        style={{ top: wall, background: `color-mix(in srgb, ${color} 70%, black)` }} />
      <span className="absolute inset-x-0 top-0 rounded-[22%] flex flex-col items-center justify-center gap-0.5 text-white"
        style={{ height: size, background: color }}>
        <Icon style={{ width: size * 0.36, height: size * 0.36 }} strokeWidth={2.2} />
        {label && <span className="font-bold leading-none truncate max-w-[90%]" style={{ fontSize: Math.max(8, size * 0.17) }}>{label}</span>}
      </span>
    </span>
  );
};

const KIND_LABEL: Record<string, string> = { say: 'ひとこと', propose: '提案', act: 'すぐ動く' };

/**
 * One moment it hears, as the board's Hear bubble says it: this want, the one
 * it hears, the moment — three cubes — then what it is and what this want does
 * with it. Who "the one it hears" is, is worked out as the engine does: the
 * nearest of the type within the radius, now.
 */
const HearRow: React.FC<{ hearer: Want; entry: HearSpec; timing: TimingDef | null; onRemove: () => void }> = ({
  hearer, entry, timing, onRemove,
}) => {
  const types = useWantTypeStore(s => s.wantTypes);
  const wants = useWantStore(s => s.wants);
  const speakerDef = useTypeDef(entry.type);
  const hearerDef = useTypeDef(hearer.metadata?.type);
  const categoryOf = (type: string, def?: WantTypeDetailResponse | null) =>
    types.find(t => t.name === type)?.category ?? def?.metadata?.category ?? '';
  const speakerCategory = categoryOf(entry.type, speakerDef);
  const hearerType = hearer.metadata?.type ?? '';

  const heard = useMemo(() => {
    const here = cellOf(hearer);
    const of = wants.filter(w => w.metadata?.type === entry.type && idOf(w) !== idOf(hearer));
    if (!here) return of[0];
    return of
      .map(w => ({ w, c: cellOf(w) }))
      .filter((x): x is { w: Want; c: { x: number; y: number } } => !!x.c)
      .map(x => ({ w: x.w, d: Math.hypot(x.c.x - here.x, x.c.y - here.y) }))
      .filter(x => x.d <= HEAR_RADIUS_CELLS)
      .sort((a, b) => a.d - b.d)[0]?.w;
  }, [hearer, wants, entry.type]);

  const typeTitle = types.find(t => t.name === entry.type)?.title ?? entry.type;
  const hearing = (hearerDef as { hearing?: { kind?: string; description?: string } } | null)?.hearing;
  const action = hearing?.description || 'ひとこと返す';
  const kind = KIND_LABEL[hearing?.kind ?? 'say'] ?? hearing?.kind;

  return (
    <div className={classNames('group flex items-center gap-1.5 rounded-xl pl-1.5 pr-1 py-1.5', FIELD_CARD_SURFACE)}>
      <WantCube type={hearerType} category={categoryOf(hearerType, hearerDef)}
        label={hearer.metadata?.name} title={hearer.metadata?.name} />
      <span className="flex-none text-gray-400" aria-hidden><Ear className="w-3.5 h-3.5" /></span>
      <WantCube type={entry.type} category={speakerCategory}
        label={heard?.metadata?.name ?? typeTitle}
        title={heard ? `${heard.metadata?.name} を聞いています` : `${HEAR_RADIUS_CELLS} マス以内に ${typeTitle} がいません`}
        dim={!heard} />
      <span className="flex-none text-[11px] font-bold text-gray-400" aria-hidden>の</span>
      <TimingCube icon={timing?.icon} color={solidTypeColor(entry.type, speakerCategory)} size={46}
        label={timing?.name ?? 'all'} title={timing?.description ?? 'すべてのつぶやき'} />
      <div className="flex-1 min-w-0 pl-1">
        <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">
          「{timing?.description || timing?.name || 'すべてのつぶやき'}」を聞いて
        </div>
        <div className="text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug truncate">{action}</div>
        <div className="text-[10px] text-gray-400 truncate flex items-center gap-1">
          {heard ? <><Ear className="w-2.5 h-2.5" />{heard.metadata?.name}</> : <><EarOff className="w-2.5 h-2.5" />{HEAR_RADIUS_CELLS} マス以内にいない</>}
          <span>· {kind}</span>
        </div>
      </div>
      <button type="button" onClick={onRemove} aria-label="聞くのをやめる" title="聞くのをやめる"
        className="flex-none self-start p-1 rounded text-gray-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/** One entry of spec.hear, a row per moment it hears (or one for "every murmur"). */
const HearEntryRows: React.FC<{ hearer: Want; entry: HearSpec; onChange: (entry: HearSpec | null) => void }> = ({
  hearer, entry, onChange,
}) => {
  const def = useTypeDef(entry.type);
  const named = entry.timings ?? [];
  const rows: Array<TimingDef | null> = named.length
    ? named.map(n => def?.timings?.find(t => t.name === n) ?? { name: n })
    : [null];
  return (
    <>
      {rows.map(t => (
        <HearRow key={t?.name ?? '*'} hearer={hearer} entry={entry} timing={t}
          onRemove={() => {
            const left = named.filter(n => n !== t?.name);
            onChange(t && left.length ? { ...entry, timings: left } : null);
          }} />
      ))}
    </>
  );
};

const AddHear: React.FC<{ hearerType?: string; taken: Set<string>; onAdd: (entry: HearSpec) => void; onCancel: () => void }> = ({
  hearerType, taken, onAdd, onCancel,
}) => {
  const types = useWantTypeStore(s => s.wantTypes);
  const fetchWantTypes = useWantTypeStore(s => s.fetchWantTypes);
  useEffect(() => { if (!types.length) void fetchWantTypes(); }, [types.length, fetchWantTypes]);
  const [type, setType] = useState('');
  const def = useTypeDef(type || undefined);
  const offered = heardTimings(def);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // A new type: its moments other than the standard answer, chosen to start.
  useEffect(() => {
    const names = offered.map(t => t.name);
    const own = names.filter(n => n !== 'answer');
    setChosen(new Set(own.length ? own : names));
  }, [def]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices = useMemo(
    () => types.filter(t => !t.system_type && t.name !== hearerType && !taken.has(t.name))
      .sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name)),
    [types, hearerType, taken],
  );
  const color = solidTypeColor(type, def?.metadata?.category ?? types.find(t => t.name === type)?.category ?? '');

  return (
    <div className={classNames('rounded-lg px-2.5 py-2 space-y-2', FIELD_CARD_SURFACE)}>
      <select value={type} onChange={e => setType(e.target.value)} aria-label="聞く type"
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm">
        <option value="">聞く type を選ぶ…</option>
        {choices.map(t => <option key={t.name} value={t.name}>{t.title || t.name}</option>)}
      </select>
      {type && (offered.length ? (
        <div className="flex flex-wrap gap-1.5">
          {offered.map(t => {
            const on = chosen.has(t.name);
            return (
              <button key={t.name} type="button" aria-pressed={on}
                onClick={() => setChosen(prev => { const n = new Set(prev); if (n.has(t.name)) n.delete(t.name); else n.add(t.name); return n; })}
                className={classNames('inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 text-[11px] border transition-colors',
                  on ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400')}>
                <TimingCube icon={t.icon} color={color} size={20} />
                {t.description || t.name}
                {on && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-gray-500">この type はつぶやくタイミングがありません</div>
      ))}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-2.5 py-1 text-xs rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">やめる</button>
        <button type="button" disabled={!type || chosen.size === 0}
          onClick={() => onAdd({ type, timings: offered.map(t => t.name).filter(n => chosen.has(n)), nearest: 1 })}
          className="px-2.5 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40">聞く</button>
      </div>
    </div>
  );
};

export const HearSection: React.FC<{
  want: Want;
  hear: HearSpec[];
  onHearChange: (hear: HearSpec[]) => void;
}> = ({ want, hear, onHearChange }) => {
  const [adding, setAdding] = useState(false);
  const taken = useMemo(() => new Set(hear.map(h => h.type)), [hear]);
  return (
    <div className="space-y-2">
      {hear.map(h => (
        <HearEntryRows key={h.type} hearer={want} entry={h}
          onChange={(next) => onHearChange(next ? hear.map(x => (x.type === h.type ? next : x)) : hear.filter(x => x.type !== h.type))} />
      ))}
      {adding ? (
        <AddHear hearerType={want.metadata?.type} taken={taken}
          onAdd={(entry) => { onHearChange([...hear, entry]); setAdding(false); }}
          onCancel={() => setAdding(false)} />
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-2 text-xs text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <Plus className="w-3.5 h-3.5" /> 聞く want type を足す
        </button>
      )}
    </div>
  );
};
