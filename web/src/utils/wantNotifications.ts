import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';

/**
 * Whether a want is allowed to show an unread badge at all.
 *
 * Some wants are scenery. A wall is the plainest case — it is a want, and it
 * can be notified like any other, but a room has walls on every side and a
 * count pinned to each of them says nothing anybody wants read. The board
 * already has this idea for attention (`highlightable: "false"`, see
 * useBoardGeometry) and for the want list (`list-visible: "false"`, see
 * useWantLists); this is the same opt-out for the third mark a scenery want was
 * still making.
 *
 * It suppresses the MARK, not the alert: the notification is still raised and
 * still counted by the server, so nothing is lost and taking the label off
 * brings the badge straight back.
 */

/** The label a want — or its type — sets to stop drawing its badge. */
export const NOTIFICATION_LABEL = 'notification';

/**
 * The rule: `notification: "false"`, on the want itself or on its type, means
 * no badge. Anything else, including the label being absent, means the badge
 * shows — so no existing want changes behaviour.
 *
 * A want's own label wins over its type's, in both directions: a type that
 * silences its wants can have one instance opt back in with
 * `notification: "true"`. That matters for exactly the case the board is full
 * of — a hundred walls quiet, and the one you care about audible again.
 *
 * The string `"false"` rather than anything falsy, because labels are strings
 * and the board's other boolean labels read the same way.
 */
export function labelsAllowNotification(
  wantLabel: string | undefined,
  typeLabel: string | undefined,
): boolean {
  if (wantLabel !== undefined) return wantLabel !== 'false';
  return typeLabel !== 'false';
}

/**
 * One want's answer, for a component that draws one badge (WantNotifyBadge).
 *
 * Selectors return the label STRINGS rather than the labels object: the want
 * list is rebuilt on every poll, so an object selector would re-render every
 * badge on the board every few seconds, while a string only changes when the
 * answer does.
 */
export function useWantAllowsNotification(wantId: string): boolean {
  const wantLabel = useWantStore(s =>
    s.wants.find(w => (w.metadata?.id || w.id) === wantId)?.metadata?.labels?.[NOTIFICATION_LABEL],
  );
  const typeName = useWantStore(s =>
    s.wants.find(w => (w.metadata?.id || w.id) === wantId)?.metadata?.type,
  );
  const typeLabel = useWantTypeStore(s =>
    s.wantTypes.find(t => t.name === typeName)?.labels?.[NOTIFICATION_LABEL],
  );
  return labelsAllowNotification(wantLabel, typeLabel);
}

/**
 * The same answer for every want at once, for a caller drawing marks in a loop
 * where a hook per item is not available (the minimap's own dots).
 *
 * Only the silenced ids are collected, because that is the short list: scenery
 * opts out, everything else is quiet about being quiet.
 */
export function useNotificationSilencedIds(): ReadonlySet<string> {
  const wants = useWantStore(s => s.wants);
  const wantTypes = useWantTypeStore(s => s.wantTypes);
  const silencedTypes = new Set(
    wantTypes.filter(t => t.labels?.[NOTIFICATION_LABEL] === 'false').map(t => t.name),
  );
  const ids = new Set<string>();
  for (const w of wants) {
    const id = w.metadata?.id || w.id;
    if (!id) continue;
    const own = w.metadata?.labels?.[NOTIFICATION_LABEL];
    const type = w.metadata?.type ?? '';
    if (!labelsAllowNotification(own, silencedTypes.has(type) ? 'false' : undefined)) ids.add(id);
  }
  return ids;
}
