import { nativeHost } from '@/lib/nativeHost';
// Reading and setting the browser extension's active context (which server it
// talks to) from the dashboard, so that a profile can be registered without
// opening chrome://extensions.
//
// The extension's content script (webext/webext-src/bridge.js) is the only
// page→extension path there is: a normal page cannot call
// chrome.runtime.sendMessage. It answers on window.postMessage, correlated by
// requestId so overlapping calls cannot swap replies.

export interface ExtensionContext {
  name: string;
  origin: string;
  hasCredentials: boolean;
  names: string[];
}

export interface SetContextInput {
  name: string;
  server: string;
  username?: string;
  password?: string;
}

const REPLY_TIMEOUT_MS = 2500;

/**
 * When to say it again, in ms from the first attempt.
 *
 * The listener is a content script, and on a hard reload this page's own
 * scripts can run before it has been injected — so the question was asked into
 * a window nobody was listening on, and 1.5s later the page concluded there was
 * no extension and stayed that way until it was reloaded by hand. Saying it
 * again a few times inside the same wait costs nothing when there really is no
 * extension (the deadline is unchanged) and removes the race when there is one.
 *
 * Reads only. A write said twice is done twice — the bridge forwards every copy
 * it hears, and only the first ANSWER is taken here — and a write is always the
 * result of a press, long after the page has loaded, so it never races the
 * injection in the first place.
 */
const RETRY_AT_MS = [150, 400, 900, 1600];
// MYWANT_FM_STATUS too: asked as the canvas opens, which is exactly when the
// bridge may not be listening yet (see useRobotInteract).
const RETRYABLE = new Set(['MYWANT_QUERY_CONTEXT', 'MYWANT_LIST_CONTEXTS', 'MYWANT_FM_STATUS']);

/** Resolves null when no extension answers, which is also how "not installed" looks. */
function ask<T>(type: string, payload: Record<string, unknown> = {}, timeoutMs = REPLY_TIMEOUT_MS): Promise<T | null> {
  // Framed by an app that keeps profiles the way the extension does
  // (mywant-ios): the same questions go to it, and it answers in the
  // extension's shapes, so the Extension page manages the app's profiles.
  const host = nativeHost ? window.webkit?.messageHandlers?.mywantExtension : undefined;
  if (host) {
    return Promise.resolve(host.postMessage({ type, ...payload }) as unknown as Promise<T>)
      .then(v => (v ?? null) as T | null)
      .catch(() => null);
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    let done = false;
    const retries: ReturnType<typeof setTimeout>[] = [];

    const finish = (value: T | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      retries.forEach(clearTimeout);
      resolve(value);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || msg.source !== 'mywant-ext') return;
      if (msg.type !== `${type}_RESULT` || msg.requestId !== requestId) return;
      finish(msg.payload as T);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    window.addEventListener('message', onMessage);
    // The same requestId every time, so however many of these are heard, only
    // the first reply is taken and the rest are ignored by the id check above.
    const say = () => window.postMessage(
      { source: 'mywant-gui', type, requestId, ...payload }, window.location.origin,
    );
    say();
    if (RETRYABLE.has(type)) {
      RETRY_AT_MS.forEach((at) => { retries.push(setTimeout(() => { if (!done) say(); }, at)); });
    }
  });
}

/** Whether this Mac's model can answer for the page (the extension's fmtool
 *  native host, with Apple's model ready), or null when no extension replies. */
export interface BrowserFMStatus { available: boolean; reason?: string }

export function getBrowserFMStatus(): Promise<BrowserFMStatus | null> {
  return ask<BrowserFMStatus>('MYWANT_FM_STATUS', {}, 5000);
}

/** The robot's answer from this Mac's model: the page's server's instructions
 *  and tools, the turn written into the robot's chat as a phone's is. */
export interface BrowserFMAnswer { text?: string; cards?: unknown[]; error?: string }

export function askBrowserFM(question: string): Promise<BrowserFMAnswer | null> {
  // A model answering with tool calls takes seconds, sometimes tens of them.
  return ask<BrowserFMAnswer>('MYWANT_FM_ASK', { question }, 180_000);
}

