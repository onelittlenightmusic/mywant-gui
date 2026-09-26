import { useInputActions } from './useInputActions';

export interface HierarchicalItem {
  id: string;
  parentId?: string;
}

interface UseHierarchicalKeyboardNavigationProps<T extends HierarchicalItem> {
  items: T[];
  currentItem: T | null;
  onNavigate: (item: T) => void;
  onToggleExpand?: (itemId: string) => void;
  onSelect?: (itemId: string) => void;
  expandedItems?: Set<string>;
  lastSelectedItemId?: string | null;
  enabled?: boolean;
  /** Number of columns in the grid — enables row-aware up/down navigation */
  gridColumns?: number;
  /** Index of the balloon-parent in the top-level items array (-1 = no balloon) */
  bubbleParentIndex?: number;
  /** Called when up/down navigation should enter the open balloon */
  onEnterBubble?: () => void;
  /**
   * IDs of items that mark a visual section break (e.g. a col-span-full separator row
   * follows immediately after this item in the DOM).  When DOWN is pressed from such an
   * item, navigation falls back to sequential (getNextTopLevel) instead of +cols, so
   * the cursor correctly enters the section below the separator.  When UP is pressed
   * from an item within that section and the column-jump would cross back over a section
   * break, the break item is returned instead.
   */
  sectionBreaks?: string[];
}

/**
 * Hook for hierarchical keyboard / gamepad navigation.
 *
 * Arrow key / D-pad / left-stick mapping:
 *   Right  – if parent is expanded move to first child; else move to next top-level
 *   Left   – move to previous sibling; if first child, move to parent; if top-level, move to previous top-level
 *   Down   – next top-level item
 *   Up     – previous top-level item
 *   Enter / Space / Gamepad A – toggle expand/collapse (or call onSelect when provided)
 *   Home   – first item
 *   End    – last item
 */
export const useHierarchicalKeyboardNavigation = <T extends HierarchicalItem>({
  items,
  currentItem,
  onNavigate,
  onToggleExpand,
  onSelect,
  expandedItems,
  lastSelectedItemId,
  enabled = true,
  gridColumns,
  bubbleParentIndex = -1,
  onEnterBubble,
  sectionBreaks,
}: UseHierarchicalKeyboardNavigationProps<T>) => {
  const sectionBreakSet = new Set(sectionBreaks ?? []);
  useInputActions({
    enabled,

    onNavigate: (dir) => {
      if (items.length === 0) return;
      // Determine the reference item for navigation (current or last selected)
      let refItem: T | null = currentItem;
      if (!refItem && lastSelectedItemId) {
        refItem = items.find(i => i.id === lastSelectedItemId) ?? null;
      }

      // If no reference, default to first / last item and still focus the card
      if (!refItem) {
        const fallback = dir === 'up' ? items[items.length - 1] : items[0];
        if (!fallback) return;
        onNavigate(fallback);
        const fallbackId = fallback.id;
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.querySelector(`[data-keyboard-nav-id="${fallbackId}"]`);
            if (el instanceof HTMLElement) {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 0);
        });
        return;
      }

      let nextItem: T | null = null;

      // Read the live column count directly from the DOM grid element so we
      // always have the current layout even if the gridColumns prop has not
      // propagated through a render cycle yet.
      const readLiveCols = (): number => {
        const el = document.getElementById('want-grid-container');
        if (el) {
          try {
            const tracks = window.getComputedStyle(el).gridTemplateColumns;
            const n = tracks.split(' ').filter(Boolean).length;
            if (n > 1) return n;
          } catch { /* fall through */ }
        }
        return (gridColumns && gridColumns > 1) ? gridColumns : 1;
      };

      switch (dir) {
        case 'right': {
          if (!refItem.parentId) {
            const hasChildren = items.some(i => i.parentId === refItem!.id);
            const isExpanded = expandedItems?.has(refItem!.id);
            nextItem = (hasChildren && isExpanded)
              ? getFirstChild(items, refItem)
              : getNextTopLevel(items, refItem);
          } else {
            // Inside balloon: stay within siblings, don't leak out to top-level
            nextItem = getNextSibling(items, refItem);
          }
          break;
        }
        case 'left': {
          if (refItem.parentId) {
            // Inside balloon: stay within siblings, don't navigate to parent
            nextItem = getPreviousSibling(items, refItem);
          } else {
            nextItem = getPreviousTopLevel(items, refItem);
          }
          break;
        }
        case 'down': {
          const liveCols = readLiveCols();
          const cols = liveCols > 1 ? liveCols : 0;
          if (refItem.parentId !== undefined) {
            // Currently inside the balloon — exit down to first item of row after balloon
            if (cols && bubbleParentIndex >= 0) {
              const topLevel = getTopLevelItems(items);
              const rowP = Math.floor(bubbleParentIndex / cols);
              nextItem = topLevel[(rowP + 1) * cols] ?? null;
            } else {
              nextItem = getNextTopLevel(items, refItem);
            }
          } else if (cols) {
            const topLevel = getTopLevelItems(items);
            const vi = topLevel.findIndex(i => i.id === refItem!.id);
            if (vi < 0) { nextItem = getNextTopLevel(items, refItem); break; }
            // If balloon is open and current row is the balloon parent's row → enter balloon
            if (bubbleParentIndex >= 0 && onEnterBubble) {
              const rowCurrent = Math.floor(vi / cols);
              const rowP = Math.floor(bubbleParentIndex / cols);
              if (rowCurrent === rowP) { onEnterBubble(); return; }
            }
            // Section break: the item sits just before a col-span-full separator row,
            // so column arithmetic would skip over or miss the section below.
            // Fall back to sequential navigation to land on the first item of the next section.
            if (sectionBreakSet.has(refItem!.id)) {
              nextItem = getNextTopLevel(items, refItem);
            } else {
              nextItem = topLevel[vi + cols] ?? null;
            }
          } else {
            nextItem = getNextTopLevel(items, refItem);
          }
          break;
        }
        case 'up': {
          const liveCols = readLiveCols();
          const cols = liveCols > 1 ? liveCols : 0;
          if (refItem.parentId !== undefined) {
            // Currently inside the balloon — exit up to the parent card
            if (bubbleParentIndex >= 0) {
              const topLevel = getTopLevelItems(items);
              nextItem = topLevel[bubbleParentIndex] ?? null;
            } else {
              nextItem = getPreviousTopLevel(items, refItem);
            }
          } else if (cols) {
            const topLevel = getTopLevelItems(items);
            const vi = topLevel.findIndex(i => i.id === refItem!.id);
            if (vi < 0) { nextItem = getPreviousTopLevel(items, refItem); break; }
            // If balloon is open and current row is immediately below the balloon → enter balloon
            if (bubbleParentIndex >= 0 && onEnterBubble) {
              const rowCurrent = Math.floor(vi / cols);
              const rowP = Math.floor(bubbleParentIndex / cols);
              if (rowCurrent === rowP + 1) { onEnterBubble(); return; }
            }
            const targetVi = vi - cols;
            // Section break: if a section-break item lies between targetVi and vi,
            // the column-jump would cross the separator — navigate to the break item instead.
            if (targetVi >= 0 && sectionBreakSet.size > 0) {
              const between = topLevel.slice(targetVi, vi);
              const breakItem = between.find(i => sectionBreakSet.has(i.id));
              if (breakItem) { nextItem = breakItem; break; }
            }
            nextItem = targetVi >= 0 ? topLevel[targetVi] : null;
          } else {
            nextItem = getPreviousTopLevel(items, refItem);
          }
          break;
        }
        case 'home':
          nextItem = items[0] ?? null;
          break;
        case 'end':
          nextItem = items[items.length - 1] ?? null;
          break;
      }

      if (!nextItem) {
        // At a boundary (e.g. leftmost card, rightmost card). If we arrived here
        // from a lastSelectedItemId reference rather than an active currentItem,
        // re-focus that reference card so the user re-enters focus from wherever
        // they last were.
        if (!currentItem && refItem) {
          onNavigate(refItem);
          const refId = refItem.id;
          requestAnimationFrame(() => {
            setTimeout(() => {
              const el = document.querySelector(`[data-keyboard-nav-id="${refId}"]`);
              if (el instanceof HTMLElement) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 0);
          });
        }
        return;
      }
      onNavigate(nextItem);

      const targetId = nextItem.id;
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = document.querySelector(`[data-keyboard-nav-id="${targetId}"]`);
          if (el instanceof HTMLElement) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 0);
      });
    },

    onConfirm: () => {
      if (!currentItem) return;
      if (onSelect) {
        onSelect(currentItem.id);
      } else {
        const hasChildren = items.some(i => i.parentId === currentItem.id);
        if (hasChildren && onToggleExpand) {
          onToggleExpand(currentItem.id);
        }
      }
    },
  });
};

