import { Want, UpdateWantRequest, WantPatch } from '@/types/want';
import { apiClient } from '@/api/client';

/** Label set by archiveWant()/unarchiveWant() (see wantStore.ts). */
export const ARCHIVE_LABEL = 'mywant.io/archived';

/** True if the want has been archived (hidden from canvas; shown in WantGrid's archive drawer). */
export function isWantArchived(want: Want): boolean {
  return want.metadata?.labels?.[ARCHIVE_LABEL] === 'true';
}

/**
 * The wants a list shows, in the order it shows them: the archived ones left
 * out (they have their own drawer), sorted by order key — or by the order this
 * tab has just claimed, while the server catches up (wantStore.orderOverride).
 *
 * One function, so the list and its map cannot disagree. The map used to read
 * this off the grid as the grid drew; a map drawn where no grid is (an app's
 * map sheet) then had nothing to read and showed every want there was — walls,
 * archived ones and all.
 */
export function listedWants<T extends Want>(wants: T[], orderOverride: string[] | null): T[] {
  const claimed = orderOverride ? new Map(orderOverride.map((id, i) => [id, i])) : null;
  return wants.filter(want => !isWantArchived(want)).sort((a, b) => {
    if (claimed) {
      // Anything the claim does not name (arrived since) sorts after what it
      // does, in its own key order, rather than jumping to the front.
      const ia = claimed.get(a.metadata?.id || a.id || '');
      const ib = claimed.get(b.metadata?.id || b.id || '');
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
    }
    // Sort by orderKey if available, otherwise fall back to ID
    const keyA = a.metadata?.orderKey || a.metadata?.id || '';
    const keyB = b.metadata?.orderKey || b.metadata?.id || '';
    return keyA.localeCompare(keyB);
  });
}

/**
 * State fields that change while a want is at work rather than when it has
 * something new: the engine's own (a leading `_`), who ran it, a poll's
 * heartbeat, how far along it is, a tool's raw output before it is read.
 * robot's last_poll_at moves every few seconds and the Yahoo web want's
 * action_by_agent with it, and both sat at the top of 最近 without anything
 * new in them.
 */
const BOOKKEEPING_FIELDS = new Set([
  'action_by_agent', 'last_poll_at', 'achieving_percentage', 'mrs_raw_output',
  'status', 'completed', 'achieved', 'current_session_state',
]);

/**
 * When a want last had something new.
 *
 * Its result, when it has one (`final_result`, which the engine keeps): a
 * check that has started is not news, what it found is — smartgolf rose to the
 * top as it began to look, and belongs there when it has found out. Without a
 * result, the newest of its fields that are not bookkeeping (above). Else when
 * it was made (mywant.io/created-at). 0 when none is known. The server stamps
 * a field only when its value changes.
 *
 * The keyboard's 最近 reads wants the same way (mywant-ios PaletteFetch).
 */
export function wantUpdatedAt(want: Want): number {
  const created = Date.parse(want.metadata?.labels?.['mywant.io/created-at'] ?? '') || 0;
  const stamps = want.state_timestamps ?? {};
  const result = Date.parse(stamps['final_result'] ?? '');
  if (result) return Math.max(result, created);
  let latest = created;
  for (const [key, at] of Object.entries(stamps)) {
    if (key.startsWith('_') || BOOKKEEPING_FIELDS.has(key)) continue;
    const t = Date.parse(at);
    if (t > latest) latest = t;
  }
  return latest;
}

/**
 * A list in the 最近 order (ListOrderCard): the want updated last first. Ties,
 * and wants with no time known, keep the order they came in — the user's own.
 */
export function newestWantsFirst<T extends Want>(wants: T[]): T[] {
  return wants
    .map((w, i) => ({ w, i, at: wantUpdatedAt(w) }))
    .sort((a, b) => (b.at - a.at) || (a.i - b.i))
    .map(({ w }) => w);
}

/**
 * Update want parameters: only the ones that changed go to the server (PATCH),
 * a removed one as null — not the whole want rebuilt from this copy, whose
 * labels the canvas may have moved on from since it was read.
 */
export async function updateWantParameters(
  wantId: string,
  want: Want,
  newParams: Record<string, any>,
  patchFn: (id: string, patch: WantPatch) => Promise<unknown>
): Promise<void> {
  const old = (want.spec?.params ?? {}) as Record<string, unknown>;
  const params: Record<string, unknown> = {};
  for (const key of Object.keys(old)) {
    if (!(key in newParams)) params[key] = null;
  }
  for (const [key, value] of Object.entries(newParams)) {
    if (JSON.stringify(old[key]) !== JSON.stringify(value)) params[key] = value;
  }
  if (Object.keys(params).length === 0) return;
  await patchFn(wantId, { params });
}

/**
 * Update want scheduling
 */
export async function updateWantScheduling(
  wantId: string,
  want: Want,
  newWhen: Want['spec']['when'],
  updateWantFn: (id: string, request: UpdateWantRequest) => Promise<void>
): Promise<void> {
  await updateWantFn(wantId, {
    metadata: {
      name: want.metadata?.name,
      type: want.metadata?.type,
      labels: want.metadata?.labels
    },
    spec: {
      ...want.spec,
      when: newWhen
    }
  });
}

/**
 * Update want labels via API endpoints
 */
export async function updateWantLabels(
  wantId: string,
  oldLabels: Record<string, string>,
  newLabels: Record<string, string>
): Promise<void> {
  // One PATCH with every change: a removed label null, an added or changed one
  // its value. It was a DELETE and a POST per label — never at once, and a key
  // with a "/" in it (mywant.io/…, constellation/…) could not be deleted at
  // all, its slash ending the URL's path segment.
  const patch: Record<string, string | null> = {};
  for (const key of Object.keys(oldLabels)) {
    if (!(key in newLabels)) patch[key] = null;
  }
  for (const [key, value] of Object.entries(newLabels)) {
    if (oldLabels[key] !== value) patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return;
  await apiClient.patchWant(wantId, { labels: patch });
}

/**
 * Update want dependencies via API endpoints
 */
export async function updateWantDependencies(
  wantId: string,
  oldUsing: Array<Record<string, string>>,
  newUsing: Array<Record<string, string>>
): Promise<void> {
  // Simple approach: remove all old, add all new
  // Remove all old dependencies
  for (const dep of oldUsing) {
    const key = Object.keys(dep)[0];
    if (key) {
      await fetch(`/api/v1/wants/${wantId}/using/${key}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Add all new dependencies
  for (const dep of newUsing) {
    const [key, value] = Object.entries(dep)[0];
    if (key) {
      await fetch(`/api/v1/wants/${wantId}/using`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
    }
  }
}

/**
 * This want on its own, in a new tab — the /w/:id page a home-screen icon
 * points at. The card menu's "Open w" and the expanded card's Max.
 */
export function openWantApp(want: Want): void {
  const id = want.metadata?.id || want.id;
  if (id) window.open(`/w/${id}`, '_blank', 'noopener,noreferrer');
}
