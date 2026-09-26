import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bike, Car, Footprints, ArrowLeftRight, MapPin } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { useConfigStore } from '@/stores/configStore';

/**
 * The way from one place to another, drawn on a map.
 *
 * Nothing is computed on the engine side: the want holds the question (where
 * from, where to, how are you travelling) and this card answers it. Two
 * OpenStreetMap services do the work — Nominatim turns the two place names into
 * coordinates, Valhalla returns the line between them — and neither needs an
 * API key. That was the point: the Google key this started as expired, and a
 * card that stops working when a key lapses is a card that will stop working.
 *
 * Both are public community endpoints, so the card asks once per question and
 * caches the answer against it, rather than re-routing on every render.
 */

// ── travel modes ─────────────────────────────────────────────────────────────
// The want's vocabulary, Valhalla's, and what to draw for each. Kept in one
// place so a fourth mode is one row rather than four edits.
const MODES = {
  walking:  { costing: 'pedestrian', label: '徒歩',   Icon: Footprints, color: '#16a34a' },
  cycling:  { costing: 'bicycle',    label: '自転車', Icon: Bike,       color: '#0891b2' },
  driving:  { costing: 'auto',       label: '車',     Icon: Car,        color: '#7c3aed' },
} as const;
type ModeKey = keyof typeof MODES;
const MODE_ORDER: ModeKey[] = ['walking', 'cycling', 'driving'];

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const VALHALLA  = 'https://valhalla1.openstreetmap.de/route';

