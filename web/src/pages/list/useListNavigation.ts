import { useListOrderStore } from '@/stores/listOrderStore';
import { useMemo } from 'react';
import { Want } from '@/types/want';
import { useHierarchicalKeyboardNavigation } from '@/hooks/useHierarchicalKeyboardNavigation';
import { useInputActions } from '@/hooks/useInputActions';
import { playSound } from '@/utils/sounds';

/**
 * Walking the card grid.
 *
 * A direction here means the next card in reading order, not the next cell in
 * space — that is the whole difference between this page and the board, and it
 * is why this is switched off entirely while the canvas is up.
 *
 * Two things are in the list that are not wants: the Add Want tile and the
 * Open Archive divider. They are focusable like anything else and act on Enter,
 * which is what the second binding here is for — the hierarchical navigator
 * knows how to land on them but not what they do.
 */
export interface ListNavigationApi {
  canvasMode: boolean;
  isSelectMode: boolean;
  /** Flat list of ids with their parents — what the navigator walks. */
  hierarchicalWants: Array<{ id: string; parentId?: string }>;
  currentHierarchicalWant: { id: string; parentId?: string } | undefined;
  /** The wants the grid is showing, in the order it is showing them. */
  filteredWants: Want[];
  wants: Want[];
  /** The open balloon's ancestry, for placing the bubble in the walk order. */
  expandedChain: Want[];
  expandedParents: Set<string>;
  lastSelectedWantId: string | null;
  gridColumns: number;
  archiveOpen: boolean;
  setArchiveOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** The virtual slot currently focused, if the focus is not on a want. */
  focusedSlotId: string | null;
  setFocusedSlotId: (id: string | null) => void;
  sidebar: { clearSelection: () => void };
  /** Moving withdraws any standing request to see detail. */
  setDetailsRequestedFor: (id: string | null) => void;
  setDetailsDismissed: (v: boolean) => void;

  onViewWant: (item: { id: string; parentId?: string }, opts: { via: 'navigate' }) => void;
  onBubbleChildClick: (want: Want) => void;
  onToggleExpand: (wantId: string) => void;
  onCreateWant: () => void;
  onSelectWant: (id: string) => void;
  onEnterBubble: () => void;
}

export function useListNavigation(api: ListNavigationApi) {
  const {
    canvasMode, isSelectMode, hierarchicalWants, currentHierarchicalWant,
    filteredWants, wants, expandedChain, expandedParents, lastSelectedWantId,
    gridColumns, archiveOpen, setArchiveOpen, focusedSlotId, setFocusedSlotId,
    sidebar, setDetailsRequestedFor, setDetailsDismissed,
    onViewWant, onBubbleChildClick, onToggleExpand, onCreateWant, onSelectWant, onEnterBubble,
  } = api;

  const bubbleParentNavIndex = useMemo(() => {
    if (expandedChain.length === 0 || filteredWants.length === 0) return -1;
    const parentId = expandedChain[0]?.metadata?.id || expandedChain[0]?.id;
    const i = filteredWants.findIndex(w => (w.metadata?.id || w.id) === parentId);
    // Its place in the grid, which the order card leads.
    return i < 0 ? -1 : i + 1;
  }, [expandedChain, filteredWants]);
  const toggleOrder = useListOrderStore(s => s.toggle);
  const isSlot = (id: string | null) => id === '__add-want__' || id === '__open-archive__' || id === '__list-order__';

  useHierarchicalKeyboardNavigation({
    items: hierarchicalWants,
    currentItem: currentHierarchicalWant,
    onNavigate: (item) => {
      // The step, sounded once for every kind of thing you can step onto — a
      // want, a bubble child, or one of the virtual slots. Below this line the
      // branches diverge into three different handlers, which is exactly how
      // two of them ended up silent and the third played the opening whoosh.
      playSound('gridMove');
      if (isSlot(item.id)) {
        setFocusedSlotId(item.id);
        sidebar.clearSelection();
        return;
      }
      setFocusedSlotId(null);
      // Moving to another card withdraws any request to see detail — a request
      // is about the card you are on, exactly as it is about the tile you are
      // standing on.
      setDetailsRequestedFor(null);
      setDetailsDismissed(false);
      // Child want (has parentId) → use bubble child handler so balloon stays open
      if (item.parentId) {
        const childWant = wants.find(w => (w.metadata?.id === item.id) || (w.id === item.id));
        if (childWant) { onBubbleChildClick(childWant); return; }
      }
      onViewWant(item, { via: 'navigate' });
    },
    onToggleExpand,
    onSelect: (itemId: string) => {
      if (itemId === '__add-want__') { onCreateWant(); return; }
      if (itemId === '__open-archive__') { setArchiveOpen(v => !v); return; }
      if (itemId === '__list-order__') { toggleOrder('want'); return; }
      if (isSelectMode) { onSelectWant(itemId); return; }
      const hasChildren = hierarchicalWants.some(i => i.parentId === itemId);
      if (hasChildren) onToggleExpand(itemId);
    },
    expandedItems: expandedParents,
    lastSelectedItemId: lastSelectedWantId,
    enabled: !canvasMode,
    gridColumns,
    bubbleParentIndex: bubbleParentNavIndex,
    onEnterBubble,
    sectionBreaks: archiveOpen ? ['__open-archive__'] : undefined,
  });

  // Enter/A triggers actions on virtual navigation slots (the order card, Add Want, Open Archive).
  useInputActions({
    enabled: !canvasMode && isSlot(focusedSlotId),
    onConfirm: () => {
      if (focusedSlotId === '__add-want__') { onCreateWant(); return; }
      if (focusedSlotId === '__open-archive__') { setArchiveOpen(v => !v); return; }
      if (focusedSlotId === '__list-order__') { toggleOrder('want'); return; }
    },
  });
}
