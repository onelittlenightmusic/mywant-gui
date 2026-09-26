import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { useCharacterStore } from '@/stores/characterStore';
import { useThingStore } from '@/stores/thingStore';
import { placeMarks } from '@/types/character';
import { thingDotHtml } from '@/components/common/ThingDot';
import { useDarkMode } from '@/hooks/useDarkMode';

/** Place names come from user input, so they are escaped before going into the
 *  divIcon's HTML — Leaflet takes a raw string, not React nodes. */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!
  ));
}

// Lazily import leaflet to avoid SSR issues
let leafletLoaded = false;
function ensureLeafletCSS() {
  if (leafletLoaded) return;
  leafletLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

export const LocationContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const placeLayerRef = useRef<any>(null);
  // The map is created inside an async import, so the place-pin effect below
  // cannot assume it exists on first run — it waits for this to flip.
  const [mapReady, setMapReady] = useState(false);

  const lat = want.state?.current?.lat as number | undefined;
  const lng = want.state?.current?.lng as number | undefined;
  const accuracy = want.state?.current?.accuracy as number | undefined;
  const city = want.state?.current?.city as string | undefined;
  const address = want.state?.current?.address as string | undefined;
  const hasLocation = lat != null && lng != null && (lat !== 0 || lng !== 0);

  // Every named place, from the ledger that holds names, coloured by whoever
  // named it — the colour is what tells them apart, so showing only my own
  // would defeat the point. ensureThings because this card is reachable
  // without ever opening the Thing page, which is what used to load them.
  const characters = useCharacterStore(s => s.characters);
  const definitions = useThingStore(s => s.definitions);
  const ensureThings = useThingStore(s => s.ensureThings);
  useEffect(() => { ensureThings(); }, [ensureThings]);
  const marks = useMemo(() => placeMarks(definitions, characters), [definitions, characters]);
  // The dot's shading needs to know which way the page is lit; the map tiles
  // themselves are always light, but the dot has to match the canvas's.
  const isLightMap = !useDarkMode();
  // Re-running the marker effect on every store tick would rebuild the layer
  // constantly; key it on the values that actually change the pins.
  const marksKey = marks.map(m => `${m.name}|${m.lat}|${m.lng}|${m.color}`).join(';');

  useEffect(() => {
    if (!hasLocation || !mapRef.current) return;

    ensureLeafletCSS();

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!leafletMapRef.current) {
        leafletMapRef.current = L.map(mapRef.current!, {
          zoomControl: true,
          attributionControl: false,
          dragging: true,
          scrollWheelZoom: false,
          doubleClickZoom: true,
          touchZoom: true,
        }).setView([lat!, lng!], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(leafletMapRef.current);

        // Force tile load after container is fully painted
        requestAnimationFrame(() => leafletMapRef.current?.invalidateSize());

        markerRef.current = L.marker([lat!, lng!]).addTo(leafletMapRef.current);
        if (accuracy && accuracy > 0) {
          circleRef.current = L.circle([lat!, lng!], {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(leafletMapRef.current);
        }
        setMapReady(true);
      } else {
        leafletMapRef.current.setView([lat!, lng!], 15);
        markerRef.current?.setLatLng([lat!, lng!]);
        circleRef.current?.setLatLng([lat!, lng!]);
        if (accuracy && accuracy > 0) circleRef.current?.setRadius(accuracy);
      }
    });
  }, [lat, lng, accuracy, hasLocation]);

  // Aura place pins — their own layer group, rebuilt whenever the marks change
  // so removals are handled without diffing individual markers.
  useEffect(() => {
    if (!hasLocation || !mapReady) return;
    let cancelled = false;

    import('leaflet').then((L) => {
      const map = leafletMapRef.current;
      if (cancelled || !map) return;

      placeLayerRef.current?.remove();
      const layer = L.layerGroup().addTo(map);
      placeLayerRef.current = layer;

      for (const m of marks) {
        L.marker([m.lat, m.lng], {
          icon: L.divIcon({
            className: '',        // suppress Leaflet's default divIcon box
            iconSize: [0, 0],
            iconAnchor: [0, 0],
            // The dot every remembered value wears, with the name above it —
            // a pill in the character's colour used to stand in for the place,
            // and there is no reason for a named place to look different here
            // than it does on the canvas. The dot sits on the coordinate; the
            // name floats above it, so nothing has to point at anything.
            html:
              `<div class="apm-wrap" style="color:${escapeHtml(m.color)}">` +
                `<span class="apm-name">${escapeHtml(m.name)}</span>` +
                // Big enough for the initial to read: the dot wears the thing's
                // own face here as it does everywhere else, and below ~14px a
                // character in it turns to mud.
                thingDotHtml(m.color, 18, isLightMap, m.name) +
              `</div>`,
          }),
          title: m.name,
          // Below the current-position marker, which stays the focal point.
          zIndexOffset: -100,
        }).addTo(layer);
      }
    });

    return () => {
      cancelled = true;
      placeLayerRef.current?.remove();
      placeLayerRef.current = null;
    };
  }, [marksKey, hasLocation, mapReady, isLightMap]);

  // Invalidate Leaflet map size whenever the container resizes (e.g. card maximize)
  useEffect(() => {
    if (!mapRef.current) return;
    const ro = new ResizeObserver(() => {
      leafletMapRef.current?.invalidateSize();
    });
    ro.observe(mapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  return (
    <WantCardLayout
      content={
        <div className="h-full relative overflow-hidden rounded-xl bg-gray-900">
          {hasLocation ? (
            <>
              <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />
              {/* Address overlay */}
              {(city || address) && (
                <div className="absolute bottom-0 left-0 right-0 z-10 px-2 py-1"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
                  <p className="text-white font-medium truncate" title={address}>
                    📍 {city || address}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-gray-500">
              <span className="text-2xl">🗺️</span>
              <span>位置情報なし</span>
            </div>
          )}
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['location'],
  ContentSection: LocationContentSection,
  hideFinalResult: true,
});
