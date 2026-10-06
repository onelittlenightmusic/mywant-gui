import { apiClient } from '@/api/client';
import { askBrowserFM, getBrowserFMStatus } from '@/lib/extensionContext';

/** The robot want's name: its id too. */
const ROBOT = 'robot';

/**
 * Say something to a chat want — and, to the robot, answered where it can be.
 *
 * The robot's provider "Apple FM" is the model of the Mac it runs on; a
 * server with none (Fly: Linux) answers with Claude instead. But a page open
 * in a Mac's Chrome has a Mac right there: the MyWant extension's native host
 * (fmtool) answers with that Mac's model, from the server's own instructions
 * and tools, and writes the turn into the robot's chat as a phone does — so
 * the question, what the robot did and its answer show here the same way.
 *
 * Only started here: the chat shows the turn as the server records it, so the
 * input is free again at once, as with the server's robot.
 */
export async function sayToWant(wantName: string, text: string): Promise<void> {
  if (wantName === ROBOT && (await thisMacAnswers())) {
    void askBrowserFM(text).then((reply) => {
      if (!reply || reply.error) {
        console.warn('[robot] this Mac could not answer; asking the server', reply?.error ?? 'no reply');
        void apiClient.sendWebhookMessage(wantName, text, 'user');
      }
    });
    return;
  }
  await apiClient.sendWebhookMessage(wantName, text, 'user');
}

/**
 * Whether this browser's Mac answers for the robot: its provider is Apple FM,
 * the server has no model of its own, and the extension's host says the Mac's
 * is ready. `localStorage['mywant:browserFM']` = "always" asks this Mac even
 * when the server has one, "never" never does.
 */
let decided: { at: number; yes: Promise<boolean> } | null = null;
const DECIDED_FOR_MS = 30_000;

function thisMacAnswers(): Promise<boolean> {
  if (decided && Date.now() - decided.at < DECIDED_FOR_MS) return decided.yes;
  decided = { at: Date.now(), yes: decide() };
  return decided.yes;
}

async function decide(): Promise<boolean> {
  let mode = 'auto';
  try { mode = localStorage.getItem('mywant:browserFM') ?? 'auto'; } catch { /* storage blocked */ }
  if (mode === 'never') return false;
  try {
    const robot = await apiClient.getWant(ROBOT);
    if (String(robot?.spec?.params?.provider ?? '') !== 'fm') return false;
    if (mode !== 'always') {
      const health = await fetch('/health').then(r => r.json());
      if (health?.onDeviceModel) return false; // the server's own Mac answers
    }
    const status = await getBrowserFMStatus();
    return !!status?.available;
  } catch {
    return false;
  }
}
