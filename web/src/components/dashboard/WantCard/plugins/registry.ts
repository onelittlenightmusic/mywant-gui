import React from 'react';
import { Want } from '@/types/want';

/**
 * The card is the one embedded in a panel (the details sidebar, or an app's
 * sheet), not one in a list or floating over the board. A tap on a card in a
 * list or floating is a request for its panel; only the embedded card's
 * content does its own thing on a tap — a web want's page opening its site.
 */
export const CardEmbeddedContext = React.createContext(false);

// Props passed to every want card plugin's ContentSection.
// Keep this minimal — derive extra values inside each plugin from `want`.
export interface WantCardPluginProps {
  want: Want;
  isChild: boolean;
  isControl: boolean;
  isFocused: boolean;
  isSelectMode: boolean;
  onView: (want: Want) => void;
  onViewResults?: (want: Want) => void;
  onSliderActiveChange?: (active: boolean) => void;
  /** True when keyboard/gamepad has drilled into this control's inner focus */
  isInnerFocused?: boolean;
  /** Called by the plugin to enter inner focus via mouse/touch (e.g. clicking a control that has no keyboard/gamepad available) */
  onEnterInnerFocus?: () => void;
  /** Called by the plugin to exit inner focus back to the card */
  onExitInnerFocus?: () => void;
  /** True when the card is shown in the expanded portal overlay */
  isExpanded?: boolean;
}

/**
 * Props for a want's face on a board tile.
 *
 * The card is the want read up close, in a panel; the tile face is the same
 * want seen standing on the board — what the card shows, cut down to what
 * still reads at the size of a tile. Read only: a face is looked at, never
 * operated (the tile under it owns every click, drag and key), so it takes no
 * handlers and draws no controls.
 */
export interface WantTileFaceProps {
  want: Want;
  /** The face's drawn box, CSS px: the tile at the board's current zoom. */
  width: number;
  height: number;
  /** The board is light (a pale ground) or dark. */
  isLight: boolean;
}

/**
 * The smallest tile side, CSS px, a tile face is drawn at. Below it a tile
 * keeps its type icon: from far away a tile is a colour and a silhouette, and
 * a face shrunk past reading is only noise. A plugin may set its own.
 */
export const TILE_FACE_MIN_SIZE = 96;

export interface WantCardPlugin {
  /** One or more want type names this plugin handles */
  types: string[];
  /**
   * Labels a want must carry for this plugin to handle it when no plugin is
   * registered for its type — for families of generated types (every captured
   * web want is its own type, www_google_com_web and so on) that share a card.
   */
  labels?: Record<string, string>;
  /**
   * Type-specific content rendered in the card body. Optional: a plugin may
   * bring only a tile face, and the card then keeps its default body.
   */
  ContentSection?: React.ComponentType<WantCardPluginProps>;
  /** When true, suppresses the default final result JSON display */
  hideFinalResult?: boolean;
  /**
   * This want's face on a board tile, drawn in place of the type icon once the
   * tile is at least `tileFaceMinSize` across (see WantTileFace). Lives with
   * the card so a tile reuses the card's own reading of the want's state.
   */
  TileFace?: React.ComponentType<WantTileFaceProps>;
  /** Overrides TILE_FACE_MIN_SIZE for this plugin's face. */
  tileFaceMinSize?: number;
  /**
   * Whether this want has anything to show on its face yet — a weather want
   * before its first fetch has not. Without it the face is always drawn.
   */
  hasTileFace?: (want: Want) => boolean;
}

const pluginRegistry = new Map<string, WantCardPlugin>();
const labelPlugins: WantCardPlugin[] = [];
const registryListeners = new Set<() => void>();

export function registerWantCardPlugin(plugin: WantCardPlugin): void {
  for (const type of plugin.types) {
    pluginRegistry.set(type, plugin);
  }
  if (plugin.labels) labelPlugins.push(plugin);
  registryListeners.forEach(fn => fn());
}

export function getWantCardPlugin(type: string, labels?: Record<string, string>): WantCardPlugin | undefined {
  const byType = pluginRegistry.get(type);
  if (byType || !labels) return byType;
  return labelPlugins.find(p =>
    Object.entries(p.labels!).every(([k, v]) => labels[k] === v));
}

/**
 * The tile face to draw for `want` on a tile `size` px across, or undefined
 * when its tile should keep the type icon: no plugin brings a face for it,
 * the tile is too small for the face to read, or the want has nothing to show.
 */
export function getWantTileFace(
  want: Want,
  size: number,
): React.ComponentType<WantTileFaceProps> | undefined {
  const type = want.metadata?.type;
  if (!type) return undefined;
  const plugin = getWantCardPlugin(type, want.metadata?.labels);
  if (!plugin?.TileFace) return undefined;
  if (size < (plugin.tileFaceMinSize ?? TILE_FACE_MIN_SIZE)) return undefined;
  if (plugin.hasTileFace && !plugin.hasTileFace(want)) return undefined;
  return plugin.TileFace;
}

export function onPluginRegistered(cb: () => void): () => void {
  registryListeners.add(cb);
  return () => registryListeners.delete(cb);
}
