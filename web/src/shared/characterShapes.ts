// The outline a character is drawn inside — the frame around their avatar,
// wherever they appear: standing on the canvas, on somebody else's screen, in
// the header, on the minimap.
//
// It was always a circle, hard-coded in each of those places. A circle is a
// fine default and a poor identity: two people on one board with two colours is
// all the difference there was, and colour is exactly what fails at minimap
// size, under a glow, or for anyone who does not separate those two hues. A
// silhouette survives all three — a star and a circle are still a star and a
// circle at six pixels.
//
// One geometry, expressed once: every shape is a path in the same 100x100 box,
// so a renderer only needs the box (see CharacterBadge). Framework-agnostic and
// dependency-free by design — this file's functions are spliced into the
// browser-extension overlay as source text (see webext/build-shared-visuals.js),
// the same way cursorManFigure.ts is, so nothing here may reach outside itself.

/** The shapes on offer. `circle` is the default and the way everyone looked
 *  before this existed, so an unset shape must resolve to it. */
export type CharacterShapeId =
  | 'circle'
  | 'star'
  | 'heart'
  | 'hexagon'
  | 'diamond'
  | 'shield'
  | 'ship'
  | 'airplane'
  | 'flower'
  | 'crown';

export interface CharacterShape {
  id: CharacterShapeId;
  /** What the picker calls it. */
  label: string;
  /**
   * The outline, as SVG path data in a `0 0 100 100` viewBox, centred on
   * (50,50) and kept a few units inside the box so a stroke on the path is not
   * clipped by the box's edge.
   *
   * Several subpaths are allowed (a ship's hull and sail, a flower's petals);
   * they are filled as one shape under the default nonzero rule, and each
   * subpath's own outline is stroked — which is what makes a flower read as
   * petals rather than as a blob.
   */
  path: string;
}

/**
 * Every shape, in picker order: the default first, then the plain geometry, then
 * the things (a ship, a plane) that are chosen for fun.
 *
 * Each one has to hold an emoji in its middle at ~28/100 of the box and still be
 * recognisable from its edge alone — which rules out anything long and thin, and
 * is why the ship and the plane are drawn broad rather than to scale.
 */
export const CHARACTER_SHAPES: CharacterShape[] = [
  {
    id: 'circle',
    label: 'Circle',
    // Two arcs rather than a <circle>, so one renderer can draw every shape.
    path: 'M4 50 A46 46 0 1 0 96 50 A46 46 0 1 0 4 50 Z',
  },
  {
    id: 'star',
    label: 'Star',
    path: 'M50 2 L61.2 34.6 L95.7 35.2 L68.1 55.9 L78.2 88.8 L50 69 L21.8 88.8 L31.9 55.9 L4.3 35.2 L38.8 34.6 Z',
  },
  {
    id: 'heart',
    label: 'Heart',
    path: 'M50 92 C18 70 8 52 8 36 C8 20 20 10 33 10 C41 10 47 14 50 20 C53 14 59 10 67 10 C80 10 92 20 92 36 C92 52 82 70 50 92 Z',
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    path: 'M50 2 L91.6 26 L91.6 74 L50 98 L8.4 74 L8.4 26 Z',
  },
  {
    id: 'diamond',
    label: 'Diamond',
    path: 'M50 3 L97 50 L50 97 L3 50 Z',
  },
  {
    id: 'shield',
    label: 'Shield',
    path: 'M50 5 L88 18 V48 C88 70 72 86 50 95 C28 86 12 70 12 48 V18 Z',
  },
  {
    id: 'ship',
    label: 'Ship',
    // Hull, then mast and sail. The hull is deep and the sail broad so the
    // emoji has somewhere to sit; a ship drawn to scale is mostly waterline.
    path: 'M6 60 L94 60 L78 88 C60 94 40 94 22 88 Z M47 58 V10 L82 46 L47 46 Z M44 10 H50 V58 H44 Z',
  },
  {
    id: 'airplane',
    label: 'Airplane',
    // Seen from above: nose at the top, wings across the middle, tailplane at
    // the bottom. Wide-bodied on purpose, for the same reason as the ship.
    path: 'M50 4 C55 4 58 12 58 24 V38 L94 58 V68 L58 57 V76 L72 86 V93 L50 86 L28 93 V86 L42 76 V57 L6 68 V58 L42 38 V24 C42 12 45 4 50 4 Z',
  },
  {
    id: 'flower',
    label: 'Flower',
    path:
      'M29 24 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z ' +
      'M51.5 37 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z ' +
      'M51.5 63 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z ' +
      'M29 76 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z ' +
      'M6.5 63 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z ' +
      'M6.5 37 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0 Z ' +
      'M26 50 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 Z',
  },
  {
    id: 'crown',
    label: 'Crown',
    path: 'M8 84 L16 22 L33 44 L50 12 L67 44 L84 22 L92 84 Z',
  },
];

/**
 * The outline for a shape id — the default circle for anything unset, unknown,
 * or written by a newer version of the app than this one.
 *
 * Never throws and never returns empty: a character whose shape cannot be drawn
 * has to be drawn anyway, and invisible is the one wrong answer.
 */
export function characterShapePath(shape?: string | null): string {
  const found = CHARACTER_SHAPES.find(s => s.id === shape);
  return (found ?? CHARACTER_SHAPES[0]).path;
}

/** The shape's own name, for a label or a title attribute. */
export function characterShapeLabel(shape?: string | null): string {
  const found = CHARACTER_SHAPES.find(s => s.id === shape);
  return (found ?? CHARACTER_SHAPES[0]).label;
}
