import React, { useEffect, useRef } from 'react';
import { MinimapFrame, MinimapTile } from './WantMinimap';
import { nativePanelPage, hostSheetsOn, useHostSheet, useHostActStore, postToHost } from '@/lib/nativeHost';

/** One tile of a page's minimap. */
export interface MinimapItem {
  id: string;
  title: string;
  /** The tile's fill — the item's colour, as its card has it. */
  background: string;
  icon: React.ReactNode;
}

/**
 * A page's minimap — the want list's layout (MinimapFrame, MinimapTile), for
 * any page whose items are cards in a grid: things, want types. A press goes
 * to the page's `onPick` (scroll to that card and land on it).
 *
 * In an app on a phone it is the app's own sheet, as every panel is: the page
 * at its own address asked to be its map (`?__panel=__minimap`), whose presses
 * come back to the page underneath as acts. See usePageMinimap.
 */
export const ItemMinimap: React.FC<{
  items: MinimapItem[];
  selectedId: string | null;
  map: PageMinimap;
}> = ({ items, selectedId, map }) => {
  if (!map.drawHere) return null;
  return (
    <MinimapFrame isOpen>
      <div className="grid grid-cols-3 gap-2 auto-rows-min p-2 sm:p-0">
        {items.map(item => (
          <MinimapTile
            key={item.id}
            background={item.background}
            icon={item.icon}
            selected={selectedId === item.id}
            title={item.title}
            onClick={() => map.pick(item.id)}
            dataAttrs={{ 'data-minimap-item-id': item.id }}
          />
        ))}
      </div>
    </MinimapFrame>
  );
};

export interface PageMinimap {
  /** Draw the map in this page now (open here, or this page is the app's map sheet). */
  drawHere: boolean;
  /** A tile pressed. */
  pick: (id: string) => void;
}

const SHEET_ID = '__minimap';

/**
 * A page's minimap, opened and closed by the page (its header's Minimap
 * button), wherever it is drawn: in the page, or — in an app on a phone — as
 * the app's sheet, whose presses come back here. `onPick` lands on an item;
 * on a phone the map closes after it, as the want list's does.
 */
export function usePageMinimap(open: boolean, setOpen: (open: boolean) => void, onPick: (id: string) => void): PageMinimap {
  const inSheet = nativePanelPage && new URLSearchParams(location.search).get('__panel') === SHEET_ID;
  const asSheet = !inSheet && open && hostSheetsOn();
  useHostSheet(asSheet ? `${location.pathname}?__panel=${SHEET_ID}` : null, 'Map', 'Map', () => setOpen(false));

  const pickHere = (id: string) => {
    onPick(id);
    if (window.innerWidth < 1024) setOpen(false);
  };
  const pickRef = useRef(pickHere);
  pickRef.current = pickHere;
  useEffect(() => {
    if (inSheet) return;
    useHostActStore.getState().set((act, _kind, id) => { if (act === 'minimap') pickRef.current(id); });
    return () => useHostActStore.getState().set(null);
  }, [inSheet]);

  return {
    drawHere: inSheet || (open && !asSheet),
    pick: inSheet ? (id) => postToHost({ type: 'card-act', act: 'minimap', kind: 'want', id }) : pickHere,
  };
}
