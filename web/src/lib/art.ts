/**
 * Art: a picture laid on the board's floor under something on it — a thing,
 * a want, a constellation (the engine's art.go). This is what every one of
 * them shares: the label it is kept in, and having one drawn by the app
 * framing the page (ArtMaker asks; the board lays it — guiex FloorArtLayer).
 *
 * Drawn by the app — Image Playground on the iPhone (mywant-ios ThingArt) —
 * for the sidebar to show for review before it is kept, in two steps, so the
 * words it is drawn from can be read, asked for again or changed first:
 *
 *   page → app   mywantArt.postMessage({op: 'describe', value, subtype, instead?}) → {prompt}
 *   page → app   mywantArt.postMessage({op: 'draw', prompt})
 *                → {image: "data:image/png;base64,…", prompt} | {cancelled} | {error}
 *
 * Nothing drawn on a page with no such app: a browser cannot.
 */

/** What can have art, as the engine's /api/v1/art/{kind}/{id} names it. */
export type ArtKind = 'thing' | 'want' | 'constellation';

/** The label a thing's or a want's art rides on: its URL. A constellation's rides on its members. */
export const ART_LABEL = 'mywant.io/art';

/**
 * How large art lies on the floor — the fragment of its URL (#scale=1.5),
 * kept there by the engine so it goes wherever the URL goes. The steps the
 * sidebar's 小さく / 大きく walk, within the engine's 0.4–3.
 */
export const ART_SCALES = [0.4, 0.6, 0.8, 1, 1.25, 1.6, 2, 2.5, 3] as const;

/** The scale an art URL's fragment says, 1 when it says none. */
export function artScale(url: string | undefined): number {
  const m = url ? /#scale=([0-9.]+)/.exec(url) : null;
  const v = m ? Number(m[1]) : 1;
  return v >= ART_SCALES[0] && v <= ART_SCALES[ART_SCALES.length - 1] ? v : 1;
}

/** The next step from `scale`, smaller (-1) or larger (+1); itself at either end. */
export function nextArtScale(scale: number, dir: -1 | 1): number {
  const steps = [...ART_SCALES];
  const next = dir > 0 ? steps.find(s => s > scale + 1e-6) : steps.reverse().find(s => s < scale - 1e-6);
  return next ?? scale;
}

/** The art a thing's or a want's labels hold, if any. */
export function artOf(labels: Record<string, string> | undefined): string | undefined {
  return labels?.[ART_LABEL]?.trim() || undefined;
}

interface ArtHandler { postMessage: (msg: unknown) => Promise<unknown> }

function handler(): ArtHandler | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { webkit?: { messageHandlers?: { mywantArt?: ArtHandler } } };
  return w.webkit?.messageHandlers?.mywantArt;
}

/** Whether this page can have a picture drawn — framed by the app. */
export function hostDrawsArt(): boolean {
  return !!handler();
}

export interface DrawnArt {
  /** A PNG, as a data URL. */
  image: string;
  /** What was asked to be drawn, in words. */
  prompt: string;
}

type Reply = Partial<DrawnArt> & { error?: string; cancelled?: boolean } | null;

/**
 * What the app would draw for `value` (a `kind` of thing, in words): a short
 * description in English, by the phone's own model. `instead`: one already
 * offered, for another.
 */
export async function describeArt(value: string, kind: string, instead?: string, context?: string): Promise<string> {
  const h = handler();
  if (!h) throw new Error('この画面では描けません');
  const reply = await h.postMessage({ op: 'describe', value, subtype: kind, instead, context: context || undefined }) as Reply;
  if (!reply || reply.error || !reply.prompt) throw new Error(reply?.error || 'プロンプトを作れませんでした');
  return reply.prompt;
}

/**
 * Has the app draw a picture from `prompt`: null when it was closed without
 * one (Apple's own screen, where the app draws on it); rejects with what went
 * wrong.
 */
export async function drawArt(prompt: string): Promise<DrawnArt | null> {
  const h = handler();
  if (!h) throw new Error('この画面では描けません');
  const reply = await h.postMessage({ op: 'draw', prompt }) as Reply;
  if (reply?.cancelled) return null;
  if (!reply || reply.error || !reply.image) throw new Error(reply?.error || '描けませんでした');
  return { image: reply.image, prompt: reply.prompt ?? prompt };
}

/**
 * Fields the board keeps about a want rather than what it says — never worth
 * drawing.
 */
const ART_SKIP_FIELDS = new Set([
  'achieved', 'achieving_percentage', 'action_by_agent', 'completed', 'final_result',
  'characters', 'say', 'status', 'error', 'hp', 'max_hp',
]);

/** How much of a want's fields its prompt is given, in characters. */
const ART_CONTEXT_MAX = 400;

/**
 * A little of what a want holds, for the words its picture is drawn from: its
 * text fields as they are now (a note's `content`, a want's answer), each
 * cut short, the whole no longer than ART_CONTEXT_MAX. "" when it holds no
 * words of its own.
 */
export function artContextOf(current: Record<string, unknown> | undefined): string {
  if (!current) return '';
  const parts: string[] = [];
  let left = ART_CONTEXT_MAX;
  for (const [k, v] of Object.entries(current)) {
    if (ART_SKIP_FIELDS.has(k) || typeof v !== 'string') continue;
    const text = v.trim().replace(/\s+/g, ' ');
    if (!text || /^https?:\/\//.test(text) || text.startsWith('data:')) continue;
    const part = `${k}: ${text.slice(0, 160)}`;
    if (part.length > left) break;
    parts.push(part);
    left -= part.length + 2;
  }
  return parts.join('; ');
}
