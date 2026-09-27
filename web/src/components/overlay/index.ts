/**
 * The overlay library — every overlay menu and dialog is drawn from here.
 *
 *   OverlayActionGrid  a grid of action cells with keyboard / pad selection
 *   OverlayCell        one cell, for a layout the grid does not cover
 *   OverlayBubble      the box a free-standing overlay sits in, with its tail
 *   OverlayTextStage   a stage that asks for a few words, with back / submit cells
 *   tones              what an action means, and the sizes every design lays out on
 *   design             how overlays look — `grid` built in, more from extensions
 *
 * An overlay says what its actions mean (a tone) and never how they are
 * painted; scripts/check-overlays.mjs keeps it that way.
 */
export { OverlayActionGrid, type OverlayItem } from './OverlayActionGrid';
export { OverlayCell, type OverlayCellProps } from './OverlayCell';
export { OverlayBubble, type OverlayBubbleProps } from './OverlayBubble';
export { OverlayTextStage, type OverlayTextStageProps } from './OverlayTextStage';
export {
  type OverlayTone, OVERLAY_TONES,
  OVERLAY_CELL_PX, OVERLAY_MAX_ROW, OVERLAY_HEIGHT_PX, OVERLAY_STAGGER_MS,
} from './tones';
export {
  type OverlayDesign, type OverlayPortableStyle, GRID_OVERLAY_DESIGN,
  registerOverlayDesign, listOverlayDesigns, onOverlayDesignRegistered,
  overlayDesignOf, withOverlayDesign, portableOverlayStyleOf, overlayDesign, useOverlayDesign,
  currentOverlayDesignId, setLocalOverlayDesign,
} from './design';
export { useOverlayDesignChoice, type OverlayDesignChoice } from './useOverlayDesignChoice';