// ─── Hierarchy helpers ────────────────────────────────────────────────────────

function getSiblings<T extends HierarchicalItem>(items: T[], item: T): T[] {
  return items.filter(i => i.parentId === item.parentId);
}

function getNextSibling<T extends HierarchicalItem>(items: T[], item: T | null): T | null {
  if (!item) return items[0] ?? null;
  const siblings = getSiblings(items, item);
  const idx = siblings.findIndex(s => s.id === item.id);
  return idx < siblings.length - 1 ? siblings[idx + 1] : null;
}

function getPreviousSibling<T extends HierarchicalItem>(items: T[], item: T | null): T | null {
  if (!item) return null;
  const siblings = getSiblings(items, item);
  const idx = siblings.findIndex(s => s.id === item.id);
  return idx > 0 ? siblings[idx - 1] : null;
}

function getFirstChild<T extends HierarchicalItem>(items: T[], item: T): T | null {
  return items.find(i => i.parentId === item.id) ?? null;
}

function getParent<T extends HierarchicalItem>(items: T[], item: T): T | null {
  if (!item.parentId) return null;
  return items.find(i => i.id === item.parentId) ?? null;
}

function getTopLevelItems<T extends HierarchicalItem>(items: T[]): T[] {
  return items.filter(i => !i.parentId);
}

function getNextTopLevel<T extends HierarchicalItem>(items: T[], item: T | null): T | null {
  if (!item) return null;
  let ref = item.parentId ? (getParent(items, item) ?? item) : item;
  const topLevel = getTopLevelItems(items);
  const idx = topLevel.findIndex(i => i.id === ref.id);
  return idx < topLevel.length - 1 ? topLevel[idx + 1] : null;
}

function getPreviousTopLevel<T extends HierarchicalItem>(items: T[], item: T | null): T | null {
  if (!item) return null;
  let ref = item.parentId ? (getParent(items, item) ?? item) : item;
  const topLevel = getTopLevelItems(items);
  const idx = topLevel.findIndex(i => i.id === ref.id);
  return idx > 0 ? topLevel[idx - 1] : null;
}
