import type React from 'react';

/**
 * The accent colour each hamburger-menu entry uses (see Header's NAV_ENTRIES).
 * Cards tint their surface with the same colour so a card visually belongs to
 * its menu section — thing = orange, want types = purple, etc. The icon badge
 * keeps its own per-item colour (e.g. the want type's category colour).
 */
export const MENU_COLORS = {
  wants: '#ec4899',
  thing: '#f59e0b',
  wantTypes: '#a855f7',
  worlds: '#6366f1',
  agents: '#3b82f6',
  webWants: '#0ea5e9',
  recipes: '#10b981',
  achievements: '#eab308',
  kata: '#0f766e',
  devices: '#14b8a6',
  characters: '#8b5cf6',
  extension: '#f43f5e',
} as const;

/**
 * Which menu section a route belongs to, so anything drawn on a page can find
 * its accent without being told. The sidebar tints its header from this and
 * EntityCard its surface, which is why it lives here rather than in either.
 */
export const ROUTE_MENU_COLOR: Record<string, string> = {
  '/dashboard': MENU_COLORS.wants,
  '/canvas': MENU_COLORS.wants,
  '/thing': MENU_COLORS.thing,
  '/want-types': MENU_COLORS.wantTypes,
  '/worlds': MENU_COLORS.worlds,
  '/agents': MENU_COLORS.agents,
  '/web-wants': MENU_COLORS.webWants,
  '/recipes': MENU_COLORS.recipes,
  '/achievements': MENU_COLORS.achievements,
  '/kata': MENU_COLORS.kata,
  '/devices': MENU_COLORS.devices,
  '/extension': MENU_COLORS.extension,
  '/servers': MENU_COLORS.extension,
  '/characters': MENU_COLORS.characters,
};

/** The accent for a path, falling back to the Wants pink a want card already
 *  sits on. Matches the longest registered prefix, so a nested route keeps its
 *  section's colour instead of dropping to the default. */
export function menuColorForPath(pathname: string): string {
  let best = '';
  for (const route of Object.keys(ROUTE_MENU_COLOR)) {
    if ((pathname === route || pathname.startsWith(route + '/')) && route.length > best.length) best = route;
  }
  return best ? ROUTE_MENU_COLOR[best] : MENU_COLORS.wants;
}

/** A subtle solid tint of `hex`, layered over the card's white/gray surface. */
export function menuTintBg(hex: string): React.CSSProperties {
  return { backgroundImage: `linear-gradient(${hex}2e, ${hex}2e)` };
}
