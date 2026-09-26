import React, { useEffect, useState } from 'react';
import { useSeedFlightStore, type SeedFlight, type FlightKind } from '@/stores/seedFlightStore';
import { resolveLucideIcon } from '@/utils/subtypeIcons';

/** If a landing pad never reports (the form failed to open, an unexpected
 *  layout), the ghost gives up and fades where it is. */
const TARGET_TIMEOUT_MS = 1600;
const FLIGHT_MS = 380;
const FADE_MS = 160;

/** One ghost. Morphs from where it took off to where it lands (top/left/width/
 *  height, the same technique as the want card maximize) and fades on arrival. */
const Ghost: React.FC<{ flight: SeedFlight; onDone: (kind: FlightKind) => void }> = ({ flight, onDone }) => {
  const [fading, setFading] = useState(false);

  // Give up if no landing pad shows up in time.
  useEffect(() => {
    const t = setTimeout(() => setFading(true), TARGET_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [flight.nonce]);

  // Once the target is known, fade out at arrival time.
  useEffect(() => {
    if (!flight.targetRect) return;
    const t = setTimeout(() => setFading(true), FLIGHT_MS);
    return () => clearTimeout(t);
  }, [flight.targetRect, flight.nonce]);

  useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => onDone(flight.kind), FADE_MS);
    return () => clearTimeout(t);
  }, [fading, flight.kind, onDone]);

  const rect = flight.targetRect ?? flight.sourceRect;
  const Icon = resolveLucideIcon(flight.icon);

  return (
    <div
      aria-hidden
      className="fixed z-[300] pointer-events-none flex items-center gap-3 rounded-2xl p-3 bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        opacity: fading ? 0 : 1,
        transition: `top ${FLIGHT_MS}ms var(--ease-settle), left ${FLIGHT_MS}ms var(--ease-settle), width ${FLIGHT_MS}ms var(--ease-settle), height ${FLIGHT_MS}ms var(--ease-settle), opacity ${FADE_MS}ms ease-out`,
      }}
    >
      <div
        className="flex items-center justify-center rounded-2xl flex-shrink-0"
        style={{
          backgroundColor: `${flight.color}3a`,
          width: 'min(40%, 5rem)',
          aspectRatio: '1 / 1',
        }}
      >
        {Icon && <Icon className="w-1/2 h-1/2" style={{ color: flight.color }} strokeWidth={1.75} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
          {flight.value}
        </div>
        <span
          className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium"
          style={{ color: flight.color, backgroundColor: `${flight.color}22` }}
        >
          {flight.subtype}
        </span>
      </div>
    </div>
  );
};

/**
 * Shared-element ghosts for the Add Want flow.
 *
 * The thing flies from the thing card into the form when a want is seeded,
 * and again — alongside the want type — when a type is chosen, so both halves
 * of what is being made move at once instead of one replacing the other.
 */
export const SeedFlightOverlay: React.FC = () => {
  const flights = useSeedFlightStore((s) => s.flights);
  const endFlight = useSeedFlightStore((s) => s.endFlight);

  if (flights.length === 0) return null;
  return (
    <>
      {flights.map((f) => (
        <Ghost key={`${f.kind}-${f.nonce}`} flight={f} onDone={endFlight} />
      ))}
    </>
  );
};
