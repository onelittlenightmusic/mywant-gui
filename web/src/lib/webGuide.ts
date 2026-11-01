/**
 * Opening a web page at one thing on it, with the way there shown — for any
 * want whose answers are places on a page (a booking site's open slot).
 *
 * An answer that is such a place carries `url` and `goto` (the plugin's
 * goto.json filled for it — see the Python SDK's mywant/guide.py):
 *
 *   goto.guide     the facts the type's voice.py says the way from
 *   goto.steps     what is done on the page first (browser_run's steps)
 *   goto.elements  the things to bring the person to (web want elements);
 *                  the first is lit and the CursorMan stood on it
 *   goto.then      pages the way goes on to in the same tab
 *
 * A want whose answer is a list of many places keeps the way's shape once,
 * as its `goto_template` state, and each place only the values that go into
 * it (`goto_values`); the way is filled here when one is opened (gotoOf).
 *
 * Each step and element may name its moment (say_key). Opening asks the
 * want's voice for a line per moment, and a short name for it in the way's
 * progress ("title:<moment>") (POST /wants/{id}/voice/guide), in the
 * language my character reads the board in, and hands the way to the MyWant
 * extension in this browser (POST /web-wants/open, device): it runs the
 * steps, the robot saying each line, and leaves the CursorMan on the place.
 * Framed by the app, the app's own browser does the same with the same
 * in-page script (web-guide.js) — the way is handed to it ('open-guide').
 * With neither, the page just opens.
 */
import { myDeviceId } from '@/hooks/useDeviceSession';
import { nativeHost, postToHost } from '@/lib/nativeHost';
import { displaySettings } from '@/hooks/useDisplaySettings';

/** A step or a thing on the page, with the moment it is for the robot's line. */
export type GuideMoment = Record<string, unknown> & { say_key?: string; say?: string; title?: string };
/** A page the way goes on to in the same tab, and what to show there. */
export type GuidePage = { url_contains: string; elements: GuideMoment[] };
/** The way to one thing on a page (an answer's `goto`). */
export interface WebGuide {
  guide?: unknown;
  steps?: GuideMoment[];
  elements?: GuideMoment[];
  then?: GuidePage[];
}

/** `template` with every `{{name}}` in its strings replaced by values[name] —
 *  the SDK's fill_template, the same way round. */
export function fillTemplate<T>(template: T, values: Record<string, unknown>): T {
  if (typeof template === 'string') {
    return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in values ? String(values[k]) : m)) as T;
  }
  if (Array.isArray(template)) return template.map(t => fillTemplate(t, values)) as T;
  if (template && typeof template === 'object') {
    return Object.fromEntries(
      Object.entries(template).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, fillTemplate(v, values)]),
    ) as T;
  }
  return template;
}

/** A place's way: its own `goto`, or the want's `goto_template` filled with its `goto_values`. */
export function gotoOf(x: unknown, template?: unknown): WebGuide | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const o = x as Record<string, unknown>;
  if (o.goto && typeof o.goto === 'object') return o.goto as WebGuide;
  if (o.goto_values && typeof o.goto_values === 'object' && template && typeof template === 'object') {
    return fillTemplate(template as WebGuide, o.goto_values as Record<string, unknown>);
  }
  return undefined;
}

/** Whether something (an answer, an item in one) is a place on a page to be brought to. */
export function guideOf(x: unknown, template?: unknown): { url: string; goto: WebGuide } | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const goto = gotoOf(o, template);
  return typeof o.url === 'string' && o.url && goto ? { url: o.url, goto } : null;
}

/** The way with the robot's lines in it, put on each step by its moment.
 *  Without them — no voice, no answer — the way still goes, silently. */
async function withLines(wantId: string, goto: WebGuide): Promise<Required<Omit<WebGuide, 'guide'>> & { title: string }> {
  let say: Record<string, string> = {};
  if (wantId) {
    try {
      const r = await fetch(`/api/v1/wants/${encodeURIComponent(wantId)}/voice/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide: goto.guide ?? null, lang: displaySettings().language }),
      });
      if (r.ok) say = ((await r.json()) as { say?: Record<string, string> }).say ?? {};
    } catch { /* a silent way */ }
  }
  // Its line, and its name in the way's progress ("title:<moment>").
  const put = (m: GuideMoment) => {
    if (!m.say_key) return m;
    const out: GuideMoment = { ...m };
    if (say[m.say_key]) out.say = say[m.say_key];
    if (say[`title:${m.say_key}`]) out.title = say[`title:${m.say_key}`];
    return out;
  };
  return {
    // What the way is for, at the head of its progress ("20:00 の Room2 を予約しよう").
    title: say.title ?? '',
    steps: (goto.steps ?? []).map(put),
    elements: (goto.elements ?? []).map(put),
    then: (goto.then ?? []).map(p => ({ ...p, elements: p.elements.map(put) })),
  };
}

/** Opens `url` brought to the place `goto` describes, as said above. */
export function openWithGuide(wantId: string, url: string, goto?: WebGuide | null): void {
  const plain = () => { window.open(url, '_blank', 'noopener,noreferrer'); };
  if (goto && nativeHost) {
    withLines(wantId, goto).then(way => postToHost({ type: 'open-guide', url, ...way }));
    return;
  }
  if (!goto || document.documentElement.dataset.mywantExtension !== 'true') { plain(); return; }
  withLines(wantId, goto)
    .then(way => fetch('/api/v1/web-wants/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, device: myDeviceId, ...way }),
    }))
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
    .catch(plain);
}
