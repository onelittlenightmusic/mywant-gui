import { extLeaves } from '@/utils/ext';

/**
 * Who owns a value in the shared GUI state: this tab, or the server.
 *
 * The rule, for every key alike — not one arrangement for the cursor, another
 * for the selected want, a third for the canvas scale:
 *
 *   A value this tab has changed is this tab's until the server confirms it.
 *   A value this tab has not changed is the server's, and a read applies it.
 *
 * That is the whole of it, and it replaces a set of per-key guards that each
 * described the same idea from a different angle — `standingOnWant`, an acked
 * want id, a four-second grace after choosing — and each had to be remembered
 * separately when a new key was added. They also each failed the same way: a
 * write is acked the moment it lands, which marks the tab "in sync" while
 * responses read from BEFORE the write are still on their way back. The panel
 * was at its most vulnerable exactly when it had just been opened.
 *
 * Pending is cleared by the value coming back, not by the write returning. A
 * key stays this tab's until the server says the same thing, so no reply that
 * was already in flight can contradict it.
 */

/** Key → the value this tab is waiting for the server to agree with. */
const pending = new Map<string, unknown>();

/** Mark keys as locally owned. Called with whatever a write is about to send. */
export function claimLocal(values: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(values)) {
    // ext is claimed leaf by leaf (ext.canvas.<character>.scale): a write
    // names only its own corner of it, and the whole object coming back
    // never equals that corner, so claiming "ext" would hold it back forever.
    if (k === 'ext') for (const [leaf, lv] of extLeaves(v, 'ext')) pending.set(leaf, lv);
    else pending.set(k, v);
  }
}

/**
 * Reconcile a snapshot from the server against what this tab is still waiting
 * on, and return only the keys a reader should apply.
 *
 * A pending key whose value now matches is no longer pending — the server has
 * caught up, and from here its word counts again.
 */
export function applicable(snapshot: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (k === 'ext') { out[k] = applicableExt(v, 'ext'); continue; }
    if (!pending.has(k)) { out[k] = v; continue; }
    // Compared by value, not identity: the server round-trips JSON, so the
    // number 3 that comes back is not the number 3 that went out.
    if (JSON.stringify(pending.get(k)) === JSON.stringify(v)) pending.delete(k);
    // Either way it is not applied: matching means it is already what we have.
  }
  return out;
}

/** Whether this tab is still waiting on a particular key. */
export function isPending(key: string): boolean {
  return pending.has(key);
}

/** Forget everything — for a fresh page or a character change. */
export function resetLocalClaims(): void {
  pending.clear();
}

/** applicable, one level of ext at a time: a pending leaf is left out. */
function applicableExt(value: unknown, path: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    const leaf = `${path}.${k}`;
    if (pending.has(leaf)) {
      if (JSON.stringify(pending.get(leaf)) === JSON.stringify(v)) pending.delete(leaf);
      continue;
    }
    out[k] = applicableExt(v, leaf);
  }
  return out;
}
