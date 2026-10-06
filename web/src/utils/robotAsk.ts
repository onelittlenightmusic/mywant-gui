import { apiClient } from '@/api/client';
import { askBrowserFM, getBrowserFMStatus } from '@/lib/extensionContext';

/** The robot want's name: its id too. */
const ROBOT = 'robot';

/**
 * Whether this browser answers for the robot itself.
 *
 * Decided by what the browser has, not by what its server has: a page in a
 * Mac's Chrome whose MyWant extension reaches fmtool (its native messaging
 * host, with Apple's model ready) asks that model — on Fly and on a local
 * server alike — and anything else leaves the robot to its server. Worked out
 * once when first needed and kept, looked at again every few minutes so an
 * extension installed or a model readied later is noticed.
 *
 * `localStorage['mywant:browserFM'] = 'never'` keeps it to the server.
 */
let decided: { at: number; yes: Promise<boolean> } | null = null;
const DECIDED_FOR_MS = 5 * 60_000;

export function hasLocalLLM(): Promise<boolean> {
  if (decided && Date.now() - decided.at < DECIDED_FOR_MS) return decided.yes;
  const entry = { at: Date.now(), yes: decide() };
  decided = entry;
  return entry.yes;
}

async function decide(): Promise<boolean> {
  try {
    if (localStorage.getItem('mywant:browserFM') === 'never') return false;
  } catch { /* storage blocked: decide as usual */ }
  const status = await getBrowserFMStatus();
  // No reply at all is not a no: asked as the page opens, the extension's
  // bridge may not have been listening yet. Not kept, so the next @robot asks
  // again — a no that was only too early used to stand for five minutes, and
  // every question went to a server with no model to answer it.
  if (status === null) decided = null;
  return !!status?.available;
}

/**
 * Ask the robot with this browser's own model. The model's host (fmtool)
 * takes the server's instructions and tools and writes the turn into the
 * robot's chat, so the answer shows where the server's would; only started
 * here. A host that cannot answer hands the question to the server's robot.
 */
export function askRobotHere(text: string): void {
  void askBrowserFM(text).then((reply) => {
    if (!reply || reply.error) {
      console.warn('[robot] this browser could not answer; asking the server', reply?.error ?? 'no reply');
      void apiClient.sendWebhookMessage(ROBOT, text, 'user');
    }
  });
}

/** Say something to a chat want — to the robot, answered here when this
 *  browser has its own model (hasLocalLLM). */
export async function sayToWant(wantName: string, text: string): Promise<void> {
  if (wantName === ROBOT && (await hasLocalLLM())) {
    askRobotHere(text);
    return;
  }
  await apiClient.sendWebhookMessage(wantName, text, 'user');
}

// The server's rule for a message addressed to the robot (speech_log.go's
// mentionsRobot and stripRobotMention), the same here: "@robot" as a whole
// word, anywhere, taken out of what is asked.
const MENTION = /@robot(?![A-Za-z0-9_-])/i;

export function mentionsRobot(text: string): boolean {
  return MENTION.test(text);
}

export function stripRobotMention(text: string): string {
  const m = MENTION.exec(text);
  if (!m) return text.trim();
  return `${text.slice(0, m.index).trim()} ${text.slice(m.index + m[0].length).trim()}`.trim();
}
