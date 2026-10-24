/**
 * A picture drawn for a thing by the app framing the page — Image Playground
 * on the iPhone (mywant-ios ThingArtBridge) — for the thing's sidebar to show
 * for review before it is kept (ThingArtSection).
 *
 *   page → app   window.webkit.messageHandlers.mywantArt.postMessage({value, subtype})
 *                → {image: "data:image/png;base64,…", prompt} | {cancelled} | {error}
 *
 * Nothing on a page with no such app: a browser cannot draw one.
 */

interface ArtHandler { postMessage: (msg: unknown) => Promise<unknown> }

function handler(): ArtHandler | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { webkit?: { messageHandlers?: { mywantArt?: ArtHandler } } };
  return w.webkit?.messageHandlers?.mywantArt;
}

/** Whether this page can have a picture drawn — framed by the app. */
export function hostDrawsThingArt(): boolean {
  return !!handler();
}

export interface DrawnThingArt {
  /** A PNG, as a data URL. */
  image: string;
  /** What was asked to be drawn, in words. */
  prompt: string;
}

/**
 * Has the app draw a picture of this value: null when it was closed without
 * one (Apple's own screen, where the app draws on it); rejects with what went
 * wrong.
 */
export async function drawThingArt(value: string, subtype: string): Promise<DrawnThingArt | null> {
  const h = handler();
  if (!h) throw new Error('この画面では描けません');
  const reply = await h.postMessage({ value, subtype }) as Partial<DrawnThingArt> & { error?: string; cancelled?: boolean } | null;
  if (reply?.cancelled) return null;
  if (!reply || reply.error || !reply.image) throw new Error(reply?.error || '描けませんでした');
  return { image: reply.image, prompt: reply.prompt ?? value };
}
