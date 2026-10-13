import React from 'react';
import { Want } from '@/types/want';

/**
 * The card is the one embedded in a panel (the details sidebar, or an app's
 * sheet), not one in a list or floating over the board. A tap on a card in a
 * list or floating is a request for its panel; only the embedded card's
 * content does its own thing on a tap — a web want's page opening its site.
 */
export const CardEmbeddedContext = React.createContext(false);

/**
 * The content is being drawn on the want's tile, as its face up close (the
 * canvas's WantTileFace) — a picture of the card, with no input and many on
 * the board at once. A card that is live in itself (a framed page) draws a
 * still of itself here instead.
 */
export const TileFaceContext = React.createContext(false);

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

export interface WantCardPlugin {
  /** One or more want type names this plugin handles */
  types: string[];
  /**
   * Labels a want must carry for this plugin to handle it when no plugin is
   * registered for its type — for families of generated types (every captured
   * web want is its own type, www_google_com_web and so on) that share a card.
   */
  labels?: Record<string, string>;
  /** Type-specific content rendered in the card body */
  ContentSection: React.ComponentType<WantCardPluginProps>;
  /** When true, suppresses the default final result JSON display */
  hideFinalResult?: boolean;
  /**
   * Whether the card is shown on the want's own tile when the board is zoomed
   * in close — the card's own content, drawn at card size and scaled onto the
   * tile's face, so the board and the card never show two different pictures
   * of one want. On unless set to false: every card is, by default.
   *
   * Display only: the face takes no input (pressing it presses the tile), and
   * a board holds several at once. A card whose content is live in itself —
   * an iframe, an interactive map, a running timer — draws a still of the
   * same content under TileFaceContext (a map as StaticMap, a framed page as
   * an EmbeddedPage with its screenshot). Where there is no still of what the
   * card shows, there is no face — false, or a function of the want saying
   * when there is one — never a stand-in the card itself does not show: the
   * tile's own icon says more than a placeholder.
   */
  tileFace?: boolean | ((want: Want) => boolean);
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

export function onPluginRegistered(cb: () => void): () => void {
  registryListeners.add(cb);
  return () => registryListeners.delete(cb);
}
