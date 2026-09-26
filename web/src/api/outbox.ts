/**
 * Changes owed to the server, and the one place that keeps owing them.
 *
 * The pattern this replaces was written out by hand at every call site: set a
 * loading flag, await the request, await a second request to read back what the
 * first one did, apply that, and on failure put the old value back. It cost two
 * round trips before anything moved on screen, and it treated a lost packet as
 * a decision — the user pressed suspend, the wifi blinked, and the card quietly
 * went back to running as though they had never asked.
 *
 * Neither is right. The user's press IS the decision; the request is how the
 * server is told about it. So:
 *
 *   · the caller applies the change locally and immediately,
 *   · the request is handed here and this keeps trying until it lands,
 *   · the truth arrives on its own through SSE, and corrects the guess if it
 *     was wrong.
 *
 * A failure that will never succeed — the server understood and refused — is
 * the one case worth surfacing, and it is told apart from a failure worth
 * retrying by its status code, not by guessing.
 *
 * KEYS. A key names WHAT IS BEING SET, not what is being sent: `want:42:control`
 * rather than `want:42:suspend`. Two presses of different buttons on the same
 * card are the same key, so the second replaces the first instead of queueing
 * behind it, and a suspend that is still being retried when the user changes
 * their mind and resumes is dropped rather than delivered after it. Where a
 * change ADDS rather than SETS — a message, a log line — give it a key of its
 * own so nothing swallows it.
 *
 * Work for one key runs one at a time and in order; different keys run at once.
 */

/** A change owed for one key. Only the newest is kept; see KEYS above. */
interface Job {
  run: () => Promise<unknown>;
  /** For the console and for whatever shows the user a failure. */
  label: string;
  /**
   * Called if this change is given up on — refused outright, or a conflict
   * that would not settle. For a caller holding a local claim that the write
   * was going to justify: the claim has to go, or the screen keeps showing
   * something nobody will ever agree with. Not called on success, and not on
   * a change superseded by a newer one for the same key, which is not a
   * failure — the newer one carries the claim now.
   */
  onGaveUp?: () => void;
}

const owed = new Map<string, Job>();
const running = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const attempts = new Map<string, number>();

type FailureHandler = (label: string, error: unknown) => void;
let onPermanentFailure: FailureHandler = (label, error) => {
  console.error(`${label} was refused by the server:`, error);
};

/** Where to report a change the server refused outright. */
export function setOutboxFailureHandler(handler: FailureHandler): void {
  onPermanentFailure = handler;
}

const listeners = new Set<(count: number) => void>();

/** Watch how much is still owed, for an "unsaved" mark. Returns an unsubscribe. */
export function subscribeOutbox(fn: (count: number) => void): () => void {
  listeners.add(fn);
  fn(pendingCount());
  return () => { listeners.delete(fn); };
}

/** How many keys are still owed, counting one in flight. */
export function pendingCount(): number {
  const keys = new Set([...owed.keys(), ...running]);
  return keys.size;
}

/**
 * Whether one particular change has yet to land.
 *
 * For the control that made it to say so — a note that says it is not saved
 * yet rather than a note that says nothing. Note that a change in flight is
 * still owed: it is owed until the server has it.
 */
export function isOwed(key: string): boolean {
  return owed.has(key) || running.has(key);
}

function announce(): void {
  const n = pendingCount();
  for (const fn of listeners) fn(n);
}

/**
 * Whether trying again could ever work.
 *
 * A 4xx means the server read the request and said no: the want does not
 * exist, the value is not allowed, we are not permitted. Repeating it produces
 * the same no. The exceptions are the ones that mean "not now" rather than
 * "no" — a timeout, a rate limit, and the two conflicts, which say the request
 * was fine but arrived against a version that has moved on. Everything else —
 * 5xx, a connection that never opened, a request that never came back — is
 * worth another go.
 *
 * Two error shapes, because two layers throw: axios puts the code on
 * `response`, and the hand-written calls put it on the error itself.
 */
const RETRYABLE_4XX = new Set([408, 409, 412, 429]);

