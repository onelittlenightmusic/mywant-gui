/**
 * wantHashCache — module-level ETag cache for smart polling.
 *
 * Maintains:
 *   collectionETag  — the collection-level hash from GET /api/v1/wants/hashes
 *   wantETags       — per-want hash, used as If-None-Match on GET /api/v1/wants/{id}
 *
 * smartPollWants() executes the 3-phase polling strategy:
 *   1. GET /api/v1/wants/hashes  (If-None-Match: collectionETag)
 *      → 304  → nothing changed, return early
 *      → 200  → diff against cached hashes
 *   2. Identify changed IDs and removed IDs
 *   3. GET /api/v1/wants/{id} in parallel for changed IDs (If-None-Match per want)
 *      → 304  → skip
 *      → 200  → call patchWant()
 *      removed IDs → call removeWantById()
 */

import { apiClient } from '@/api/client';
import type { Want } from '@/types/want';

// Actions are registered by wantStore after creation to avoid circular imports
type PatchWantFn = (updated: Want) => void;
type PatchWantsFn = (updatedList: Want[]) => void;
type RemoveWantByIdFn = (id: string) => void;

let _patchWant: PatchWantFn | null = null;
let _removeWantById: RemoveWantByIdFn | null = null;
let _patchWants: PatchWantsFn | null = null;

/** Called from wantStore once the store is created. */
export function registerWantCacheActions(
  patchWant: PatchWantFn,
  removeWantById: RemoveWantByIdFn,
  patchWants: PatchWantsFn
) {
  _patchWant = patchWant;
  _removeWantById = removeWantById;
  _patchWants = patchWants;
}

// Module-level ETag state
let collectionETag: string | undefined = undefined;
const wantETags = new Map<string, string>(); // id → hash

/**
 * Seed the ETag cache from the initial full fetchWants() response.
 * Call this right after the first successful want list load.
 */
export function seedWantETags(wants: Array<{ metadata?: { id?: string }; hash?: string }>) {
  wants.forEach(w => {
    const id = w.metadata?.id;
    if (id && w.hash) wantETags.set(id, w.hash);
  });
}

/** Read the cached ETag for a single want (used by fetchWantDetails). */
export function getWantETag(id: string): string | undefined {
  return wantETags.get(id);
}

/** Update the cached ETag for a single want after a successful detail fetch. */
export function setWantETag(id: string, hash: string) {
  wantETags.set(id, hash);
}

/**
 * Invalidate the collection ETag (e.g. after create/delete/update mutation)
 * so the next smartPollWants() forces a full re-check.
 */
export function invalidateCollectionETag() {
  collectionETag = undefined;
}

/**
 * Guard for mutations that rewrite data the poller also owns — reordering, for
 * one, which rewrites the order key of every affected want and then re-lists.
 *
 * The `polling` flag alone only prevents two polls from overlapping each other;
 * it does nothing about a poll that overlaps a *mutation*. A poll that read the
 * hashes before a reorder and landed after it would patch the pre-reorder order
 * keys back over the fresh ones, and since the grid sorts by order key the
 * cards visibly snapped back to where they started — the reorder looked like it
 * had failed.
 *
 * Suspending covers both directions: no new poll starts while a mutation is in
 * flight, and any poll already running has its results discarded, because the
 * epoch it captured at entry no longer matches.
 */
let suspendDepth = 0;
let mutationEpoch = 0;

export function suspendWantPolling(): () => void {
  suspendDepth++;
  mutationEpoch++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suspendDepth--;
  };
}

/**
 * 3-phase smart polling for wants.
 * An in-flight guard prevents concurrent executions.
 */
let polling = false;

export async function smartPollWants(): Promise<void> {
  if (polling) return;
  if (suspendDepth > 0) return;
  if (!_patchWant || !_removeWantById || !_patchWants) return; // not yet registered

  const epoch = mutationEpoch;
  /** True once a mutation has started since this poll read its snapshot. */
  const isStale = () => suspendDepth > 0 || epoch !== mutationEpoch;

  polling = true;
  try {
    // Phase 1: lightweight hash check
    const hashesResponse = await apiClient.listWantHashes(collectionETag);

    // 304 → collection unchanged, nothing to do
    if (hashesResponse === null) return;

    collectionETag = hashesResponse.collection_hash;

    // Phase 2: diff
    const incomingIds = new Set(hashesResponse.wants.map(e => e.id));
    const removedIds = [...wantETags.keys()].filter(id => !incomingIds.has(id));
    const changedEntries = hashesResponse.wants.filter(
      e => wantETags.get(e.id) !== e.hash
    );

    // Phase 3: parallel fetch of only the changed wants. Results are applied
    // to the store in one batched patchWants() call after they've ALL
    // resolved, rather than one patchWant() call per want as each network
    // request happens to land — several wants' hashes commonly change
    // together (e.g. every sibling's orderKey shifting after a reorder),
    // and applying those one at a time caused WantGrid's sibling FLIP
    // animation to replay once per want, with the list order visibly
    // wobbling through partially-updated intermediate states.
    if (changedEntries.length > 0) {
      console.log(`[TIMING] smartPollWants: ${changedEntries.length} changed want(s) detected`);
    }
    const updatedWants: Want[] = [];
    await Promise.all(
      changedEntries.map(async ({ id, hash }) => {
        try {
          const result = await apiClient.getWantConditional(id, wantETags.get(id));
          if (result.data !== null) {
            const hasPending = !!(result.data as any).state?.current?.pending_device_action;
            if (hasPending) console.log(`[TIMING] smartPollWants: pending_device_action found on ${id}`);
            updatedWants.push(result.data);
          }
          wantETags.set(id, hash);
        } catch (err: any) {
          // ハッシュ一覧を取ってから個別取得するまでの間に削除されると 404 になる。
          // 想定内のレースなので、消えたものとして扱いポーリング全体は止めない。
          if (err?.status === 404) {
            _removeWantById!(id);
            wantETags.delete(id);
            return;
          }
          throw err;
        }
      })
    );
    // A mutation started while those requests were in flight, so this snapshot
    // predates it. Applying it would resurrect the pre-mutation state; drop it
    // and let the collection ETag invalidation force a clean re-check.
    if (isStale()) {
      collectionETag = undefined;
      // These were marked as seen while the responses came back. Forget them
      // too, or the next poll would treat wants it never applied as up to date.
      changedEntries.forEach(({ id }) => wantETags.delete(id));
      return;
    }

    if (updatedWants.length > 0) _patchWants!(updatedWants);

    removedIds.forEach(id => {
      _removeWantById!(id);
      wantETags.delete(id);
    });
  } catch (err) {
    console.error('[smartPollWants] error:', err);
  } finally {
    polling = false;
  }
}
