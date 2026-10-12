import React from 'react';

/**
 * The map around one place, as a picture: the OpenStreetMap tiles the
 * location card's map is drawn from (LocationCardPlugin), laid down as plain
 * images — no Leaflet, nothing to drag — with the place's dot in the middle.
 * Cheap enough to draw on several things at once. Fills its box.
 */

const ZOOM = 15;
const TILE = 256;
/** How much of the map is shown across the box, in tile pixels. */
const SPAN = 256;

function tileXY(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

export const ThingMap: React.FC<{
  lat: number;
  lng: number;
  /** The dot's colour: the thing's. */
  color: string;
  className?: string;
}> = ({ lat, lng, color, className }) => {
  const box = React.useRef<HTMLDivElement>(null);
  const [side, setSide] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSide(Math.max(el.clientWidth, el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const p = tileXY(lat, lng, ZOOM);
  const px = p.x * TILE, py = p.y * TILE;
  const tiles: { x: number; y: number }[] = [];
  for (let tx = Math.floor((px - SPAN / 2) / TILE); tx <= Math.floor((px + SPAN / 2) / TILE); tx++) {
    for (let ty = Math.floor((py - SPAN / 2) / TILE); ty <= Math.floor((py + SPAN / 2) / TILE); ty++) {
      tiles.push({ x: tx, y: ty });
    }
  }
  const k = side / SPAN;
  return (
    <div ref={box} className={`relative overflow-hidden bg-[#e8e4d8] ${className ?? ''}`} aria-hidden>
      {side > 0 && (
        <div className="absolute left-1/2 top-1/2" style={{ width: SPAN, height: SPAN, transform: `translate(-50%, -50%) scale(${k})` }}>
          {tiles.map(t => (
            <img
              key={`${t.x}/${t.y}`}
              src={`https://tile.openstreetmap.org/${ZOOM}/${t.x}/${t.y}.png`}
              alt=""
              draggable={false}
              loading="lazy"
              onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
              className="absolute max-w-none select-none pointer-events-none"
              style={{ width: TILE, height: TILE, left: t.x * TILE - px + SPAN / 2, top: t.y * TILE - py + SPAN / 2 }}
            />
          ))}
        </div>
      )}
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: '14%', height: '14%', background: color, border: '2px solid white', boxShadow: '2px 3px 4px rgba(0,0,0,0.35)' }}
      />
    </div>
  );
};
