import type { ComponentType, ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { registerOverlayDesign, type OverlayDesign } from '@/components/overlay/design';

/**
 * What an extension of this GUI can add, and where.
 *
 * The GUI is built in two editions from one source: mywant-gui, which is the
 * public one, and mywant-guiex, which is the same app with the canvas, kata,
 * characters, the robot and the browser extension added. Nothing public
 * imports those; instead they register here (see extensions/installed), and
 * the public code asks what has been registered at the few places it can be
 * extended — a page, a menu entry, a panel section, a hook run at the root.
 *
 * Registration happens once, at startup, before the first render. The lists
 * never change after that, which is what makes it safe to call registered
 * hooks from a component (see useExtensionHooks).
 */

/** A menu entry, as Header draws it. */
export interface ExtensionMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  /** The entry it follows in the menu; at the end when absent or unknown. */
  after?: string;
}

/**
 * Named places a component can be put. Each is rendered with the props its
 * host passes, and several extensions may fill the same one (drawn in
 * registration order).
 */
export interface ExtensionSlots {
  /** Mounted once at the app root, inside the router. Render nothing or float. */
  appRoot: ComponentType;
  /** The header's mode lamp, on a page that asks for one (showZModeLamp). */
  headerModeLamp: ComponentType<{ below: boolean; onPointerDown: () => void }>;
  /** Over the header, for things waiting on an answer said in the bubble. */
  interactOverlay: ComponentType<{ onSay: (text: string) => Promise<void> | void }>;
  /** Beside the header's bubble: who answers what is said in it. */
  interactProviderSelect: ComponentType<{ open: boolean }>;
  /** A section of the Settings modal. */
  settingsSection: ComponentType;
  /** Below a constellation's details — kata, the group's own card. */
  groupDetails: ComponentType<{ groupName: string }>;
  /** Marks in a theme's header, after its count — what the theme turned out to be. */
  themeMarks: ComponentType<{ themeName: string; color?: string }>;
}

/** What the header's bubble does with what is typed into it. */
export interface InteractApi {
  handleInteractSubmit: (message: string) => Promise<void> | void;
  isSubmitting: boolean;
  hasUnreadReply: boolean;
  handleViewReply: () => void;
}

export interface GuiExtension {
  id: string;
  /** Pages inside the app frame. */
  routes?: Array<{ path: string; element: ReactElement }>;
  /** Pages outside it — no header, no sidebar. */
  bareRoutes?: Array<{ path: string; element: ReactElement }>;
  menu?: ExtensionMenuItem[];
  /** Tabs of the logs page, after its own. */
  logTabs?: Array<{ id: string; label: string; icon: LucideIcon; component: ComponentType }>;
  slots?: { [K in keyof ExtensionSlots]?: ExtensionSlots[K] };
  /**
   * Answers the header's bubble. The bubble is only drawn when some extension
   * answers it; the first registered wins.
   */
  interact?: () => InteractApi;
  /** More endpoints listing runtime plugin modules to load (see App). */
  pluginEndpoints?: string[];
  /** Hooks run once, at the app root. */
  appHooks?: Array<() => void>;
  /** Hooks run by the layout (inside the router). */
  layoutHooks?: Array<() => void>;
  /**
   * Overlay designs this extension brings — skins for every overlay menu and
   * dialog, chosen per person in their character's display (see
   * components/overlay/design). Their class names come from the extension's
   * own stylesheet.
   */
  overlayDesigns?: OverlayDesign[];
  /** Run once when registered — for registries and globals of its own. */
  setup?: () => void;
}

const extensions: GuiExtension[] = [];

export function registerExtension(ext: GuiExtension): void {
  if (extensions.some(e => e.id === ext.id)) return;
  extensions.push(ext);
  ext.overlayDesigns?.forEach(registerOverlayDesign);
  ext.setup?.();
}

export function getExtensions(): readonly GuiExtension[] {
  return extensions;
}

/** Whether some extension serves this path — for links that lead only there. */
export function hasExtensionRoute(path: string): boolean {
  return extensions.some(e => e.routes?.some(r => r.path === path));
}

export function extensionRoutes(): Array<{ path: string; element: ReactElement }> {
  return extensions.flatMap(e => e.routes ?? []);
}

export function extensionBareRoutes(): Array<{ path: string; element: ReactElement }> {
  return extensions.flatMap(e => e.bareRoutes ?? []);
}

export function extensionLogTabs(): NonNullable<GuiExtension['logTabs']> {
  return extensions.flatMap(e => e.logTabs ?? []);
}

export function extensionPluginEndpoints(): string[] {
  return extensions.flatMap(e => e.pluginEndpoints ?? []);
}

export function extensionMenu(): ExtensionMenuItem[] {
  return extensions.flatMap(e => e.menu ?? []);
}

export function extensionSlot<K extends keyof ExtensionSlots>(name: K): Array<ExtensionSlots[K]> {
  return extensions.flatMap(e => (e.slots?.[name] ? [e.slots[name] as ExtensionSlots[K]] : []));
}

/** Calls every registered app hook. Safe: the list is fixed before the first render. */
export function useExtensionHooks(kind: 'appHooks' | 'layoutHooks'): void {
  for (const e of extensions) for (const h of e[kind] ?? []) h();
}

const noInteract = (): null => null;

/**
 * The bubble's handler, or null when nothing answers it. The same hook every
 * render: which one is decided at registration, before the first.
 */
export function useExtensionInteract(): InteractApi | null {
  const hook = extensions.find(e => e.interact)?.interact ?? noInteract;
  return hook();
}
