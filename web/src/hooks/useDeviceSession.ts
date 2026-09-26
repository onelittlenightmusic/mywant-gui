import { useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/api/client';
import { BrowserDevice } from '@/types/device';

const SESSION_ID_KEY = 'mywant:device-session-id';
const HEARTBEAT_MS = 30_000;
const STALE_THRESHOLD_MS = 90_000;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for HTTP / older Safari
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function loadOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const id = generateUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
    return id;
  } catch {
    return generateUUID();
  }
}

function parseDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

async function upsertDevice(device: BrowserDevice, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    const { seq, state } = await apiClient.getGUIState();
    const devices: BrowserDevice[] = Array.isArray(state.devices) ? state.devices as BrowserDevice[] : [];
    // Update in place. Dropping the entry and re-appending it moved this
    // device to the end of the list on every heartbeat, so with more than one
    // browser open the cards reshuffled every 30 seconds — the grid is rendered
    // in this order, and nothing else decides it.
    const alive = devices.filter(d => d.id === device.id || Date.now() - d.lastSeen < STALE_THRESHOLD_MS * 3);
    const seen = { ...device, lastSeen: Date.now() };
    const updated = alive.some(d => d.id === device.id)
      ? alive.map(d => (d.id === device.id ? seen : d))
      : [...alive, seen];
    try {
      await apiClient.updateGUIState({ devices: updated }, seq);
      return;
    } catch (err: any) {
      if (err?.status === 412 && i < retries - 1) continue;
      throw err;
    }
  }
}

export const myDeviceId = loadOrCreateSessionId();
export const myDeviceName = parseDeviceName();

export function useDeviceSession() {
  const mountedRef = useRef(true);

  const heartbeat = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      await upsertDevice({ id: myDeviceId, name: myDeviceName, lastSeen: Date.now() });
    } catch {
      // network issue — will retry on next heartbeat
    }
  }, []);

  useEffect(() => {
    // Tell the browser extension which device this browser counts as, so its
    // poll can identify itself and the server can pin browser work to one
    // browser (see homeBrowserDevice). bridge.js relays it; a browser without
    // the extension simply has nobody listening.
    window.postMessage({ source: 'mywant-gui', type: 'MYWANT_DEVICE_ID', deviceId: myDeviceId }, window.location.origin);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    heartbeat();
    const timer = setInterval(heartbeat, HEARTBEAT_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [heartbeat]);
}
