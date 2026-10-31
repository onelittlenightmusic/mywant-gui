/**
 * Art: a picture laid on the board's floor under something on it — a thing,
 * a want, a constellation (the engine's art.go). This is what every one of
 * them shares: the label it is kept in, and having one drawn (ArtMaker asks;
 * the board lays it — guiex FloorArtLayer).
 *
 * Drawn in two steps, so the words it is drawn from can be read, asked for
 * again or changed first — one flow, wherever 作る is pressed:
 *
 *   1. the words: asked of the server (POST /api/v1/art/describe, the engine's
 *      art_words.go), which says what a model is to be asked and how its
 *      answer becomes the words — and has written them already when it has a
 *      model of its own (fmtool on a Mac). When it has none (Fly), the device
 *      the page is on runs the request on its own model (`generate`);
 *   2. the drawing: Image Playground on that device (`draw`), the picture the
 *      person keeps there handed back as a PNG.
 *
 * The device is whatever has the models: the iPhone app framing the page
 * (mywant-ios ThingArt, window.webkit.messageHandlers.mywantArt), or Chrome on
 * a Mac through the MyWant extension and its fmtool (NativeHost, Drawing.swift)
 * — the same two operations either way, and neither knows what a picture's
 * words should be:
 *
 *   generate {ask, warm}  → {text} | {error}
 *   draw {prompt}         → {image: "data:image/png;base64,…", prompt} | {cancelled} | {error}
 *
 * Nothing drawn on a page with neither: a browser alone cannot.
 */
import { useSyncExternalStore } from 'react';
import { apiClient } from '@/api/client';
import { artDrawInBrowser, artGenerateInBrowser, getBrowserFMStatus } from '@/lib/extensionContext';

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

/** The iPhone app's, when it frames the page. */
function appHandler(): ArtHandler | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { webkit?: { messageHandlers?: { mywantArt?: ArtHandler } } };
  return w.webkit?.messageHandlers?.mywantArt;
}

export interface DrawnArt {
  /** A PNG, as a data URL. */
  image: string;
  /** What was asked to be drawn, in words. */
  prompt: string;
}

type DrawReply = Partial<DrawnArt> & { error?: string; cancelled?: boolean } | null;

/** The device's two operations, whichever device it is. */
interface ArtHost {
  generate: (ask: string, warm: boolean) => Promise<{ text?: string; error?: string } | null>;
  draw: (prompt: string) => Promise<DrawReply>;
}

/**
 * Whether the extension's fmtool can draw here — asked once, when first
 * wanted, and kept: whether a Mac has Image Playground does not change while
 * a page is open. null while not yet known.
 */
let browserDraws: boolean | null = null;
let browserAsked = false;
const browserListeners = new Set<() => void>();

function askBrowserOnce(): void {
  if (browserAsked || appHandler()) return;
  browserAsked = true;
  void getBrowserFMStatus().then((st) => {
    browserDraws = !!(st?.available && st.draws);
    browserListeners.forEach((l) => l());
  });
}

function artHost(): ArtHost | undefined {
  const app = appHandler();
  if (app) {
    return {
      generate: (ask, warm) => app.postMessage({ op: 'generate', ask, warm }) as Promise<{ text?: string; error?: string } | null>,
      draw: (prompt) => app.postMessage({ op: 'draw', prompt }) as Promise<DrawReply>,
    };
  }
  if (browserDraws) return { generate: artGenerateInBrowser, draw: artDrawInBrowser };
  return undefined;
}

/** Whether this page can have a picture drawn — framed by the app, or in Chrome with the extension's fmtool. */
export function hostDrawsArt(): boolean {
  askBrowserOnce();
  return !!artHost();
}

/** hostDrawsArt, for a component: it changes once, when the extension has said. */
export function useHostDrawsArt(): boolean {
  return useSyncExternalStore(
    (l) => { browserListeners.add(l); return () => { browserListeners.delete(l); }; },
    hostDrawsArt,
    () => false,
  );
}

/** What the server says about a picture's words (the engine's art_words.go). */
export interface ArtWordsRecipe {
  /** What a model is to be asked, and whether to let it range wider (another one). */
  ask: string;
  warm: boolean;
  /** How its answer becomes the words: cut to `limit`, `suffix` after it. */
  suffix: string;
  limit: number;
  /** The words when there is no answer. */
  fallback: string;
  /** Written already: the server had a model of its own. */
  prompt?: string;
}

/**
 * What would be drawn for `value` (a `kind` of thing, in words): a short
 * description in English — the server's model's, or this device's. `instead`:
 * one already offered, for another.
 */
export async function describeArt(value: string, kind: string, instead?: string, context?: string): Promise<string> {
  const recipe = await apiClient.describeArt({ value, subtype: kind, instead, context: context || undefined });
  if (recipe.prompt) return recipe.prompt;
  const host = artHost();
  const said = host ? (await host.generate(recipe.ask, recipe.warm).catch(() => null))?.text?.trim() : undefined;
  return said ? [...said].slice(0, recipe.limit).join('') + recipe.suffix : recipe.fallback;
}

/**
 * Has the device draw a picture from `prompt`: null when it was closed without
 * one (Apple's own screen, where the person draws on it); rejects with what
 * went wrong.
 */
export async function drawArt(prompt: string): Promise<DrawnArt | null> {
  const host = artHost();
  if (!host) throw new Error('この画面では描けません');
  const reply = await host.draw(prompt);
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
