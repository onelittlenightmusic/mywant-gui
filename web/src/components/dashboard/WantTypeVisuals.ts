/**
 * Shared visual constants and helpers for want-type cards.
 * Used by both WantTypeCard (sidebar) and WantCanvas (canvas tiles).
 */
import React from 'react';
import * as LucideIcons from 'lucide-react';
import {
  Zap, Settings, Database, Share2,
  Plane, Calculator, Layers, CheckCircle, Monitor, Wrench,
  Eye, Lightbulb,
  ToggleLeft, ToggleRight,
  TrainFront, Globe,
  Sparkles, PanelsTopLeft, Cog,
  LucideIcon,
} from 'lucide-react';
import { getBackgroundImage, getBackgroundToneColor } from '@/utils/backgroundStyles';
import { SpotifyIcon, ClaudeIcon } from './BrandIcons';
import {
  resolveHeroicon,
  HEROICON_FALLBACK_OUTLINE,
  HEROICON_FALLBACK_SOLID,
  type HeroiconFC,
} from './HeroiconRegistry';

// ── Dynamic category maps (populated from API labels at runtime) ──────────────
// Keyed by lowercase category name.
let _dynamicCategoryIconMap: Record<string, string> = {};
let _dynamicCategoryBgLight: Record<string, string> = {};
let _dynamicCategoryBgDark:  Record<string, string> = {};

// ── Dynamic type icon map (populated from API labels at runtime) ──────────────
// Keyed by lowercase type name. Populated from labels['type-icon'] on each want type.
// Takes priority over category icon when present.
let _dynamicTypeIconMap: Record<string, string> = {};


/**
 * Called by wantTypeStore after fetching want types.
 * Scans labels['category-icon'] across all types and builds the dynamic icon map.
 */
export const setDynamicCategoryIconMap = (map: Record<string, string>): void => {
  _dynamicCategoryIconMap = map;
};

/**
 * Called by wantTypeStore after fetching want types.
 * Scans labels['type-icon'] across all types and builds the per-type icon map.
 */
export const setDynamicTypeIconMap = (map: Record<string, string>): void => {
  _dynamicTypeIconMap = map;
};


/**
 * Called by wantTypeStore after fetching want types.
 * Scans labels['category-bg-light'] and ['category-bg-dark'] to build background maps.
 */
export const setDynamicCategoryBgMap = (
  light: Record<string, string>,
  dark:  Record<string, string>,
): void => {
  _dynamicCategoryBgLight = light;
  _dynamicCategoryBgDark  = dark;
};

/**
 * Resolve a Lucide icon component by its string name (e.g. "Swords" → Swords).
 * Returns null if the name is not a valid Lucide icon.
 *
 * Note: Lucide icons are React.forwardRef components, so typeof === 'object',
 * not 'function'. We accept both to be safe.
 */
const resolveLucideIcon = (name: string): LucideIcon | null => {
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (!icon) return null;
  if (typeof icon === 'function' || typeof icon === 'object') return icon as LucideIcon;
  return null;
};

// ── Body shading ─────────────────────────────────────────────────────────────
/**
 * The faces of one solid, all from a single base colour.
 *
 * A canvas tile is a block: its top catches the light, its right face is turned
 * away from it, and its front is turned further still. What kept the board
 * reading as flat decals rather than blocks was that those three faces came
 * from three *different* places — the top from a hand-written per-category
 * gradient (CATEGORY_BG_DARK), the sides from CATEGORY_SLOT_COLOR darkened by a
 * black wash in CubicWalls — with nothing tying the two tables together.
 *
 * Three things fell out of that, all measured on the running board:
 *
 *  - The light inverted at the ridge. The `effect` gradient ended at #701a75
 *    (luma 51) while the right face it meets was #c026d3 darkened to luma 55 —
 *    so the side face was BRIGHTER than the top edge touching it, which is the
 *    one place the eye reads the form.
 *  - Two categories had their hues transposed between the tables: `queue` was
 *    emerald on top and violet down the side, `mathematics` the reverse.
 *  - A category supplying its own gradient in YAML could span two hues
 *    entirely — `weather` ships #b45309 → #1d4ed8, an amber block with a blue
 *    lid.
 *
 * So: one base colour, one ladder, and top > right > front holds by
 * construction. The top keeps a shallow gradient — a large tile shouldn't be a
 * flat sticker — but it stays near the base, which is what guarantees the
 * ordering at every edge.
 *
 * The base is getCategoryHexColor(), which is already what the walls, the icon
 * tint and the inventory slots read, and which still honours a plugin category's
 * own YAML colour (it extracts the first stop of category-bg-*). A hue authored
 * in YAML therefore survives; a second, unrelated stop does not, because that is
 * the thing that cannot be a solid.
 */
