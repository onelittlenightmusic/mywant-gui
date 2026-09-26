// Dashboard-side WebHID controller hub. Holds one granted HID gamepad, parses
// its input reports (via the shared web/src/shared/hidGamepad.ts, the same
// parser the extension background uses), and exposes the latest normalized
// frame so useInputActions' gamepad poller can prefer it over the Gamepad API.
//
// On the dashboard (a focused, top-level page) WebHID buys little over the
// Gamepad API by itself — but it keeps input handling uniform with the
// extension, and lets a controller work here without a page focus quirk. The
// grant is per-origin and persists; getDevices() auto-reconnects on load.
// mac/Chrome only (WebHID is Chromium-only).

import { parseHidGamepadReport, isHidGamepad, makeControllerResolver, NormalizedControllerState } from '@/shared/hidGamepad';

// WebHID lib types aren't in the default TS DOM lib — treat the API loosely.
type AnyHidDevice = any;

let device: AnyHidDevice = null;

// The single controller-state source for the dashboard: WebHID frames (fed
// from this hub's HID reader) preferred, else the Gamepad API. Every web
// consumer (useInputActions' poll, WantCanvas' right-stick zoom) reads through
// getControllerState() so the WebHID/Gamepad resolution lives in exactly one
// place (shared with the extension overlays via the same makeControllerResolver).
const resolver = makeControllerResolver(() => navigator.getGamepads?.());

export interface ControllerStatus { connected: boolean; name: string; }
const statusListeners = new Set<(s: ControllerStatus) => void>();

function status(): ControllerStatus {
  return { connected: !!device, name: (device && device.productName) || '' };
}
function notify(): void {
  const s = status();
  statusListeners.forEach(l => l(s));
}

function onInputReport(e: any): void {
  const frame = parseHidGamepadReport(e.device.collections, e.reportId, e.data);
  if (frame) resolver.setHidFrame(frame);
}

async function openDevice(d: AnyHidDevice): Promise<boolean> {
  if (!d) return false;
  if (!d.opened) await d.open();
  d.addEventListener('inputreport', onInputReport);
  device = d;
  enableVibration();
  notify();
  return true;
}

// ── Rumble ───────────────────────────────────────────────────────────────────
//
// Output reports, because input is the only thing the Gamepad API can give us
// here: a device opened over WebHID disappears from navigator.getGamepads(),
// which takes gamepad.vibrationActuator with it. So the pad that this hub is
// driving is exactly the pad that cannot be rumbled the standard way, and the
// reports have to be written by hand.
//
// Written for the Switch Pro Controller (0x057e/0x2009), which is what this was
// developed and verified against. The encoding is its own — report 0x10 carries
// eight bytes of HD-rumble data, four per side — so other pads will ignore
// these reports rather than obey them. That is the right failure: silent, not
// wrong. A second device family means a second encoding, chosen by vendor id.
//
// Verified on hardware rather than derived: a single report is enough (the
// rumble runs until told otherwise, so there is no need to feed it every frame,
// which is what the input reports are already using this channel for), and it
// has to run long enough to be felt — 80ms could not be, 150ms comfortably can.
const RUMBLE_OFF  = [0x00, 0x01, 0x40, 0x40];
const RUMBLE_TAP  = [0x28, 0x88, 0x60, 0x61];
// Output reports on this device are 48 bytes including the report id, and
// sendReport supplies the id separately.
const OUT_REPORT_BYTES = 47;
// Both the rumble-only report and the subcommand report share one counter,
// which the controller expects to advance on every output report.
let outCounter = 0;
let rumbleStopTimer: ReturnType<typeof setTimeout> | null = null;

function padded(body: number[]): Uint8Array {
  const out = new Uint8Array(OUT_REPORT_BYTES);
  out.set(body.slice(0, OUT_REPORT_BYTES));
  return out;
}

/** Fire-and-forget: the device can vanish between the check and the write. */
function sendOutput(reportId: number, body: number[]): void {
  const d = device;
  if (!d) return;
  try {
    Promise.resolve(d.sendReport(reportId, padded(body))).catch(() => {});
  } catch {
    /* closed underneath us */
  }
}

