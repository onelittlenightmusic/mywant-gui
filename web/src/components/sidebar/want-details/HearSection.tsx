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

/** A slot of the row still to be filled: a cube's outline, waiting. */
const EmptyCube: React.FC<{ active?: boolean; label: string; onClick?: () => void; size?: number }> = ({ active, label, onClick, size = 46 }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className={classNames('flex-none rounded-[22%] border-2 border-dashed flex items-center justify-center text-[10px] font-bold transition-colors',
      active ? 'border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300'
        : 'border-gray-300 dark:border-gray-600 text-gray-400')}
    style={{ width: size, height: size + Math.max(3, Math.round(size * 0.1)) }}>
    ?
  </button>
);

/**
 * A new moment to hear, made as a row of the list above is read: this want,
 * then whom it hears, then when — each slot filled in turn, the choices for
 * the slot being filled laid out under it as cubes, the row reading out what
 * it will do as it fills. Whom: the types of the wants on the board, the
 * nearest first (one has to be in earshot to be heard). When: that type's
 * moments, as many as wanted.
 */
const AddHear: React.FC<{ hearer: Want; onAdd: (entry: HearSpec) => void; onCancel: () => void }> = ({
  hearer, onAdd, onCancel,
}) => {
  const types = useWantTypeStore(s => s.wantTypes);
  const fetchWantTypes = useWantTypeStore(s => s.fetchWantTypes);
  useEffect(() => { if (!types.length) void fetchWantTypes(); }, [types.length, fetchWantTypes]);
  const wants = useWantStore(s => s.wants);
  const hearerType = hearer.metadata?.type ?? '';
  const hearerDef = useTypeDef(hearerType);
  const categoryOf = (type: string) => types.find(t => t.name === type)?.category ?? '';

  // Whom it could hear: each type on the board once, by its nearest want.
  const speakers = useMemo(() => {
    const here = cellOf(hearer);
    const best = new Map<string, { want: Want; d: number }>();
    for (const w of wants) {
      const type = w.metadata?.type;
      if (!type || idOf(w) === idOf(hearer) || w.metadata?.isSystemWant) continue;
      if (types.length && !types.some(t => t.name === type && !t.system_type)) continue;
      const c = cellOf(w);
      const d = here && c ? Math.hypot(c.x - here.x, c.y - here.y) : Infinity;
      const had = best.get(type);
      if (!had || d < had.d) best.set(type, { want: w, d });
    }
    return [...best.entries()].sort((a, b) => a[1].d - b[1].d).map(([type, v]) => ({ type, ...v }));
  }, [wants, hearer, types]);

  const [type, setType] = useState('');
  const def = useTypeDef(type || undefined);
  const offered = heardTimings(def);
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => { setChosen([]); }, [type]);
  const step: 'whom' | 'when' = type ? 'when' : 'whom';
  const speaker = speakers.find(sp => sp.type === type);
  const speakerColor = solidTypeColor(type, categoryOf(type));
  const firstTiming = offered.find(t => t.name === chosen[0]);
  const hearing = (hearerDef as { hearing?: { description?: string } } | null)?.hearing;

  return (
    <div className={classNames('rounded-xl pl-1.5 pr-1 py-1.5 space-y-2 ring-2 ring-violet-300/60 dark:ring-violet-700/60', FIELD_CARD_SURFACE)}>
      {/* The row, as it will read once filled. */}
      <div className="flex items-center gap-1.5">
        <WantCube type={hearerType} category={categoryOf(hearerType)} label={hearer.metadata?.name} title={hearer.metadata?.name} />
        <span className="flex-none text-gray-400" aria-hidden><Ear className="w-3.5 h-3.5" /></span>
        {type ? (
          <button type="button" onClick={() => setType('')} title="相手を選びなおす" className="flex-none">
            <WantCube type={type} category={categoryOf(type)} label={speaker?.want.metadata?.name ?? type} />
          </button>
        ) : <EmptyCube active label="聞く相手" />}
        <span className="flex-none text-[11px] font-bold text-gray-400" aria-hidden>の</span>
        {firstTiming ? (
          <span className="relative flex-none">
            <TimingCube icon={firstTiming.icon} color={speakerColor} size={46} label={firstTiming.name} title={firstTiming.description} />
            {chosen.length > 1 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                +{chosen.length - 1}
              </span>
            )}
          </span>
        ) : <EmptyCube active={step === 'when'} label="いつ" />}
        <div className="flex-1 min-w-0 pl-1">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">
            {firstTiming ? `「${firstTiming.description || firstTiming.name}」${chosen.length > 1 ? ` ほか${chosen.length - 1}つ` : ''}を聞いて`
              : step === 'whom' ? '誰の…' : 'いつを…'}
          </div>
          <div className={classNames('text-[13px] font-bold leading-snug truncate', firstTiming ? 'text-gray-900 dark:text-gray-100' : 'text-gray-300 dark:text-gray-600')}>
            {hearing?.description || 'ひとこと返す'}
          </div>
        </div>
        <div className="flex-none flex flex-col gap-1 self-start">
          <button type="button" onClick={onCancel} aria-label="やめる" title="やめる"
            className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* The choices for the slot being filled. */}
      {step === 'whom' && (
        speakers.length ? (
          <div className="flex flex-wrap gap-2 pl-1">
            {speakers.map(sp => (
              <button key={sp.type} type="button" onClick={() => setType(sp.type)} className="flex flex-col items-center gap-0.5 w-[54px]"
                title={`${sp.want.metadata?.name}（${types.find(t => t.name === sp.type)?.title ?? sp.type}）${Number.isFinite(sp.d) ? ` · ${sp.d.toFixed(1)} マス` : ''}`}>
                <WantCube type={sp.type} category={categoryOf(sp.type)} size={40} dim={sp.d > HEAR_RADIUS_CELLS} />
                <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-full">{sp.want.metadata?.name}</span>
              </button>
            ))}
          </div>
        ) : <div className="text-[11px] text-gray-500 pl-1">盤面にほかの want がいません</div>
      )}
      {step === 'when' && (
        offered.length ? (
          <div className="flex flex-wrap gap-2 pl-1">
            {offered.map(t => {
              const on = chosen.includes(t.name);
              return (
                <button key={t.name} type="button" aria-pressed={on} title={t.description || t.name}
                  onClick={() => setChosen(prev => (on ? prev.filter(n => n !== t.name) : [...prev, t.name]))}
                  className={classNames('relative flex flex-col items-center gap-0.5 w-[64px] rounded-lg p-0.5', on && 'bg-violet-100 dark:bg-violet-900/40')}>
                  <TimingCube icon={t.icon} color={speakerColor} size={40} label={t.name} />
                  <span className="text-[10px] leading-tight text-gray-600 dark:text-gray-300 line-clamp-2 text-center">{t.description || t.name}</span>
                  {on && <Check className="absolute top-0 right-1 w-3.5 h-3.5 text-violet-600" />}
                </button>
              );
            })}
          </div>
        ) : <div className="text-[11px] text-gray-500 pl-1">この type はつぶやくタイミングがありません</div>
      )}

      {step === 'when' && (
        <div className="flex justify-end">
          <button type="button" disabled={chosen.length === 0}
            onClick={() => onAdd({ type, timings: offered.map(t => t.name).filter(n => chosen.includes(n)), nearest: 1 })}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-violet-600 text-white disabled:opacity-40">
            <Ear className="w-3.5 h-3.5" /> 聞く
          </button>
        </div>
      )}
    </div>
  );
};

export const HearSection: React.FC<{
  want: Want;
  hear: HearSpec[];
  onHearChange: (hear: HearSpec[]) => void;
}> = ({ want, hear, onHearChange }) => {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2">
      {hear.map(h => (
        <HearEntryRows key={h.type} hearer={want} entry={h}
          onChange={(next) => onHearChange(next ? hear.map(x => (x.type === h.type ? next : x)) : hear.filter(x => x.type !== h.type))} />
      ))}
      {adding ? (
        <AddHear hearer={want}
          onAdd={(entry) => {
            // A type it hears already gains the moments; a new one is added.
            const had = hear.find(h => h.type === entry.type);
            onHearChange(had
              ? hear.map(h => (h.type === entry.type ? { ...h, timings: [...new Set([...(h.timings ?? []), ...(entry.timings ?? [])])] } : h))
              : [...hear, entry]);
            setAdding(false);
          }}
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