/** One server the extension is watching, or null when no extension replies.
 *  For a readout — the Device card's "this browser talks to". Anything that has
 *  a particular server in mind must name it rather than ask this. */
export function getExtensionContext(): Promise<ExtensionContext | null> {
  return ask<ExtensionContext>('MYWANT_QUERY_CONTEXT');
}

/**
 * One registered profile, as the Extension page draws it.
 *
 * No password, ever — only whether one is stored. The extension holds it and
 * has no reason to hand it back; a page that could read it would be a place it
 * has never needed to be.
 */
export interface ExtensionProfile {
  name: string;
  server: string;
  username: string;
  hasPassword: boolean;
  /**
   * Whether this browser takes work from this profile — the only state a
   * profile has.
   *
   * There used to be a second one, "in use", naming the single server the
   * extension was pointed at. It answered two questions at once (whose queue to
   * drain, and which server this browser belongs to); the first is a set now,
   * and the second was only ever read to draw a line on the Device card, which
   * is where a browser's server belongs.
   *
   * Optional because an extension built before this says nothing about it.
   */
  watched?: boolean;
}

export interface ExtensionProfileList {
  contexts: ExtensionProfile[];
  /** How many may be watched at once. Absent from older extensions. */
  maxWatched?: number;
  /**
   * The profile the web inspector saves captures to (and reads its characters,
   * marks and GUI state from). Absent from older extensions, which always used
   * the first watched one without saying so.
   */
  saveTarget?: string;
  /** The user named saveTarget, rather than it being the first watched one. */
  saveTargetPinned?: boolean;
}

/** Every profile the extension keeps, and which of them it listens to. */
export function listExtensionContexts(): Promise<ExtensionProfileList | null> {
  return ask<ExtensionProfileList>('MYWANT_LIST_CONTEXTS');
}

/**
 * Start or stop taking work from a profile.
 *
 * A registered server is either one this browser listens to or one it merely
 * remembers; this is what moves it between the two. Up to `maxWatched` at once
 * — the extension refuses beyond that and says so.
 */
export function setExtensionContextWatched(
  name: string,
  watched: boolean,
): Promise<{ ok?: boolean; watched?: string[]; error?: string } | null> {
  return ask('MYWANT_SET_WATCHED', { name, watched });
}

/** Make a profile the one captures are saved to; an empty name clears the
 *  choice, so the first watched one is used again. */
export function setExtensionSaveContext(name: string): Promise<{ ok?: boolean; saveTarget?: string; error?: string } | null> {
  return ask('MYWANT_SET_SAVE_CONTEXT', { name });
}

/** Forget a profile. It leaves the watch set with it, so the extension does not
 *  keep polling a server whose credentials it has just thrown away. */
export function deleteExtensionContext(name: string): Promise<{ ok?: boolean; watched?: string[]; error?: string } | null> {
  return ask('MYWANT_DELETE_CONTEXT', { name });
}

/** Opens the extension's options page with this context pre-filled, for the
 * password. Used when the server wants Basic auth: the page cannot read the
 * credentials it was served with, and should not be the one holding them. */
export function openExtensionContextOptions(
  input: Omit<SetContextInput, 'password'>,
): Promise<{ ok?: boolean; error?: string } | null> {
  return ask('MYWANT_OPEN_CONTEXT_OPTIONS', {
    name: input.name,
    server: input.server,
    username: input.username ?? '',
  });
}

/** Whether this server answers unauthenticated requests, i.e. whether the
 * extension will need credentials to poll it. Probed rather than assumed: the
 * page itself is already authenticated, so its own fetches say nothing. */
export async function serverNeedsAuth(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/v1/config`, { credentials: 'omit', cache: 'no-store' });
    return res.status === 401;
  } catch {
    return false; // unreachable is a different problem; do not send the user to type a password
  }
}

/** Registers (or updates) a context and switches the extension to it. */
export function setExtensionContext(
  input: SetContextInput,
): Promise<{ ok?: boolean; name?: string; origin?: string; error?: string } | null> {
  return ask('MYWANT_SET_CONTEXT', {
    name: input.name,
    server: input.server,
    username: input.username ?? '',
    password: input.password ?? '',
  });
}