let leafletCssLoaded = false;
function ensureLeafletCSS() {
  if (leafletCssLoaded) return;
  leafletCssLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

/**
 * Valhalla returns its shape as a polyline with six decimal places rather than
 * the usual five — the same algorithm, one order of magnitude finer.
 */
function decodePolyline6(str: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    for (const isLat of [true, false]) {
      let result = 0, shift = 0, b: number;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (isLat) lat += delta; else lng += delta;
    }
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

interface Solved {
  points: [number, number][];
  km: number;
  minutes: number;
  fromLabel: string;
  toLabel: string;
}

interface Place { lat: number; lon: number; label: string }

/**
 * Nominatim's usage policy is one request a second, and this card broke it
 * three ways at once: it asked for both ends in parallel, re-asked whenever the
 * travel mode changed (which cannot move a station), and every route card on
 * the board did the same on mount. That earns an IP-wide 429, and because the
 * 429 carries no CORS header the browser hides the status and reports only
 * "Failed to fetch" — an error that says nothing about what went wrong.
 *
 * So: answers are remembered for the session, and the ones that still have to
 * be asked go out one at a time with a gap. The queue is module-level because
 * the limit is per IP, not per card.
 */
const GEO_GAP_MS = 1100;
const geoCache = new Map<string, Place>();
let geoChain: Promise<unknown> = Promise.resolve();
let geoLastAt = 0;

/** A resolved definition as the "lat,lng" string the geocoder step understands,
 *  or null when it holds no usable coordinate (a name defined as something that
 *  is not a place at all). */
function coordsOf(resolved: unknown): string | null {
  const v = resolved as Record<string, unknown> | null | undefined;
  const lat = typeof v?.lat === 'number' ? v.lat : undefined;
  const lng = typeof v?.lng === 'number' ? v.lng : (typeof v?.lon === 'number' ? v.lon : undefined);
  if (lat === undefined || lng === undefined) return null;
  if (lat === 0 && lng === 0) return null;
  return `${lat},${lng}`;
}

/** "35.6979,139.6853" — a place given as coordinates rather than as a name. */
const COORD_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
function asCoords(place: string): Place | null {
  const m = COORD_RE.exec(place);
  if (!m) return null;
  return { lat: Number(m[1]), lon: Number(m[2]), label: '現在地' };
}

function geocode(place: string, country?: string): Promise<Place> {
  const key = `${place.trim()}${country ? `@${country}` : ''}`;
  // Already a coordinate — the "from here" button writes one. Answer without
  // asking anyone: it costs a request against a rate-limited service to have a
  // machine tell us what we already knew.
  const literal = asCoords(key);
  if (literal) return Promise.resolve(literal);
  const hit = geoCache.get(key);
  if (hit) return Promise.resolve(hit);

  const run = geoChain.then(async () => {
    const again = geoCache.get(key);
    if (again) return again;   // filled while we waited our turn
    const wait = GEO_GAP_MS - (Date.now() - geoLastAt);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    geoLastAt = Date.now();

    // Restricted to one country when config says so. Without it a bare station
    // name is a question about the whole planet: "新宿駅" came back as a city in
    // Anhui, China, and the router then refused the 900 km walk it had been
    // accidentally asked for. See ServerConfig.geocode_country.
    const params = new URLSearchParams({ format: 'json', limit: '1', q: place.trim() });
    if (country) params.set('countrycodes', country);
    const url = `${NOMINATIM}?${params.toString()}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      // fetch only throws for network/CORS failures. The overwhelmingly common
      // cause here is a rate-limited response we are not allowed to read.
      throw new Error('地名検索が混み合っています。少し待って再試行してください');
    }
    if (res.status === 429) throw new Error('地名検索が混み合っています。少し待って再試行してください');
    if (!res.ok) throw new Error(`場所を探せません (${res.status})`);
    const hits = await res.json();
    if (!Array.isArray(hits) || hits.length === 0) throw new Error(`「${place.trim()}」が見つかりません`);
    const found: Place = {
      lat: Number(hits[0].lat), lon: Number(hits[0].lon),
      label: String(hits[0].display_name ?? key),
    };
    geoCache.set(key, found);
    return found;
  });

  // The chain must survive a failed link, or one bad place name stops every
  // later lookup on the page.
  geoChain = run.catch(() => {});
  return run;
}

/**
 * The way through a list of places, in the order given.
 *
 * Two of them is a route from one place to another, which is what this card
 * was; more than two puts the extra ones in between as stops. Valhalla has
 * always taken a list — `locations` is an array and everything between the
 * ends is a waypoint — so going through three places was never a different
 * question to ask it, only a different question to be able to type.
 *
 * The order is the caller's. Valhalla will optimise one (there is an endpoint
 * for it), and using it would mean the line drawn stopped answering the
 * question that was asked.
 */
async function solve(places: string[], mode: ModeKey, country?: string): Promise<Solved> {
  // Serial, not Promise.all: see the note on the queue above.
  const found: Place[] = [];
  for (const place of places) found.push(await geocode(place, country));
  const a = found[0];
  const b = found[found.length - 1];
  const res = await fetch(VALHALLA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations: found.map(p => ({ lat: p.lat, lon: p.lon })),
      costing: MODES[mode].costing,
      directions_options: { units: 'kilometers' },
    }),
  });
  if (!res.ok) {
    // Valhalla says why in the body. Carrying its words through matters:
    // "exceeds the max distance limit" is a question that will never work and
    // "failed to parse" is a blip worth retrying, and a bare 400 cannot tell
    // you which one you are looking at.
    let why = '';
    try {
      const err = await res.json();
      why = String(err?.error ?? '').trim();
    } catch { /* not JSON; the status is all we have */ }
    throw new Error(why ? `経路を引けません: ${why}` : `経路を引けません (${res.status})`);
  }
  const data = await res.json();
  const trip = data?.trip;
  if (!trip?.legs?.length) throw new Error('経路が返ってきませんでした');
  const points = trip.legs.flatMap((leg: { shape: string }) => decodePolyline6(leg.shape));
  return {
    points,
    km: Number(trip.summary?.length ?? 0),
    minutes: Math.round(Number(trip.summary?.time ?? 0) / 60),
    fromLabel: a.label.split(',')[0],
    toLabel: b.label.split(',')[0],
  };
}

/** Write the want's params back — the card's controls are edits to the question. */
async function putParams(wantId: string, patch: Record<string, string>): Promise<void> {
  // Read-modify-write: the want this card was rendered from is whatever a list
  // response gave us, and a full PUT built from that would drop anything the
  // projection left out.
  const cur = await fetch(`/api/v1/wants/${encodeURIComponent(wantId)}`).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  const spec = cur.spec ?? {};
  const res = await fetch(`/api/v1/wants/${encodeURIComponent(wantId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...cur, spec: { ...spec, params: { ...(spec.params ?? {}), ...patch } } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

const RouteContentSection: React.FC<WantCardPluginProps> = ({ want, isExpanded }) => {
  const wantId = want.metadata?.id ?? '';
  const cur = want.state?.current ?? {};
  const from = String(cur.from ?? want.spec?.params?.from ?? '');
  const to   = String(cur.to   ?? want.spec?.params?.to   ?? '');
  // Stops on the way, in the order they were given.
  //
  // Read leniently: an array is what the parameter declares, and a string is
  // what a hand-edited want or a form that only had one box will have put
  // there. Empty entries are dropped rather than geocoded — an empty stop is
  // somebody part-way through typing one.
  const viaRaw = cur.via ?? want.spec?.params?.via;
  const via: string[] = (Array.isArray(viaRaw) ? viaRaw : String(viaRaw ?? '').split(','))
    .map(v => String(v ?? '').trim())
    .filter(Boolean);
  const rawMode = String(cur.mode ?? want.spec?.params?.mode ?? 'walking');
  const mode: ModeKey = (rawMode in MODES ? rawMode : 'walking') as ModeKey;

  // Where you are, if something is telling us — the want type declares `here`
  // importable, so a location want can be wired into it. Read defensively: it
  // arrives from whatever was connected, which is not this card's to trust.
  const hereRaw = cur.here as { lat?: unknown; lng?: unknown } | undefined;
  const here: [number, number] | null =
    hereRaw && Number.isFinite(Number(hereRaw.lat)) && Number.isFinite(Number(hereRaw.lng))
      ? [Number(hereRaw.lat), Number(hereRaw.lng)]
      : null;

  const [solved, setSolved] = useState<Solved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const endsRef = useRef<any[]>([]);
  const hereRef = useRef<any>(null);

  // One question, one lookup — these are somebody else's servers, and asking
  // again is the user's call, not the card's. `retry` is a nonce so pressing
  // 再試行 re-asks a question that has not changed; nothing else re-asks.
  const [retry, setRetry] = useState(0);
  const geocodeCountry = useConfigStore(s => s.config?.geocode_country) ?? '';
  // What `from`/`to` name, when they name something somebody has defined.
  //
  // Resolved by the server (see applyThingValues) and carried on the want like
  // any other field: 自宅 is not a question a geocoder can answer, and working
  // it out here meant a second copy of a rule the backend already had — with
  // its own idea of which catalogs to try and which definition wins.
  const fromResolved = coordsOf(want.state?.current?.from_resolved) ?? from;
  const toResolved = coordsOf(want.state?.current?.to_resolved) ?? to;
  const question = `${fromResolved}|${via.join('|')}|${toResolved}|${mode}|${geocodeCountry}|${retry}`;
  useEffect(() => {
    if (!from || !to) { setSolved(null); setError(null); return; }
    let cancelled = false;
    setBusy(true);
    setError(null);
    solve([fromResolved, ...via, toResolved], mode, geocodeCountry || undefined)
      .then(r => { if (!cancelled) setSolved(r); })
      .catch(e => { if (!cancelled) { setSolved(null); setError(e instanceof Error ? e.message : '経路を引けません'); } })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  // Draw. The map is created once and then only re-fitted, so panning the card
  // around does not throw the view away.
  useEffect(() => {
    if (!solved || !mapRef.current) return;
    ensureLeafletCSS();
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return;
      if (!mapObjRef.current) {
        mapObjRef.current = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: true,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapObjRef.current);
      }
      lineRef.current?.remove();
      endsRef.current.forEach(m => m.remove());
      endsRef.current = [];

      lineRef.current = L.polyline(solved.points, {
        color: MODES[mode].color, weight: 5, opacity: 0.85, lineJoin: 'round',
      }).addTo(mapObjRef.current);

      const dot = (at: [number, number], fill: string) => L.circleMarker(at, {
        radius: 6, color: '#fff', weight: 2, fillColor: fill, fillOpacity: 1,
      }).addTo(mapObjRef.current);
      endsRef.current = [
        dot(solved.points[0], MODES[mode].color),
        dot(solved.points[solved.points.length - 1], '#ef4444'),
      ];

      mapObjRef.current.fitBounds(lineRef.current.getBounds(), { padding: [18, 18] });
      requestAnimationFrame(() => mapObjRef.current?.invalidateSize());
    });

    return () => { cancelled = true; };
  }, [solved, mode]);

  // The pin, on its own effect: the phone moves far more often than the route
  // changes, and re-running the route drawing for every position update would
  // re-fit the map and yank the view around while you were reading it.
  useEffect(() => {
    if (!mapObjRef.current) return;
    if (!here) { hereRef.current?.remove(); hereRef.current = null; return; }
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !mapObjRef.current) return;
      if (!hereRef.current) {
        hereRef.current = L.circleMarker(here, {
          radius: 7, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1,
        }).addTo(mapObjRef.current).bindTooltip('現在地');
      } else {
        hereRef.current.setLatLng(here);
      }
    });
    return () => { cancelled = true; };
  }, [here?.[0], here?.[1], solved]);

  // The card's own size changes (maximise, sidebar resize) leave Leaflet with a
  // stale idea of its container; it only finds out if told.
  useEffect(() => {
    if (!mapObjRef.current) return;
    const id = requestAnimationFrame(() => {
      mapObjRef.current?.invalidateSize();
      if (lineRef.current) mapObjRef.current?.fitBounds(lineRef.current.getBounds(), { padding: [18, 18] });
    });
    return () => cancelAnimationFrame(id);
  }, [isExpanded]);

  useEffect(() => () => { mapObjRef.current?.remove(); mapObjRef.current = null; hereRef.current = null; }, []);

  const edit = useCallback(async (patch: Record<string, string>) => {
    if (!wantId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await putParams(wantId, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新できません');
      setBusy(false);
    }
    // Success leaves busy set: the want reloads and the question effect above
    // takes over, which is what actually finishes the job.
  }, [wantId, busy]);

  const ModeIcon = MODES[mode].Icon;
  // A coordinate in `from` is the "start from where I am" button's doing, and
  // reading it back as digits tells the user nothing they wanted to know.
  const shown = (p: string) => (asCoords(p) ? '現在地' : p);

  const map = (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="absolute inset-0 rounded-lg overflow-hidden" />
      {(!solved || busy) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 bg-black/5 rounded-lg px-3 text-center">
          <span>{error ?? (busy ? '経路を検索中…' : '出発地と目的地を入れてください')}</span>
          {/* The way out has to be here as well as on the expanded card: a
              failure you can only clear by making the card bigger is a failure
              you are stuck with at the size you normally read it. */}
          {error && !busy && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setRetry(n => n + 1); }}
              className="px-2 py-0.5 rounded-full border border-gray-400/60 font-semibold text-gray-600 dark:text-gray-300"
            >
              再試行
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Collapsed: the map and the one line of fact under it. The controls belong to
  // the expanded card — a card this size has room to show a route or to offer
  // buttons, not both.
  if (!isExpanded) {
    return (
      <WantCardLayout
        content={map}
        bottom={
          <div className="flex items-center gap-2 px-2 py-1 text-gray-600 dark:text-gray-300 min-w-0">
            <ModeIcon className="w-4 h-4 flex-shrink-0" style={{ color: MODES[mode].color }} />
            <span className="truncate">{shown(from) || '?'} → {to || '?'}</span>
            {solved && (
              <span className="ml-auto flex-shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                {solved.km.toFixed(1)}km · {solved.minutes}分
              </span>
            )}
          </div>
        }
      />
    );
  }

  return (
    <WantCardLayout
      content={map}
      bottom={
        <div
          className="flex flex-col gap-2 px-3 py-2 border-t border-black/10 dark:border-white/10"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate font-semibold text-gray-700 dark:text-gray-200">
              {shown(from) || '?'} → {to || '?'}
            </span>
            {solved && (
              <span className="ml-auto flex-shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                {solved.km.toFixed(1)}km · {solved.minutes}分
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode. Three buttons rather than a select: they are the card's
                subject, and one press is the whole interaction. */}
            {MODE_ORDER.map((m) => {
              const M = MODES[m];
              const on = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  data-inner-focus
                  {...(on ? { 'data-inner-focus-default': true } : {})}
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); void edit({ mode: m }); }}
                  title={`${M.label}で経路を引き直す`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold transition-colors disabled:opacity-50"
                  style={on
                    ? { background: M.color, borderColor: M.color, color: '#fff' }
                    : { background: 'transparent', borderColor: 'rgba(120,120,120,0.4)' }}
                >
                  <M.Icon className="w-4 h-4" />
                  {M.label}
                </button>
              );
            })}

            {/* Only offered when something is actually telling us where you are:
                a button that cannot work is worse than one that is not there. */}
            {here && (
              <button
                type="button"
                data-inner-focus
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); void edit({ from: `${here[0]},${here[1]}` }); }}
                title="いまいる場所から引き直す"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold transition-colors disabled:opacity-50"
                style={{ background: '#2563eb', borderColor: '#2563eb', color: '#fff' }}
              >
                <MapPin className="w-4 h-4" />
                現在地から
              </button>
            )}

            <button
              type="button"
              data-inner-focus
              disabled={busy || (!from && !to)}
              onClick={(e) => { e.stopPropagation(); void edit({ from: to, to: from }); }}
              title="出発地と目的地を入れ替える"
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-400/60 font-semibold text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              <ArrowLeftRight className="w-4 h-4" />
              入れ替え
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2">
              <span className="text-red-500">{error}</span>
              <button
                type="button"
                data-inner-focus
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); setRetry(n => n + 1); }}
                className="px-2 py-0.5 rounded-full border border-gray-400/60 font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50"
              >
                再試行
              </button>
            </div>
          )}
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['route'],
  ContentSection: RouteContentSection,
  hideFinalResult: true,
});