// The ladder itself — shade, the three faces and their ratios — lives in
// shared/cubicBlock, framework-free, so a block drawn off the board (the
// browser extension's way back to MyWant) is shaded by the same rule.
import { shade, bodyTopFace, bodyRightFace, bodyFrontFace } from '@/shared/cubicBlock';
export { shade, bodyTopFace, bodyRightFace, bodyFrontFace };

// ── Pattern accent hex colors (shared) ───────────────────────────────────────
export const PATTERN_COLOR: Record<string, string> = {
  generator:   '#3b82f6',
  processor:   '#a855f7',
  sink:        '#ef4444',
  coordinator: '#22c55e',
  independent: '#f59e0b',
};
export const DEFAULT_PATTERN_COLOR = '#94a3b8';

// ── Tailwind badge classes for light theme (WantTypeCard) ────────────────────
export const PATTERN_BADGE_CLASS: Record<string, string> = {
  generator:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  processor:   'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  sink:        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  coordinator: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  independent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};
export const DEFAULT_PATTERN_BADGE_CLASS = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  travel:      'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  mathematics: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  math:        'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  queue:       'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  approval:    'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
  system:      'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  transport:   'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300',
  effect:      'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/20 dark:text-fuchsia-300',
  ui:          'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
  utility:     'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
  web:         'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
};
export const DEFAULT_CATEGORY_BADGE_CLASS = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';

// ── Lucide icon names for built-in categories (used for Heroicon lookup) ──────
// Must stay in sync with CATEGORY_ICON below.
const CATEGORY_ICON_NAME: Record<string, string> = {
  travel:      'Plane',
  mathematics: 'Calculator',
  math:        'Calculator',
  queue:       'Layers',
  approval:    'CheckCircle',
  system:      'Monitor',
  transport:   'TrainFront',
  tunnel:      'Globe',
  effect:      'Sparkles',
  ui:          'PanelsTopLeft',
  utility:     'Cog',
  web:         'Globe',
};

// ── Icon maps ─────────────────────────────────────────────────────────────────
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  travel:      Plane,
  mathematics: Calculator,
  math:        Calculator,
  queue:       Layers,
  approval:    CheckCircle,
  system:      Monitor,
  transport:   TrainFront,
  tunnel:      Globe,
  effect:      Sparkles,
  ui:          PanelsTopLeft,
  utility:     Cog,
  web:         Globe,
  // rpg: resolved dynamically via labels['category-icon'] from API
};

// ── Role icons & colors (child-role label) ────────────────────────────────────
export const ROLE_ICON: Record<string, LucideIcon> = {
  monitor: Eye,
  memory:  Database,
  thinker: Lightbulb,
  doer:    Zap,
};

export const ROLE_COLOR: Record<string, string> = {
  monitor: '#3b82f6',  // 青
  memory:  '#06b6d4',  // シアン
  thinker: '#a855f7',  // 紫
  doer:    '#22c55e',  // 緑
};

export const getRoleIcon = (role: string): LucideIcon | null =>
  ROLE_ICON[role?.toLowerCase()] ?? null;

export const getRoleColor = (role: string): string | null =>
  ROLE_COLOR[role?.toLowerCase()] ?? null;

export const PATTERN_ICON: Record<string, LucideIcon> = {
  generator:   Zap,
  processor:   Settings,
  sink:        Database,
  coordinator: Share2,
  independent: Zap,
};

