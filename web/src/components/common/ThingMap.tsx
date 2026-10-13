import React from 'react';

/**
 * A map as a picture: the OpenStreetMap tiles the cards' maps are drawn from
 * (LocationCardPlugin, RouteCardPlugin), laid down as plain images — no
 * Leaflet, nothing to drag. Cheap enough to draw on several things, or several
 * want tiles' faces, at once. Fills its box.
 *
 *   StaticMap  around a centre, or fitted to a path and dots (a route, places)
 *   ThingMap   one place, with its dot large in the middle
 */

const TILE = 256;
/** Around a centre: the zoom, and how much of the map is shown across the box in tile pixels. */
const CENTER_ZOOM = 15;
const SPAN = 256;
/** Fitted: the share of the box the path and dots may take, and the closest zoom. */
const FIT = 0.8;
const MAX_ZOOM = 17;

function worldPx(lat: number, lng: number, z: number) {
  const n = 2 ** z * TILE;
  const r = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  };
}

export interface MapDot { lat: number; lng: number; color: string; title?: string }

export const StaticMap: React.FC<{
  /** What the view is around, when nothing is given to fit. */
  center?: { lat: number; lng: number };
  /** A line drawn on the map, in its colour; the view is fitted to it. */
  path?: [number, number][];
  pathColor?: string;
  /** Dots on the map, at a fixed size whatever the zoom. With no path, the
   *  view is fitted to them unless there is a centre. */
  dots?: MapDot[];
  className?: string;
  children?: React.ReactNode;
}> = ({ center, path, pathColor = '#2563eb', dots, className, children }) => {
  const box = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const fitTo: [number, number][] = path?.length ? path : !center && dots?.length ? dots.map(d => [d.lat, d.lng]) : [];

  // The zoom and the scale the tiles are drawn at, and the centre in world pixels.
  let z = CENTER_ZOOM, k = Math.max(w, h) / SPAN, c = center ? worldPx(center.lat, center.lng, z) : null;
  if (fitTo.length && w > 0 && h > 0) {
    const extent = (zz: number) => {
      const ps = fitTo.map(([la, ln]) => worldPx(la, ln, zz));
      const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    z = MAX_ZOOM;
    let e = extent(z);
    while (z > 2 && (e.x1 - e.x0 > w * FIT || e.y1 - e.y0 > h * FIT)) e = extent(--z);
    // Between whole zooms, the tiles are drawn up to twice their size.
    k = Math.min(2, (w * FIT) / Math.max(1, e.x1 - e.x0), (h * FIT) / Math.max(1, e.y1 - e.y0));
    k = Math.max(1, k);
    c = { x: (e.x0 + e.x1) / 2, y: (e.y0 + e.y1) / 2 };
  }

  const ready = !!c && w > 0 && h > 0;
  const tiles: { x: number; y: number }[] = [];
  let ox = 0, oy = 0;
  if (ready) {
    // The top-left of the view, in world pixels at this zoom.
    ox = c!.x - w / (2 * k);
    oy = c!.y - h / (2 * k);
    const n = 2 ** z;
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + w / k) / TILE); tx++) {
      for (let ty = Math.max(0, Math.floor(oy / TILE)); ty <= Math.min(n - 1, Math.floor((oy + h / k) / TILE)); ty++) {
        tiles.push({ x: tx, y: ty });
      }
    }
  }
  const at = (lat: number, lng: number) => {
    const p = worldPx(lat, lng, z);
    return { x: (p.x - ox) * k, y: (p.y - oy) * k };
  };

  return (
    // Positioned by the caller when it says so (absolute inset-0), else relative for what is drawn in it.
    <div ref={box} className={`${/\b(absolute|fixed)\b/.test(className ?? '') ? '' : 'relative'} overflow-hidden bg-[#e8e4d8] ${className ?? ''}`} aria-hidden>
      {ready && (
        <>
          <div className="absolute left-0 top-0" style={{ width: w / k, height: h / k, transform: `scale(${k})`, transformOrigin: '0 0' }}>
            {tiles.map(t => (
              <img
                key={`${t.x}/${t.y}`}
                src={`https://tile.openstreetmap.org/${z}/${((t.x % 2 ** z) + 2 ** z) % 2 ** z}/${t.y}.png`}
                alt=""
                draggable={false}
                loading="lazy"
                onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                className="absolute max-w-none select-none pointer-events-none"
                style={{ width: TILE, height: TILE, left: t.x * TILE - ox, top: t.y * TILE - oy }}
              />
            ))}
          </div>
          {path && path.length > 1 && (
            <svg className="absolute inset-0 pointer-events-none" width={w} height={h}>
              <polyline
                points={path.map(([la, ln]) => { const p = at(la, ln); return `${p.x},${p.y}`; }).join(' ')}
                fill="none" stroke={pathColor} strokeWidth={5} strokeOpacity={0.85} strokeLinejoin="round" strokeLinecap="round"
              />
            </svg>
          )}
          {dots?.map((d, i) => {
            const p = at(d.lat, d.lng);
            if (p.x < -8 || p.y < -8 || p.x > w + 8 || p.y > h + 8) return null;
            return (
              <span
                key={i}
                title={d.title}
                className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
                style={{ left: p.x, top: p.y, width: 12, height: 12, background: d.color, border: '2px solid white', boxShadow: '1px 2px 3px rgba(0,0,0,0.35)' }}
              />
            );
          })}
        </>
      )}
      {children}
    </div>
  );
};

export const ThingMap: React.FC<{
  lat: number;
  lng: number;
  /** The dot's colour: the thing's. */
  color: string;
  className?: string;
}> = ({ lat, lng, color, className }) => (
  <StaticMap center={{ lat, lng }} className={className}>
    <span
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ width: '14%', height: '14%', background: color, border: '2px solid white', boxShadow: '2px 3px 4px rgba(0,0,0,0.35)' }}
    />
  </StaticMap>
);
