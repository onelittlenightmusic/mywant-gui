/**
 * Unified background style utilities for Want cards and details
 * Provides consistent background color and image selection logic across components
 */

export interface BackgroundStyle {
  className: string;
  style?: React.CSSProperties;
  hasBackgroundImage: boolean;
}

/**
 * Get background image URL based on want type
 * @param type - Want type (flight, hotel, restaurant, buffet, etc.)
 * @returns Image URL or undefined
 */
// The public mywant repository, through jsDelivr's CDN. These used to be read
// from this repository's raw GitHub URL, which is private and answers 404 —
// every card with one of these backgrounds drew without it. Downsized JPEGs
// (a card is drawn a few hundred pixels wide; the originals were 1–3 MB each).
const GITHUB_RAW_BASE = 'https://cdn.jsdelivr.net/gh/onelittlenightmusic/mywant@master/assets/card-backgrounds';

// Representative tone color for each want type's background — used for 3D side face tinting.
// Populated at runtime from labels['type-tone-color'] on each want type's YAML definition
// (see wantTypeStore.ts → setDynamicTypeToneColorMap). No colors are hardcoded here;
// a want type that wants a specific tint declares it in its own YAML.
let _dynamicTypeToneColors: Record<string, string> = {};

/**
 * Called by wantTypeStore after fetching want types.
 * Scans labels['type-tone-color'] across all types and builds the per-type tone color map.
 */
export const setDynamicTypeToneColorMap = (map: Record<string, string>): void => {
  _dynamicTypeToneColors = map;
};

/**
 * Returns a representative hex color for the tile's background image, or undefined if none.
 * Used to tint 3D side faces to match the tile's visual background.
 */
export const getBackgroundToneColor = (type?: string): string | undefined => {
  if (!type) return undefined;
  return _dynamicTypeToneColors[type.toLowerCase()];
};

/**
 * Converts a `#rrggbb` hex color to an `rgba(...)` string at the given alpha.
 * Falls back to the raw hex (opaque) if it isn't a 6-digit hex color.
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getBackgroundImage = (type?: string): string | undefined => {
  if (!type) return undefined;

  const imageMap: Record<string, string> = {
    flight: `${GITHUB_RAW_BASE}/flight.jpg`,
    hotel: `${GITHUB_RAW_BASE}/hotel.jpg`,
    restaurant: `${GITHUB_RAW_BASE}/restaurant.jpg`,
    buffet: `${GITHUB_RAW_BASE}/buffet.jpg`,
    evidence: `${GITHUB_RAW_BASE}/evidence.jpg`,
    // Mathematics category types and recipes
    'prime numbers': `${GITHUB_RAW_BASE}/numbers.jpg`,
    'prime sequence': `${GITHUB_RAW_BASE}/numbers.jpg`,
    'fibonacci numbers': `${GITHUB_RAW_BASE}/numbers.jpg`,
    'fibonacci filter': `${GITHUB_RAW_BASE}/numbers.jpg`,
    'fibonacci sequence': `${GITHUB_RAW_BASE}/numbers.jpg`,
    'prime sieve': `${GITHUB_RAW_BASE}/numbers.jpg`,
  };

  // Check exact type match first
  if (imageMap[type]) {
    return imageMap[type];
  }

  // Check if type ends with 'coordinator'
  if (type.endsWith('coordinator')) {
    return `${GITHUB_RAW_BASE}/agent.jpg`;
  }

  // System/Execution category - applies to scheduler, execution_result, execution result, and related types
  const systemTypes = [
    'scheduler',
    'execution_result',
    'execution result',
    'command execution',
    'command_execution'
  ];

  if (systemTypes.includes(type.toLowerCase()) || type.toLowerCase().includes('execution') || type.toLowerCase().includes('scheduler')) {
    return `${GITHUB_RAW_BASE}/screen.jpg`;
  }

  return undefined;
};

/**
 * Get background style for a want based on type and context
 * Returns consistent styling for both WantCard and WantDetailsSidebar
 *
 * @param type - Want type
 * @param isParentWant - Whether this is a parent want (affects background)
 * @returns BackgroundStyle object with className, style, and hasBackgroundImage flag
 */
export const getBackgroundStyle = (
  type?: string,
  isParentWant: boolean = false
): BackgroundStyle => {
  const backgroundImage = getBackgroundImage(type);
  const hasBackgroundImage = !!backgroundImage;

  // Determine if we should apply semi-transparent background
  // Parent wants always get semi-transparent background
  // Child wants get semi-transparent background only if they have a background image
  const shouldApplySemiTransparent = isParentWant || hasBackgroundImage;

  const className = shouldApplySemiTransparent
    ? 'bg-white bg-opacity-70 dark:bg-gray-800 dark:bg-opacity-80'
    : 'bg-white dark:bg-gray-800';

  const style: React.CSSProperties | undefined = backgroundImage
    ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll',
      }
    : undefined;

  return {
    className,
    style,
    hasBackgroundImage,
  };
};

/**
 * Get overlay style for parent want backgrounds
 * Creates the semi-transparent white overlay effect
 *
 * @returns CSS class for overlay
 */
export const getBackgroundOverlayClass = (): string => {
  return 'absolute inset-0 bg-white bg-opacity-40 dark:bg-gray-900 dark:bg-opacity-50 z-0 pointer-events-none';
};

/**
 * Get container style for content positioned over background image
 * Used when displaying content over a background image
 *
 * @returns CSS class for content container
 */
export const getBackgroundContentContainerClass = (hasBackgroundImage: boolean): string => {
  return hasBackgroundImage ? 'relative z-10' : '';
};