// ── Helper functions ──────────────────────────────────────────────────────────
/**
 * A category's lit top face.
 *
 * Derived from getCategoryHexColor rather than read out of its own table, so a
 * category is ONE colour everywhere it is drawn — the tile top, the cube's side
 * faces, the minimap, an inventory slot, a waza tile, a home-screen icon. See
 * the body-shading block above for what having two tables actually cost.
 */
export const getCategoryBgDark = (category: string): string =>
  bodyTopFace(getCategoryHexColor(category, true));

export const getCategoryBgLight = (category: string): string =>
  bodyTopFace(getCategoryHexColor(category, false));

// ── Solid-color fallbacks matching the Tailwind classes used by WantInventoryPicker ──
const CATEGORY_SLOT_COLOR: Record<string, string> = {
  system:      '#475569', // slate-600
  travel:      '#0284c7', // sky-600
  queue:       '#7c3aed', // violet-600
  mathematics: '#059669', // emerald-600
  math:        '#059669',
  approval:    '#d97706', // amber-600
  transport:   '#0e7490', // cyan-700
  effect:      '#c026d3', // fuchsia-600
  ui:          '#4f46e5', // indigo-600
  utility:     '#0d9488', // teal-600
  web:         '#2563eb', // blue-600
};

// Lighter palette for light-theme SVG tiles (-200 shades)
const CATEGORY_HEX_LIGHT: Record<string, string> = {
  system:      '#cbd5e1', // slate-300 (was slate-200 = same as minimap bg)
  travel:      '#bae6fd', // sky-200
  queue:       '#ddd6fe', // violet-200
  mathematics: '#a7f3d0', // emerald-200
  math:        '#a7f3d0',
  approval:    '#fde68a', // amber-200
  transport:   '#a5f3fc', // cyan-200
  effect:      '#f5d0fe', // fuchsia-200
  ui:          '#c7d2fe', // indigo-200
  utility:     '#99f6e4', // teal-200
  web:         '#bfdbfe', // blue-200
};

/**
 * Returns a solid hex color for SVG/canvas use (no gradients).
 * Pass isDark=false to get a lighter, pastel-friendly palette for light themes.
 * Priority: static built-in map → first hex extracted from dynamic gradient → gray fallback.
 */
