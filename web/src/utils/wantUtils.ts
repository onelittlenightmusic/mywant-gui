import { Want, UpdateWantRequest } from '@/types/want';

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
 * Update want parameters
 */
export async function updateWantParameters(
  wantId: string,
  want: Want,
  newParams: Record<string, any>,
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
      params: newParams
    }
  });
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
  // Determine what changed
  const added = Object.keys(newLabels).filter(key => !oldLabels[key]);
  const removed = Object.keys(oldLabels).filter(key => !newLabels[key]);
  const updated = Object.keys(newLabels).filter(key =>
    oldLabels[key] && oldLabels[key] !== newLabels[key]
  );

  // Remove deleted labels
  for (const key of removed) {
    await fetch(`/api/v1/wants/${wantId}/labels/${key}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Add new labels
  for (const key of added) {
    await fetch(`/api/v1/wants/${wantId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: newLabels[key] })
    });
  }

  // Update changed labels (delete old + add new)
  for (const key of updated) {
    await fetch(`/api/v1/wants/${wantId}/labels/${key}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    await fetch(`/api/v1/wants/${wantId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: newLabels[key] })
    });
  }
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
