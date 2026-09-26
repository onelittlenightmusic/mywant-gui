import React, { useState, useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { Search, Package, HelpCircle, X } from 'lucide-react';
import { WantTypeListItem } from '@/types/wantType';
import { GenericRecipe } from '@/types/recipe';
import { getBackgroundStyle, getBackgroundToneColor } from '@/utils/backgroundStyles';
import { getCategoryBgLight, getCategoryBgDark, getCategoryHexColor, type IconFamily } from '@/components/dashboard/WantTypeVisuals';
import { WantIcon } from '@/components/dashboard/WantIcon';
import { WantCardFace, wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { useSeedFlightStore } from '@/stores/seedFlightStore';
import { useConfigStore } from '@/stores/configStore';
import { useColorMode } from '@/hooks/useColorMode';
import { suppressDragImage } from '@/utils/helpers';
import { useWantStore } from '@/stores/wantStore';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { playSound } from '@/utils/sounds';
import { OverlayActionGrid, OverlayItem } from '@/components/common/OverlayActionGrid';

// ─── Shared constants ─────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  system:      'bg-slate-600',
  travel:      'bg-sky-600',
  queue:       'bg-violet-600',
  mathematics: 'bg-emerald-600',
  math:        'bg-emerald-600',
  approval:    'bg-amber-600',
};

// ─── Reusable single slot ────────────────────────────────────────────────────

export interface WantSlotProps {
  /** want type name or recipe custom_type */
  id: string;
  itemType: 'want-type' | 'recipe';
  category?: string;
  /** Slot side length in px (default 56) */
  size?: number;
  className?: string;
}

/**
 * Single Minecraft-style inventory slot.
 * Shared between WantInventoryPicker (grid) and WantForm (selected-type header).
 */
export const WantSlot: React.FC<WantSlotProps> = ({
  id,
  itemType,
  category,
  size = 56,
  className = '',
}) => {
  // Subscribe so the component re-renders when dynamic category colors load from the API.
  useWantTypeStore(s => s.categoryBgMap);
  useWantTypeStore(s => s.categoryIconMap);
  useWantTypeStore(s => s.typeIconMap);
  const iconFont = useIconFont() as IconFamily;
  const colorMode = useColorMode();

  const isLight = colorMode !== 'dark';
  const bg = getBackgroundStyle(id);
  const slotBg = colorMode === 'dark'
    ? getCategoryBgDark(category ?? '')
    : getCategoryBgLight(category ?? '');
  const iconSize = Math.round(size * 0.38 * 1.5);
  // Same want-type colour and emboss the grid's cards and the want card's badge
  // use, rather than a flat white/grey glyph.
  const typeIconStyle = wantTypeIconStyle(id, category ?? '', !isLight);
  const icon = itemType === 'recipe'
    ? <Package style={{ width: iconSize, height: iconSize, ...typeIconStyle }} />
    : <WantIcon
        typeName={id}
        category={category ?? ''}
        iconFont={iconFont}
        size={iconSize}
        isLight={isLight}
        iconStyle={typeIconStyle}
        iconClassName="flex-shrink-0"
      />;

  return (
    <div
      className={[
        'relative rounded-sm overflow-hidden flex-shrink-0',
        'border border-black/50 dark:border-black/70',
        'shadow-[inset_2px_2px_0px_rgba(255,255,255,0.22),inset_-2px_-2px_0px_rgba(0,0,0,0.35)]',
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      {bg.hasBackgroundImage ? (
        <>
          <div
            className="absolute inset-0"
            style={{ ...bg.style, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div className="absolute inset-0 bg-black/25" />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: slotBg }} />
      )}
      <div className="relative z-10 flex items-center justify-center w-full h-full">
        {icon}
      </div>
    </div>
  );
};

// ─── Slot-level overlay helpers ───────────────────────────────────────────────
// buildSlotItems() builds the OverlayItem list for a single inventory slot.
// Rendered inside the <button> element so absolute inset-0 covers only the icon square.

function buildSlotItems(item: SlotItem, onClose: () => void): OverlayItem[] {
  const helpUrl =
    item.type === 'want-type' ? `/want-types?focus=${encodeURIComponent(item.id)}` :
    item.type === 'recipe'    ? `/recipes?focus=${encodeURIComponent(item.id)}`    :
    null;

  return [
    ...(helpUrl ? [{
      icon:       <HelpCircle className="w-3 h-3 text-white" />,
      title:      'Help',
      onClick:    () => { onClose(); window.open(helpUrl, '_blank'); },
      colorClass: 'bg-indigo-600/90',
      delay:      0,
    }] : []),
    {
      icon:       <X className="w-3 h-3 text-white" />,
      title:      'Close',
      onClick:    onClose,
      colorClass: 'bg-gray-600/90',
      delay:      helpUrl ? 30 : 0,
    },
  ];
}

// ─── Inventory picker ─────────────────────────────────────────────────────────

interface SlotItem {
  id: string;
  type: 'want-type' | 'recipe';
  name: string;
  title: string;
  description: string;
  category?: string;
}

type SortMode = 'name' | 'category';

interface WantInventoryPickerProps {
  wantTypes: WantTypeListItem[];
  recipes: GenericRecipe[];
  onSelect: (id: string, itemType: 'want-type' | 'recipe') => void;
}

export interface WantInventoryPickerRef {
  navigate: (dir: 'up' | 'down' | 'left' | 'right') => void;
  confirmFocused: () => void;
  focusSearch: () => void;
  showContextMenuForFocused: () => void;
}

const GRID_COLS_DESKTOP = 4;
const GRID_COLS_MOBILE  = 3;
const GRID_COLS = typeof window !== 'undefined' && window.innerWidth < 640
  ? GRID_COLS_MOBILE
  : GRID_COLS_DESKTOP;

interface TooltipState {
  item: SlotItem;
  x: number;
  y: number;
  above: boolean;
}

interface OverlayState {
  item: SlotItem;
}

export const WantInventoryPicker = forwardRef<WantInventoryPickerRef, WantInventoryPickerProps>(
function WantInventoryPicker({
  wantTypes,
  recipes,
  onSelect,
}, ref) {
  // Subscribe so the grid re-renders when dynamic category colors load from the API.
  useWantTypeStore(s => s.categoryBgMap);
  const iconFont = useIconFont() as IconFamily;
  const colorMode = useColorMode();
  const startFlight = useSeedFlightStore((st) => st.startFlight);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const slotButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const renderedItemsRef = useRef<SlotItem[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const t = setTimeout(() => {
      const el = searchRef.current;
      if (!el) return;
      // Only focus when the sidebar is intentionally open.
      // RightSidebar sets data-sidebar-open based on its isOpen prop (via
      // useLayoutEffect), so this reflects intended state, not CSS animation.
      const sidebar = el.closest('[data-sidebar="true"]');
      if (sidebar && !sidebar.hasAttribute('data-sidebar-open')) return;
      el.focus();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  const items = useMemo((): SlotItem[] => {
    const wantTypeItems: SlotItem[] = wantTypes.map(wt => ({
      id: wt.name,
      type: 'want-type',
      name: wt.name,
      title: wt.title || wt.name,
      description: '',
      category: wt.category,
    }));
    const recipeItems: SlotItem[] = recipes
      .filter(r => r.recipe?.metadata?.custom_type)
      .map(r => ({
        id: r.recipe.metadata.custom_type!,
        type: 'recipe',
        name: r.recipe.metadata.custom_type!,
        title: r.recipe.metadata.name || r.recipe.metadata.custom_type!,
        description: r.recipe.metadata.description || '',
        category: r.recipe.metadata.category,
      }));
    return [...wantTypeItems, ...recipeItems];
  }, [wantTypes, recipes]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const groups = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      if (sortMode === 'name') return a.title.localeCompare(b.title);
      if (a.type !== b.type) return a.type === 'want-type' ? -1 : 1;
      const catCmp = (a.category || '').localeCompare(b.category || '');
      return catCmp !== 0 ? catCmp : a.title.localeCompare(b.title);
    });

    if (sortMode === 'name') {
      return [{ label: null as string | null, items: sorted }];
    }

    const map = new Map<string, SlotItem[]>();
    sorted.forEach(item => {
      const key = item.category || 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return Array.from(map.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
  }, [filteredItems, sortMode]);

  // Flat list in rendered order (row-major across groups) — used for D-pad navigation
  const renderedItems = useMemo(() => groups.flatMap(g => g.items), [groups]);
  renderedItemsRef.current = renderedItems;
  slotButtonRefs.current.length = renderedItems.length;

  // Visual (row, col) for each flat index, accounting for group boundaries.
  // Each group starts on its own set of rows in its own GRID_COLS-wide grid.
  const gridPositions = useMemo(() => {
    const positions: Array<{ row: number; col: number }> = [];
    let currentRow = 0;
    for (const group of groups) {
      for (let k = 0; k < group.items.length; k++) {
        positions.push({ row: currentRow + Math.floor(k / GRID_COLS), col: k % GRID_COLS });
      }
      currentRow += Math.ceil(group.items.length / GRID_COLS);
    }
    return positions;
  }, [groups]);

  // ── Picker overlay handler ────────────────────────────────────────────────────
  // Triggered by:
  //   • Mouse right-click  → button onContextMenu DOM event
  //   • Gamepad Start (9) / Keyboard Shift+Enter
  //       → Dashboard captureInput handler → wantFormRef.showInventoryContextMenu()
  //       → showContextMenuForFocused() below → openOverlay()
  // The overlay is rendered as an absolute layer on the picker itself (not a floating popup),
  // avoiding z-index / transform stacking-context issues with the sidebar.
  const openOverlay = useCallback((item: SlotItem) => {
    setTooltip(null);
    setOverlay({ item });
  }, []);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  // Note: Escape / Gamepad B are handled inside OverlayActionGrid (via useOverlayKeyNav)
  // when the overlay is open — no separate fallback useInputActions needed here.

  useImperativeHandle(ref, () => ({
    focusSearch: () => { searchRef.current?.focus(); },
    // Called by Dashboard → WantForm when Gamepad Start (9) / Shift+Enter fires
    // while the picker is the active "situation".
    showContextMenuForFocused: () => {
      const idx = slotButtonRefs.current.findIndex(el => el === document.activeElement);
      if (idx < 0) return;
      const item = renderedItemsRef.current[idx];
      if (!item) return;
      openOverlay(item);
    },
    navigate: (dir) => {
      const total = renderedItemsRef.current.length;
      if (total === 0) return;
      const currentIdx = slotButtonRefs.current.findIndex(el => el === document.activeElement);
      let next: number;
      if (currentIdx < 0) {
        next = (dir === 'up' || dir === 'left') ? total - 1 : 0;
      } else if (dir === 'right') {
        next = (currentIdx + 1) % total;
      } else if (dir === 'left') {
        next = currentIdx === 0 ? total - 1 : currentIdx - 1;
      } else {
        // up / down: use visual (row, col) to navigate across group boundaries correctly
        const { row, col } = gridPositions[currentIdx];
        const targetRow = dir === 'down' ? row + 1 : row - 1;
        const candidates = gridPositions
          .map((p, i) => ({ ...p, i }))
          .filter(p => p.row === targetRow);
        if (candidates.length === 0) {
          next = currentIdx; // already at top/bottom edge
        } else {
          const exact = candidates.find(p => p.col === col);
          if (exact) {
            next = exact.i;
          } else {
            // nearest column in target row
            next = candidates.reduce((best, c) =>
              Math.abs(c.col - col) < Math.abs(best.col - col) ? c : best
            ).i;
          }
        }
      }
      slotButtonRefs.current[next]?.focus();
    },
    confirmFocused: () => {
      const idx = slotButtonRefs.current.findIndex(el => el === document.activeElement);
      if (idx >= 0) {
        const item = renderedItemsRef.current[idx];
        if (item) {
          playSound('cardOpen');
          onSelectRef.current(item.id, item.type);
        }
      }
    },
  }), [gridPositions]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>, item: SlotItem) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 90;
    setTooltip({
      item,
      x: Math.min(rect.left, window.innerWidth - 196),
      y: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  const renderSlot = (item: SlotItem, flatIndex: number) => {
    const isOverlayOpen = overlay?.item.id === item.id;
    const isDark = colorMode === 'dark';
    const typeIconStyle = wantTypeIconStyle(item.name, item.category ?? '', isDark);
    // Same tint EntityCard washes its icon badge with, so a want type in the
    // picker and a want type on a card wear the same badge.
    const badgeColor = getBackgroundToneColor(item.name)
      ?? getCategoryHexColor(item.category ?? '', isDark);
    return (
      <div key={item.id} className="flex flex-col">
        <button
          type="button"
          ref={el => { slotButtonRefs.current[flatIndex] = el; }}
          draggable
          onClick={(e) => {
            playSound('cardOpen');
            // Launch this card toward the form's header so the type does not
            // just disappear from the grid — it travels to where it lands.
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            startFlight({
              kind: 'type',
              sourceRect: { top: r.top, left: r.left, width: r.width, height: r.height },
              icon: '',
              color: wantTypeIconStyle(item.name, item.category ?? '', colorMode === 'dark').color as string,
              value: item.title,
              subtype: item.category ?? '',
            });
            onSelect(item.id, item.type);
          }}
          data-robot-target="want_type_card"
          data-robot-id={item.id}
          data-free-cursor-item
          onContextMenu={e => {
            e.preventDefault(); // suppress browser native menu
            openOverlay(item);
          }}
          onMouseEnter={e => { if (!isOverlayOpen) handleMouseEnter(e, item); }}
          onMouseLeave={handleMouseLeave}
          onDragStart={e => {
            suppressDragImage(e);
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('application/mywant-template', JSON.stringify({
              id: item.id,
              type: item.type,
              name: item.title,
            }));
            useWantStore.getState().setDraggingTemplate({
              id: item.id,
              type: item.type,
              name: item.title,
            });
          }}
          onDragEnd={() => {
            useWantStore.getState().setDraggingTemplate(null);
          }}
          className={[
            'relative w-full rounded-lg overflow-hidden cursor-grab active:cursor-grabbing',
            'border border-gray-300/80 dark:border-black/60 shadow-sm hover:shadow-md',
            // Pointing at a slot and having the keys on it are the same
            // statement, so they wear the same glow — see .mw-hover-ring and
            // .inventory-slot-focus.
            'mw-hover-ring hover:z-10',
            'transition-shadow inventory-slot-focus',
          ].join(' ')}
        >
          <div className="relative w-full aspect-[2/1]">
          {/* Same face the child mini tiles use — the want type's own background
              and its icon in the type colour, rather than a flat category tile
              with a white icon.

              Icon and name are drawn here rather than by the face, because they
              sit side by side: a tinted badge on the left, the name in the strip
              to its right. That is the shape every other card in the app wears
              (EntityCard's icon badge — thing cards, want type cards, worlds),
              and the phase-2 header this grid hands off to already used it, so
              the picked card keeps its layout on the way there. */}
          <WantCardFace
            typeName={item.name}
            displayName={item.title}
            category={item.category ?? ''}
            theme={colorMode}
            context="canvas"
            showName={false}
            showIcon={false}
            // The name owns the right half now, so a background image is fitted
            // to the height and pinned right — behind the badge, not under the
            // text — exactly as EntityCard's badge cards do it.
            imageAlign="right"
            // Fills the slot via w/h, NOT absolute inset-0: the face's own root
            // carries `relative`, which wins the position conflict and would
            // leave this collapsed to zero height with everything inside it
            // absolutely positioned — i.e. an empty slot.
            className="w-full h-full"
          >
            <div className="absolute inset-y-0 left-0 z-10 flex items-center pl-1 pointer-events-none">
              <div
                className="flex items-center justify-center rounded-lg h-[76%] aspect-square"
                style={{ backgroundColor: `${badgeColor}3a` }}
              >
                {item.type === 'recipe' ? (
                  <Package style={{ width: '58%', height: '58%', ...typeIconStyle }} />
                ) : (
                  <WantIcon
                    typeName={item.name}
                    category={item.category ?? ''}
                    iconFont={iconFont}
                    size={18}
                    isLight={!isDark}
                    iconStyle={typeIconStyle}
                    iconClassName="flex-shrink-0"
                  />
                )}
              </div>
            </div>
            <div className="absolute inset-y-0 left-[42%] right-0 z-10 flex items-center justify-center px-1 pointer-events-none">
              <span
                className={[
                  'text-[9px] font-semibold leading-tight text-center',
                  isDark ? 'text-white' : 'text-gray-800',
                ].join(' ')}
                style={{
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  maxWidth: '100%',
                  textShadow: isDark
                    ? '0 1px 3px rgba(0,0,0,0.7)'
                    : '0 1px 3px rgba(255,255,255,0.7), 0 0 2px rgba(0,0,0,0.2)',
                }}
              >
                {item.title}
              </span>
            </div>
          </WantCardFace>
          {/* Overlay covers the face only, so the name bar below stays readable */}
          {isOverlayOpen && (() => {
            const slotItems = buildSlotItems(item, closeOverlay);
            return (
              <OverlayActionGrid
                items={slotItems}
                cols={slotItems.length}
                onClose={closeOverlay}
                showLabel={false}
                className="absolute inset-0 z-20 overflow-hidden"
                ignoreWhenInSidebar={false}
                onMouseDown={e => e.stopPropagation()}
              />
            );
          })()}
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2 p-2 sm:p-3 h-full min-h-0">
      {/* Search + Sort row */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-6 sm:pl-7 pr-2 py-1 sm:py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
          />
        </div>
        <div className="flex rounded border sm:rounded-md border-gray-300 dark:border-gray-600 overflow-hidden text-[10px] sm:text-xs flex-shrink-0">
          <button
            type="button"
            onClick={() => setSortMode('name')}
            className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 transition-colors ${
              sortMode === 'name'
                ? 'bg-sky-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Name
          </button>
          <button
            type="button"
            onClick={() => setSortMode('category')}
            className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 transition-colors border-l border-gray-300 dark:border-gray-600 ${
              sortMode === 'category'
                ? 'bg-sky-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Cat.
          </button>
        </div>
      </div>

      {/* Inventory grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        {filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          <div className="space-y-2 sm:space-y-3 p-[2px] sm:p-[4px]">
            {(() => {
              let slotCounter = 0;
              return groups.map(({ label, items: groupItems }, gi) => {
                const grid = (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                    {groupItems.map(item => renderSlot(item, slotCounter++))}
                  </div>
                );
                // Sorted by name: one plain grid, no category to head it.
                if (label === null) return <div key={gi}>{grid}</div>;
                const accent = getCategoryHexColor(label, colorMode === 'dark');
                return (
                  // The category itself is a card: its name down the left edge,
                  // its want types as a grid of cards on the right.
                  <section
                    key={label}
                    className="flex gap-2 sm:gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 shadow-sm p-2 sm:p-2.5"
                  >
                    <div className="w-12 sm:w-16 flex-shrink-0 flex flex-col gap-0.5 border-l-2 pl-1.5 sm:pl-2" style={{ borderColor: accent }}>
                      <span
                        className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide leading-tight break-words"
                        style={{ color: accent }}
                        title={label}
                      >
                        {label}
                      </span>
                      <span className="text-[9px] text-gray-400">{groupItems.length}</span>
                    </div>
                    <div className="flex-1 min-w-0">{grid}</div>
                  </section>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Minecraft-style tooltip — hidden while overlay is open */}
      {tooltip && !overlay && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.above ? undefined : tooltip.y,
            bottom: tooltip.above ? window.innerHeight - tooltip.y : undefined,
          }}
        >
          <div className="bg-gray-900 border border-gray-600 rounded px-2.5 py-2 text-white shadow-xl max-w-[188px]">
            <p className="text-xs font-semibold leading-tight">{tooltip.item.title}</p>
            {tooltip.item.category && (
              <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{tooltip.item.category}</p>
            )}
            {tooltip.item.description && tooltip.item.description !== tooltip.item.title && (
              <p className="text-[10px] text-gray-300 mt-1 leading-tight">{tooltip.item.description}</p>
            )}
            <p className="text-[9px] text-gray-500 mt-1.5">
              {tooltip.item.type === 'recipe' ? '📦 Recipe' : '⚡ Want Type'}
            </p>
          </div>
        </div>
      )}

    </div>
  );
});
