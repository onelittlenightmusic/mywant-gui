import { useCallback, useMemo, useState } from 'react';
import { Want } from '@/types/want';
import type { WantTypeListItem } from '@/types/wantType';
import { isDraftWant } from '@/types/draft';
import { isUnplacedSystemWant } from '@/utils/wantPlacement';
import { isWantArchived } from '@/utils/wantUtils';

/**
 * The one filter everything else is derived from, and what sits on top of it.
 *
 * `regularWants` — wants filtered down to ones with a board presence at all
 * (see `isUnplacedSystemWant`) — is where the card grid, the canvas, the
 * minimap and the world thumbnail all trace back to. A want with no board
 * presence used to need its own copy of the same check in each of those, which
 * is how it kept showing up in whichever one hadn't been patched yet.
 *
 * Everything past that is smaller cuts of the same list: top-level versus
 * archived, which want is selected, which wants are somebody's children (the
 * one map both the card grid's bubbles and the canvas's expand badges read
 * from), and which parents are currently spread open on the canvas grid.
 */
export interface WantListsApi {
  wants: Want[];
  /** The sidebar's own idea of what is selected — resolved against `wants`
   *  below so a stale reference from before a poll still finds the want. */
  selectedItem: Want | null;
  sidebarWantTypes: WantTypeListItem[];
}

export function useWantLists(api: WantListsApi) {
  const { wants, selectedItem, sidebarWantTypes } = api;

  const drafts = useMemo(() => wants
    .filter(w => isDraftWant(w) && !(w.metadata?.ownerReferences && w.metadata.ownerReferences.length > 0)),
    [wants]);

  const hasThinkingDraft = drafts.some(d => {
    const phase = d.state?.current?.phase as string | undefined;
    return (d.state?.current?.isThinking as boolean) || phase === 'ideating' || phase === 'decomposing' || phase === 're_planning';
  });

  const regularWants = useMemo(() => wants.filter(w => !isUnplacedSystemWant(w)), [wants]);
  const allTopLevelWants = useMemo(
    () => regularWants.filter(w => !w.metadata?.ownerReferences?.some(r => r.controller && r.kind === 'Want')),
    [regularWants]
  );
  const topLevelWants = useMemo(
    () => allTopLevelWants.filter(w => !isWantArchived(w)),
    [allTopLevelWants]
  );

  const selectedWant = useMemo(() => {
    if (!selectedItem) return null;
    const wantId = selectedItem.metadata?.id || selectedItem.id;
    return wants.find(w => (w.metadata?.id === wantId) || (w.id === wantId)) || selectedItem;
  }, [selectedItem, wants]);

  /** Single parent→children map — single source of truth for child want lookup.
   *  Used by wantsForGrid (WantGrid) and canvasChildWants (canvas float card). */
  const childWantsByParentId = useMemo(() => {
    const map = new Map<string, Want[]>();
    regularWants.forEach(w => {
      const parentId = w.metadata?.ownerReferences?.[0]?.id;
      if (parentId) map.set(parentId, [...(map.get(parentId) ?? []), w]);
    });
    return map;
  }, [regularWants]);

  /** want type definitions whose labels['list-visible'] === 'false' — e.g. wall,
   *  which must stay on the canvas for collision but has no reason to clutter
   *  the dashboard card list. */
  const listHiddenTypeNames = useMemo(() =>
    new Set(sidebarWantTypes.filter(t => t.labels?.['list-visible'] === 'false').map(t => t.name)),
    [sidebarWantTypes]
  );

  /** Top-level wants with children pre-attached — passed to WantGrid so it no
   *  longer needs to recompute the hierarchy internally. */
  const wantsForGrid = useMemo(() =>
    regularWants
      .filter(w => !w.metadata?.name?.startsWith('__') && !w.metadata?.ownerReferences?.length)
      .filter(w => !listHiddenTypeNames.has(w.metadata?.type ?? ''))
      .map(w => ({ ...w, children: childWantsByParentId.get(w.metadata?.id || w.id || '') ?? [] })),
    [regularWants, childWantsByParentId, listHiddenTypeNames]
  );

  const canvasChildWants = useMemo(() => {
    if (!selectedWant) return [];
    return childWantsByParentId.get(selectedWant.metadata?.id || selectedWant.id || '') ?? [];
  }, [selectedWant, childWantsByParentId]);

  // Canvas child-expansion: parents whose children are spread onto the canvas grid
  // manualExpandedIds: toggled explicitly by user (badge click)
  // cursorAutoExpandedId: single parent auto-expanded while cursorman is on it
  const [manualExpandedIds, setManualExpandedIds] = useState<Set<string>>(new Set());
  const [cursorAutoExpandedId, setCursorAutoExpandedId] = useState<string | null>(null);
  const canvasExpandedIds = useMemo(() => {
    const s = new Set(manualExpandedIds);
    if (cursorAutoExpandedId) s.add(cursorAutoExpandedId);
    return s;
  }, [manualExpandedIds, cursorAutoExpandedId]);
  const handleToggleCanvasExpand = useCallback((parentId: string) => {
    setManualExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  }, []);
  const canvasExpandedChildWants = useMemo(() => {
    const out: Want[] = [];
    canvasExpandedIds.forEach(pid => {
      (childWantsByParentId.get(pid) ?? []).forEach(c => out.push(c));
    });
    return out;
  }, [canvasExpandedIds, childWantsByParentId]);
  const canvasChildCounts = useMemo(() => {
    const m = new Map<string, number>();
    childWantsByParentId.forEach((children, pid) => m.set(pid, children.length));
    return m;
  }, [childWantsByParentId]);

  return {
    drafts, hasThinkingDraft,
    regularWants, allTopLevelWants, topLevelWants,
    selectedWant,
    childWantsByParentId, listHiddenTypeNames, wantsForGrid,
    canvasChildWants,
    manualExpandedIds, setManualExpandedIds,
    cursorAutoExpandedId, setCursorAutoExpandedId,
    canvasExpandedIds, handleToggleCanvasExpand,
    canvasExpandedChildWants, canvasChildCounts,
  };
}
