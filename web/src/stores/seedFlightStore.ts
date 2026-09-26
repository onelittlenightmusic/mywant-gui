import { create } from 'zustand';

export interface FlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** What a ghost is carrying, which is also how a landing pad addresses it. */
export type FlightKind = 'thing' | 'type';

/** One element in flight between two places in the UI.
 *
 *  Two of these run at once when a want type is picked for a thing-seeded want:
 *  the thing flies onto the parameter it fills while the type flies onto
 *  the form's header, so the two halves of "what am I making" arrive together
 *  rather than one replacing the other. */
export interface SeedFlight {
  kind: FlightKind;
  sourceRect: FlightRect;
  targetRect: FlightRect | null;
  icon: string;
  color: string;
  value: string;
  subtype: string;
  nonce: number;
}

interface SeedFlightStore {
  flights: SeedFlight[];
  /** Launches a ghost; a second launch of the same kind replaces it. */
  startFlight: (flight: Omit<SeedFlight, 'nonce' | 'targetRect'>) => void;
  /** Called by the landing element once it can be measured. */
  reportTarget: (kind: FlightKind, rect: FlightRect) => void;
  /** Ends one flight (it has landed or timed out). */
  endFlight: (kind: FlightKind) => void;
  clear: () => void;
}

export const useSeedFlightStore = create<SeedFlightStore>((set) => ({
  flights: [],
  startFlight: (flight) =>
    set((s) => ({
      flights: [
        ...s.flights.filter((f) => f.kind !== flight.kind),
        { ...flight, targetRect: null, nonce: Date.now() },
      ],
    })),
  reportTarget: (kind, rect) =>
    set((s) => ({
      flights: s.flights.map((f) => (f.kind === kind ? { ...f, targetRect: rect } : f)),
    })),
  endFlight: (kind) => set((s) => ({ flights: s.flights.filter((f) => f.kind !== kind) })),
  clear: () => set({ flights: [] }),
}));