export const getCategoryHexColor = (category: string, isDark = true): string => {
  const lower = category.toLowerCase();
  if (!isDark && CATEGORY_HEX_LIGHT[lower]) return CATEGORY_HEX_LIGHT[lower];
  if (CATEGORY_SLOT_COLOR[lower]) return CATEGORY_SLOT_COLOR[lower];
  const grad = isDark ? _dynamicCategoryBgDark[lower] : _dynamicCategoryBgLight[lower];
  if (grad) {
    const m = grad.match(/#[0-9a-fA-F]{6}/);
    if (m) return m[0];
  }
  return isDark ? '#64748b' : '#94a3b8';
};

/**
 * Returns a CSS `background` value for inventory-style slots.
 * Priority:
 *   1. Dynamic gradient from labels['category-bg-light'] (covers plugin-defined categories)
 *   2. Static solid hex fallback for built-in categories
 *   3. #6b7280 (gray-500)
 */
export const getCategorySlotBackground = (category: string): string => {
  const lower = category.toLowerCase();
  // 1. Dynamic map populated from YAML labels at runtime
  const dynamic = _dynamicCategoryBgLight[lower];
  if (dynamic) return dynamic;
  // 2. Static solid color for built-in categories
  return CATEGORY_SLOT_COLOR[lower] ?? '#6b7280';
};

/**
 * Static fallback icons keyed by lowercase type name.
 * Applied when the YAML does NOT supply a labels['type-icon'] for this type.
 * Priority below dynamic map, above category icon.
 */
const TYPE_NAME_ICON: Record<string, LucideIcon> = {
  'button':       ToggleLeft,
  'push-button':  ToggleLeft,
  'push_button':  ToggleLeft,
  'pushbutton':   ToggleLeft,
  'toggle':       ToggleRight,
  'switch':       ToggleRight,
  'spotify':      SpotifyIcon as unknown as LucideIcon,
  'claude_info':  ClaudeIcon  as unknown as LucideIcon,
};

/**
 * Returns the per-type icon for the given want type name, or null if not configured.
 * Checks (in order):
 *   1. Dynamic map from labels['type-icon'] in want type YAML.
 *   2. Static TYPE_NAME_ICON map (built-in name aliases, e.g. push-button → ToggleLeft).
 */
export const getTypeIcon = (typeName: string): LucideIcon | null => {
  const lower = typeName.toLowerCase();
  // 1. dynamic
  const name = _dynamicTypeIconMap[lower];
  if (name) return resolveLucideIcon(name);
  // 2. static fallback
  return TYPE_NAME_ICON[lower] ?? null;
};

export const getCategoryIcon = (category: string): LucideIcon => {
  const lower = category.toLowerCase();
  // 1. dynamic map from API labels (plugin-supplied)
  const dynamicName = _dynamicCategoryIconMap[lower];
  if (dynamicName) {
    const resolved = resolveLucideIcon(dynamicName);
    if (resolved) return resolved;
  }
  // 2. static fallback map
  return CATEGORY_ICON[lower] ?? Wrench;
};

// ── Multi-family icon resolution ──────────────────────────────────────────────

/** Icon families supported by the icon_font config setting. */
export type IconFamily = 'lucide' | 'lucide-thin' | 'heroicons-outline' | 'heroicons-solid';

/**
 * A renderable icon component compatible with both Lucide and Heroicons.
 * Accepts standard SVG props (width, height, style, className).
 */
export type AnyIconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/**
 * Resolve the best icon component for the given category / type name and
 * the current icon family setting.
 *
 * Priority:
 *   1. Dynamic type icon (from labels['type-icon'])
 *   2. Dynamic category icon (from labels['category-icon'])
 *   3. Static built-in category map
 *   4. Wrench / Bolt fallback
 *
 * For Heroicons families, unknown Lucide names fall back to Lucide gracefully.
 */
export const resolveIconForFamily = (
  category: string,
  typeName: string,
  family: IconFamily,
): AnyIconComponent => {
  // ── Lucide (default / thin) ────────────────────────────────────────────────
  if (family === 'lucide' || family === 'lucide-thin') {
    return (getTypeIcon(typeName) ?? getCategoryIcon(category)) as AnyIconComponent;
  }

  // ── Heroicons ──────────────────────────────────────────────────────────────
  const isSolid = family === 'heroicons-solid';

  // Helper: try to resolve a Lucide name → Heroicon
  const tryHeroicon = (lucideName: string): HeroiconFC | null =>
    resolveHeroicon(lucideName, isSolid);

  // 1a. Dynamic type icon (YAML labels['type-icon'])
  const typeIconName = _dynamicTypeIconMap[typeName.toLowerCase()];
  if (typeIconName) {
    const h = tryHeroicon(typeIconName);
    if (h) return h;
    // Not in registry → fall back to Lucide for this specific icon
    const l = resolveLucideIcon(typeIconName);
    if (l) return l as AnyIconComponent;
  }

  // 1b. Static type-name fallback (e.g. push-button → ToggleLeft)
  const staticTypeIcon = TYPE_NAME_ICON[typeName.toLowerCase()];
  if (staticTypeIcon) {
    // Try Heroicon equivalent first (ToggleLeft maps to Power)
    const lucideName = Object.entries(
      { ToggleLeft, ToggleRight } as Record<string, LucideIcon>
    ).find(([, v]) => v === staticTypeIcon)?.[0];
    if (lucideName) {
      const h = tryHeroicon(lucideName);
      if (h) return h;
    }
    return staticTypeIcon as AnyIconComponent;
  }

  // 2. Dynamic category icon (YAML labels['category-icon'])
  const catIconName = _dynamicCategoryIconMap[category.toLowerCase()];
  if (catIconName) {
    const h = tryHeroicon(catIconName);
    if (h) return h;
    const l = resolveLucideIcon(catIconName);
    if (l) return l as AnyIconComponent;
  }

  // 3. Static built-in category name → Heroicon
  const staticName = CATEGORY_ICON_NAME[category.toLowerCase()] ?? 'Wrench';
  const h = tryHeroicon(staticName);
  if (h) return h;

  // 4. Final fallback
  return (isSolid ? HEROICON_FALLBACK_SOLID : HEROICON_FALLBACK_OUTLINE);
};

/**
 * Resolves the display icon for a want, with special handling for recipe-based targets.
 *
 * For recipe-based wants (labels['recipe-based'] === 'true'), returns the category icon
 * directly — the recipe's category is the most meaningful visual signal, more so than
 * any type-specific override. For all other wants, uses the full resolveIconForFamily
 * priority chain (type icon → category icon → fallback) respecting iconFont.
 *
 * Use this as the single source of truth anywhere a want needs an icon.
 */
export const resolveWantIcon = (
  typeName: string,
  typeCategory: string,
  isRecipeBased: boolean,
  iconFont: IconFamily,
): AnyIconComponent => {
  if (isRecipeBased) {
    return getCategoryIcon(typeCategory) as AnyIconComponent;
  }
  return resolveIconForFamily(typeCategory, typeName, iconFont);
};

export const getPatternIcon = (pattern: string): LucideIcon =>
  PATTERN_ICON[pattern.toLowerCase()] ?? Zap;

export const getPatternColor = (pattern: string): string =>
  PATTERN_COLOR[pattern.toLowerCase()] ?? DEFAULT_PATTERN_COLOR;

export const getPatternBadgeClass = (pattern: string): string =>
  PATTERN_BADGE_CLASS[pattern.toLowerCase()] ?? DEFAULT_PATTERN_BADGE_CLASS;

export const getCategoryBadgeClass = (category: string): string =>
  CATEGORY_BADGE_CLASS[category.toLowerCase()] ?? DEFAULT_CATEGORY_BADGE_CLASS;

/**
 * Returns inline style props for the card's outer container background.
 * theme="dark"  → category gradient (or photo with dark overlay hint)
 * theme="light" → white base + optional photo
 */
export const getCardBackgroundStyle = (
  typeName: string,
  category: string,
  theme: 'dark' | 'light',
  context: 'canvas' | 'sidebar' = 'sidebar',
): React.CSSProperties => {
  const bgImage = getBackgroundImage(typeName);
  if (bgImage) {
    return {
      backgroundImage: `url(${bgImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: theme === 'dark' ? 'rgba(15,23,42,0.85)' : undefined,
    };
  }
  if (theme === 'dark') {
    return { background: bodyTopFace(cardBaseColor(typeName, category, true)) };
  }
  // light canvas: pastel category gradient
  if (context === 'canvas') {
    return { background: bodyTopFace(cardBaseColor(typeName, category, false)) };
  }
  // light sidebar: plain white — handled by Tailwind className on the wrapper
  return {};
};

/**
 * The one colour a want's block is made of.
 *
 * Identical to useCanvasDesign's `faceColor`, which is what tints the cube's
 * side walls — a type naming its own tone wins, else its category's. Going
 * through the same expression is the point: the top face and the side faces
 * have to be the same material, and the previous code asked two different
 * questions here (category only, up top; tone-then-category, down the side), so
 * a type with a `type-tone-color` label wore two colours at once.
 */
export const cardBaseColor = (typeName: string, category: string, isDark: boolean): string =>
  getBackgroundToneColor(typeName) ?? getCategoryHexColor(category, isDark);

/**
 * Overlay rgba for the card (sits between background and content).
 */
export const getCardOverlayBg = (
  typeName: string,
  theme: 'dark' | 'light',
  context: 'canvas' | 'sidebar' = 'sidebar',
): string => {
  const hasImage = !!getBackgroundImage(typeName);
  if (theme === 'dark') return hasImage ? 'rgba(15,23,42,0.45)' : 'rgba(0,0,0,0.12)';
  // light canvas: subtle wash over the pastel gradient
  if (context === 'canvas') return hasImage ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)';
  return hasImage ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.20)';
};
