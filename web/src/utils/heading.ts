/**
 * What a direction want's heading may be: an integer grid vector, not the
 * centre, no longer than the dial's radius. Shared by the want's card (which
 * steps it by keys) and the board's dial (CanvasDirectionGuide, which snaps a
 * pointer to it).
 */

const EIGHT_DIRS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/**
 * Snaps a raw (unrounded) grid-cell vector to the nearest grid intersection
 * that is actually a legal heading: an integer point, no further from the
 * centre than `maxMag`. A vector that rounds to (0,0) is pushed out to the
 * nearest of the 8 grid-aligned directions.
 *
 * The order matters, and it used to be the other way round: scale into the
 * circle first, then round. Rounding then puts the point back OUTSIDE it —
 * the rim at 45° is (3.54, 3.54), which is exactly on the circle, so nothing
 * scales, and it rounds to (4, 4) with a magnitude of 5.66. The server takes
 * that at its word and scales it proportionally to fit (see
 * clampDirectionVector in direction_types.go), storing (3.54, 3.54).
 *
 * Which is how aiming at the edge of the dial diagonally used to change its
 * own mind: the needle went where it was put, and then the vector came back
 * from the server shorter and off the lattice — a heading sitting between the
 * dots, at a moment that had nothing to do with the gesture that set it. Every
 * point around the rim that is not on an axis did this: (4,4), (5,±1), (5,±2)
 * and their mirrors.
 *
 * So the legal points are enumerated instead, and the nearest one wins. The
 * disc is 11×11 at the radius this is ever called with; there is nothing to
 * be clever about.
 */
export function snapToGridVector(rawDx: number, rawDy: number, maxMag: number): { dx: number; dy: number } {
  const mag = Math.hypot(rawDx, rawDy);
  const dx = Math.round(rawDx);
  const dy = Math.round(rawDy);

  // Dead centre is not a heading — a direction always points somewhere.
  if (dx === 0 && dy === 0) {
    const angle = mag === 0 ? 0 : Math.atan2(rawDy, rawDx);
    const octant = (Math.round(angle / (Math.PI / 4)) % 8 + 8) % 8;
    const [ex, ey] = EIGHT_DIRS[octant];
    return { dx: ex, dy: ey };
  }
  if (Math.hypot(dx, dy) <= maxMag) return { dx, dy };

  // Outside the circle: the closest point inside it to where they aimed.
  const r = Math.floor(maxMag);
  let best = { dx: EIGHT_DIRS[0][0], dy: EIGHT_DIRS[0][1] };
  let bestDist = Infinity;
  for (let i = -r; i <= r; i++) {
    for (let j = -r; j <= r; j++) {
      if (i === 0 && j === 0) continue;
      if (Math.hypot(i, j) > maxMag) continue;
      const d = Math.hypot(i - rawDx, j - rawDy);
      if (d < bestDist) { bestDist = d; best = { dx: i, dy: j }; }
    }
  }
  return best;
}

/**
 * Whether a heading is one the server will store exactly as given.
 *
 * Same rule as snapToGridVector's, for the paths that arrive at a vector by
 * stepping rather than by pointing — see the arrow keys in
 * DirectionCardPlugin, which used to walk straight off the dial and out to
 * (10, 0), commit it, and have it come back as (5, 0).
 */
export function isLegalHeading(dx: number, dy: number, maxMag: number): boolean {
  return !(dx === 0 && dy === 0) && Math.hypot(dx, dy) <= maxMag;
}

