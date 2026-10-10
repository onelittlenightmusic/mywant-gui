import type { ResultHistoryEntry } from '@/types/want';

/** "2026-10-10T09:00:00+09:00" → "10/10 09:00", read as written (its own zone). */
export function shortWhen(at: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(at);
  return m ? `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}` : at;
}

/** When an answer is about: what it says it is about, else when it arrived. */
export function outputWhen(entry: ResultHistoryEntry): string {
  return entry.about || entry.timestamp;
}

/**
 * One line for an answer, whatever shape it is: a reservation's time and
 * room, a route's ends, a forecast's words. Shared by the History › Outputs
 * list and the board's answer balls, so the two name an answer the same way.
 */
export function outputSummary(entry: ResultHistoryEntry): string {
  const r = entry.result;
  if (r == null || r === '') return '';
  if (typeof r === 'string') return r;
  if (typeof r === 'number' || typeof r === 'boolean') return String(r);
  if (Array.isArray(r)) {
    const first = r[0] as Record<string, unknown> | undefined, last = r[r.length - 1] as Record<string, unknown> | undefined;
    if (first && typeof first === 'object' && ('from' in first || 'to' in first)) {
      return `${first.from ?? ''}→${last?.to ?? ''} ${first.depart_time ? `${first.depart_time}発` : ''}`.trim();
    }
    return `${r.length} items`;
  }
  if (typeof r === 'object') {
    const o = r as Record<string, unknown>;
    if (typeof o.datetime_rfc3339 === 'string') return `${shortWhen(o.datetime_rfc3339)} ${typeof o.room === 'string' ? o.room : ''}`.trim();
    for (const k of ['summary', 'title', 'name', 'text', 'value']) if (typeof o[k] === 'string' && o[k]) return o[k] as string;
    return JSON.stringify(o).slice(0, 80);
  }
  return '';
}
