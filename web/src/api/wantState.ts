import { apiClient } from './client';
import { send } from './outbox';
import { useWantStore } from '@/stores/wantStore';

/**
 * Writing to a want's state — the one way, for every card that does it.
 *
 * Five places wrote these by hand: the note's text and its done flag, the date
 * picker's fields, the plan overlay's approval, the card's clearing of a
 * finished device action. Each spelled out its own fetch, its own headers, its
 * own idea of what to do when it failed — mostly nothing, one a console.error —
 * and every one of them made the person who pressed the control wait for the
 * server before the control moved.
 *
 * They are the most-pressed things in the app. A toggle, a note, a time. So:
 *
 *   · the value goes into the store at once, and the card redraws from it,
 *   · the write is owed to the server through the outbox, which keeps trying,
 *   · the engine's own answer arrives by `want_changed` and replaces the lot.
 *
 * KEYED PER FIELD. Pressing a toggle twice supersedes rather than queues, and
 * a note being saved never sits behind a clock field that cannot get through.
 * The server takes one field at a time (PUT /api/v1/states/{id}/{key}), so
 * this is the shape it already wanted.
 */

/** Show a change on the card now, before anyone has been told about it. */
function applyLocally(wantId: string, updates: Record<string, unknown>): void {
  const store = useWantStore.getState();
  const want = store.wants.find(w => (w.metadata?.id || w.id) === wantId);
  if (!want) return;
  store.patchWant({
    ...want,
    state: { ...want.state, current: { ...want.state?.current, ...updates } },
  });
}

/** Set one or more state fields on a want. Returns as soon as it is shown. */
export function writeWantState(wantId: string, updates: Record<string, unknown>): void {
  if (!wantId) return;
  applyLocally(wantId, updates);
  for (const [key, value] of Object.entries(updates)) {
    send(`want:${wantId}:state:${key}`, `${key}`, async () => {
      const res = await fetch(`/api/v1/states/${wantId}/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      // fetch only rejects on a network failure; a refusal comes back as a
      // response, and the outbox reads the code off what is thrown.
      if (!res.ok) throw Object.assign(new Error(`state write failed: ${key}`), { status: res.status });
    });
  }
}

/** Remove a state field. Same key as writing it, so the two cannot cross. */
export function removeWantStateKey(wantId: string, key: string): void {
  if (!wantId) return;
  applyLocally(wantId, { [key]: undefined });
  send(`want:${wantId}:state:${key}`, `remove ${key}`, () => apiClient.deleteWantStateKey(wantId, key));
}
