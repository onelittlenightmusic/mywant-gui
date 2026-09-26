import React from 'react';
import { Want } from '@/types/want';

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