/**
 * A conflict is bounded where an outage is not.
 *
 * Both are "not now", but they end differently. An outage ends by itself and
 * the change is still wanted when it does, so trying forever is right. A
 * conflict means somebody else wrote, and trying forever is a write war: two
 * tabs re-asserting their own version at each other, each one's success making
 * the other's next attempt fail. A few goes covers the ordinary case — a write
 * that crossed with another and only needs the newer version to retry against.
 * Past that, the disagreement is real, and the reader is what settles it.
 */
const CONFLICT_ATTEMPTS = 3;

function statusOf(error: unknown): number | undefined {
  // Two shapes, because two layers throw: axios puts the code on `response`,
  // and the hand-written calls put it on the error itself.
  const e = error as { response?: { status?: number }; status?: number } | undefined;
  return e?.response?.status ?? e?.status;
}

function worthRetrying(error: unknown, attemptsSoFar: number): boolean {
  const status = statusOf(error);
  if (typeof status !== 'number') return true; // never reached the server
  if (status === 409 || status === 412) return attemptsSoFar < CONFLICT_ATTEMPTS;
  if (RETRYABLE_4XX.has(status)) return true;
  return status < 400 || status >= 500;
}

/**
 * How long to wait before trying again.
 *
 * Backs off, and caps the wait so a change made offline lands when the network
 * returns rather than half a minute later. A conflict starts far shorter: the
 * server is plainly up and answering, and what the retry needs — the version it
 * lost to — the caller has already taken from the failure.
 */
function waitFor(attempt: number, status: number | undefined): number {
  if (status === 409 || status === 412) return 60 * attempt;
  return Math.min(30_000, 500 * 2 ** attempt);
}

async function pump(key: string): Promise<void> {
  if (running.has(key)) return;
  const job = owed.get(key);
  if (!job) return;
  owed.delete(key);
  running.add(key);
  try {
    await job.run();
    attempts.delete(key);
    running.delete(key);
  } catch (error) {
    running.delete(key);
    if (!worthRetrying(error, attempts.get(key) ?? 0)) {
      attempts.delete(key);
      // A conflict that has run out of goes is not a refusal to report: the
      // change was understood, it simply lost a race, and the next read puts
      // the two sides back in agreement without anybody being told off.
      const status = statusOf(error);
      if (status === 409 || status === 412) {
        console.debug(`${job.label} kept conflicting; leaving it to the next read`);
      } else {
        onPermanentFailure(job.label, error);
      }
      job.onGaveUp?.();
      announce();
      void pump(key);
      return;
    }
    // Put it back — unless the user has since asked for something else on the
    // same key, in which case that is what they want and this is stale.
    if (!owed.has(key)) owed.set(key, job);
    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    const status = statusOf(error);
    if (status === 409 || status === 412) {
      console.debug(`${job.label} crossed with another write; trying again`);
    } else {
      console.warn(`${job.label} did not reach the server (retrying):`, error);
    }
    const timer = timers.get(key);
    if (timer) clearTimeout(timer);
    timers.set(key, setTimeout(() => { timers.delete(key); void pump(key); }, waitFor(attempt, status)));
    announce();
    return;
  }
  announce();
  void pump(key);
}

/**
 * Owe the server a change, and stop thinking about it.
 *
 * Returns nothing on purpose. There is no outcome to await: the change has
 * already happened as far as the person who made it is concerned, and what
 * comes back from the server arrives through the same channel as everyone
 * else's changes do.
 */
export function send(
  key: string,
  label: string,
  run: () => Promise<unknown>,
  onGaveUp?: () => void,
): void {
  owed.set(key, { run, label, onGaveUp });
  announce();
  void pump(key);
}

/**
 * Try everything owed right now, whatever its backoff said.
 *
 * For the moment the connection comes back: waiting out a 30-second timer that
 * was set while the network was down is the one case where the backoff is
 * plainly wrong.
 */
export function flushOutbox(): void {
  for (const [key, timer] of timers) { clearTimeout(timer); timers.delete(key); }
  attempts.clear();
  for (const key of [...owed.keys()]) void pump(key);
}

/** Forget everything owed — for a fresh page or a change of world. */
export function resetOutbox(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  owed.clear();
  attempts.clear();
  announce();
}
