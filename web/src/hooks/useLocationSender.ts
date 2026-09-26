import { useEffect, useRef } from 'react';
import { myDeviceId } from './useDeviceSession';

interface LocationPayload {
  device_id: string;
  device_name: string;
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

export function useLocationSender(
  isActive: boolean,
  deviceName: string,
  wantIds: string[],
) {
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || wantIds.length === 0) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    const ids = [...wantIds];

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const payload: LocationPayload = {
          device_id: myDeviceId,
          device_name: deviceName,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp,
        };
        ids.forEach(id => {
          fetch(`/api/v1/webhooks/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        });
      },
      (err) => {
        console.warn('[LocationSender] geolocation error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isActive, wantIds, deviceName]);
}