/** Subcommand 0x48 — without it the controller ignores rumble data entirely. */
function enableVibration(): void {
  sendOutput(0x01, [outCounter++ & 0x0f, ...RUMBLE_OFF, ...RUMBLE_OFF, 0x48, 0x01]);
}

/**
 * A short tap, felt rather than heard.
 *
 * Falls through to the Gamepad API when this hub does not own a device — either
 * nothing was granted, or the browser extension holds it (see the relay above),
 * in which case the pad IS visible to navigator.getGamepads() and can be
 * rumbled the standard way.
 */
export function rumbleTap(ms = 150): void {
  if (device) {
    if (rumbleStopTimer) clearTimeout(rumbleStopTimer);
    sendOutput(0x10, [outCounter++ & 0x0f, ...RUMBLE_TAP, ...RUMBLE_TAP]);
    rumbleStopTimer = setTimeout(() => {
      rumbleStopTimer = null;
      sendOutput(0x10, [outCounter++ & 0x0f, ...RUMBLE_OFF, ...RUMBLE_OFF]);
    }, ms);
    return;
  }
  try {
    for (const g of navigator.getGamepads?.() ?? []) {
      const actuator = (g as unknown as { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } } | null)?.vibrationActuator;
      if (!actuator?.playEffect) continue;
      Promise.resolve(actuator.playEffect('dual-rumble', {
        duration: ms, startDelay: 0, strongMagnitude: 0, weakMagnitude: 0.45,
      })).catch(() => {});
      break;   // one pad is enough; this is feedback, not a broadcast
    }
  } catch {
    /* no gamepad support here */
  }
}

/** The current controller state (WebHID-preferred, Gamepad-API fallback). */
export function getControllerState(): NormalizedControllerState | null {
  return resolver.getState();
}

export function isControllerConnected(): boolean {
  return !!device;
}

/** Subscribe to connect/disconnect status; fires immediately with current state. */
export function onControllerStatus(cb: (s: ControllerStatus) => void): () => void {
  statusListeners.add(cb);
  cb(status());
  return () => { statusListeners.delete(cb); };
}

/** User-gesture entry point: show the device chooser and open the pick. */
export async function connectController(): Promise<boolean> {
  const hid = (navigator as any).hid;
  if (!hid) throw new Error('WebHID未対応（mac/Chromeが必要）');
  const devices = await hid.requestDevice({
    filters: [
      { usagePage: 0x01, usage: 0x05 }, // Game Pad
      { usagePage: 0x01, usage: 0x04 }, // Joystick
    ],
  });
  return openDevice(devices && devices[0]);
}

async function autoReconnect(): Promise<void> {
  const hid = (navigator as any).hid;
  if (!hid) return;
  try {
    const devices: AnyHidDevice[] = await hid.getDevices();
    let gp: AnyHidDevice = null;
    for (const d of devices || []) { if (isHidGamepad(d)) { gp = d; break; } }
    if (!gp && devices && devices.length) gp = devices[0];
    if (gp) await openDevice(gp);
  } catch {
    /* no granted device yet */
  }
}

// Controller frames relayed by the MyWant extension (webext/bridge.js forwards
// them from the background worker, which is the single WebHID owner — a device
// can only be opened by one context, so when the extension holds it the
// dashboard can't, and reads these relayed frames instead). Feeding the same
// resolver means getControllerState() transparently uses whichever source is
// live: the extension relay, this hub's own WebHID, or the Gamepad API.
window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window) return;
  const m = e.data;
  if (m && m.source === 'mywant-ext' && m.type === 'MYWANT_HID_FRAME') {
    resolver.setHidFrame({ buttons: m.buttons || [], axes: m.axes || [] });
  }
});

// Wire disconnect handling + auto-reconnect once at module load (dashboard page).
// This hub only opens the device itself when no extension is relaying frames —
// if the extension already holds it, open() fails (busy) and we simply rely on
// the relay above.
(() => {
  const hid = (navigator as any).hid;
  if (!hid) return;
  hid.addEventListener?.('disconnect', (e: any) => {
    // The resolver's frame naturally goes stale (>400ms) after reports stop,
    // so getControllerState() falls back to the Gamepad API on its own.
    if (e.device === device) { device = null; notify(); }
  });
  autoReconnect();
})();
