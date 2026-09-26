// Framework-agnostic WebHID gamepad parsing + a controller-state resolver,
// shared by the mywant-gui dashboard (web/src/hooks/useInputActions.ts) and the
// browser extension (webext/webext-src/background.js reads the device; the
// injected overlays consume relayed frames). Target: mac/Chrome (WebHID is
// Chromium-only — Safari/Firefox fall back to the Gamepad API).
//
// The whole point of WebHID here is that it delivers input even when the tab
// isn't focused (unlike the Gamepad API), which is what lets the CursorMan be
// driven while it roams across background tabs. Reports are normalized to the
// SAME shape the Gamepad API's "standard mapping" produces — { buttons: bool[],
// axes: number[] } — so every existing consumer (BUTTON_MAP, cur[6],
// gp.axes[0], …) keeps working unchanged against either source.
//
// Parsing is generic (driven by the device's own HID report descriptor via
// device.collections), not model-specific: Generic Desktop axes + Hat switch +
// Button page. Exotic controllers may map buttons in a non-standard order —
// that's the accepted trade-off of "generic" (a per-model override can be added
// later). WebHID lib types aren't in the default TS DOM lib, so the WebHID
// boundary is typed loosely.

export interface NormalizedControllerState {
  buttons: boolean[];
  axes: number[];
}

// Minimal shapes of the HID descriptor fields we read (subset of the WebHID
// HIDCollectionInfo / HIDReportItem types).
interface HidReportItem {
  isConstant?: boolean;
  isRange?: boolean;
  usages?: number[];        // 32-bit (usagePage<<16 | usage) when isRange=false
  usageMinimum?: number;    // when isRange=true
  usageMaximum?: number;
  reportSize?: number;      // bits per field
  reportCount?: number;     // number of fields
  logicalMinimum?: number;
  logicalMaximum?: number;
}
interface HidReportInfo { reportId?: number; items?: HidReportItem[]; }
interface HidCollectionInfo {
  usagePage?: number;
  usage?: number;
  inputReports?: HidReportInfo[];
  children?: HidCollectionInfo[];
}

const USAGE_PAGE_GENERIC_DESKTOP = 0x01;
const USAGE_PAGE_BUTTON = 0x09;
// Generic Desktop usages
const U_X = 0x30, U_Y = 0x31, U_Z = 0x32, U_RX = 0x33, U_RY = 0x34, U_RZ = 0x35, U_HAT = 0x39;

/** True if any top-level collection declares itself a Joystick (0x04) or Game Pad (0x05). */
export function isHidGamepad(device: { collections?: HidCollectionInfo[] } | null | undefined): boolean {
  const cols = (device && device.collections) || [];
  for (let i = 0; i < cols.length; i++) {
    if (cols[i].usagePage === USAGE_PAGE_GENERIC_DESKTOP && (cols[i].usage === 0x04 || cols[i].usage === 0x05)) {
      return true;
    }
  }
  return false;
}

// Read `numBits` (LSB-first, little-endian bit stream — the HID report layout)
// starting at absolute bit offset `bitOffset` from a DataView.
function readBits(view: DataView, bitOffset: number, numBits: number): number {
  let value = 0;
  for (let i = 0; i < numBits; i++) {
    const bit = bitOffset + i;
    const byteIndex = bit >> 3;
    if (byteIndex >= view.byteLength) break;
    const bitVal = (view.getUint8(byteIndex) >> (bit & 7)) & 1;
    value |= bitVal << i;
  }
  return value;
}

// Map [logMin, logMax] → [-1, 1]; center rests at 0. (Sticks are typically
// 0..255, so 128 → ~0.)
function normAxis(raw: number, logMin: number, logMax: number): number {
  if (logMax === logMin) return 0;
  const t = (raw - logMin) / (logMax - logMin);
  return Math.max(-1, Math.min(1, t * 2 - 1));
}

// 8-direction hat (0=up, clockwise) → D-pad up/down/left/right booleans.
const HAT_DIRS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 0, 0, 0], [1, 0, 0, 1], [0, 0, 0, 1], [0, 1, 0, 1],
  [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [1, 0, 1, 0],
];

function collectInputItems(collections: HidCollectionInfo[], reportId: number): HidReportItem[] {
  const items: HidReportItem[] = [];
  function walk(cols: HidCollectionInfo[]) {
    for (const c of cols) {
      for (const rep of c.inputReports || []) {
        if ((rep.reportId || 0) === reportId) {
          for (const it of rep.items || []) items.push(it);
        }
      }
      if (c.children) walk(c.children);
    }
  }
  walk(collections);
  return items;
}

// Nintendo Switch controller "standard full" input report (0x30). dataView
// excludes the reportId byte, so byte 0 here = timer. Layout (Nintendo's own,
// not standard HID): [2] right buttons, [3] shared buttons, [4] left buttons,
// [5..7] left stick (packed 12-bit x/y), [8..10] right stick. Mapped to the
// Gamepad-API standard button/axis order so the rest of the app is unchanged.
export function parseNintendoStandardFullReport(d: DataView): NormalizedControllerState {
  const b = (byte: number, bit: number) => (d.getUint8(byte) >> bit & 1) === 1;
  const right = 2, shared = 3, left = 4; // byte indices (reportId already stripped)

  const buttons: boolean[] = [];
  for (let i = 0; i < 18; i++) buttons.push(false);
  // Face buttons → standard positions (0 bottom, 1 right, 2 left, 3 top).
  buttons[0] = b(right, 2);  // B (bottom)
  buttons[1] = b(right, 3);  // A (right)
  buttons[2] = b(right, 0);  // Y (left)
  buttons[3] = b(right, 1);  // X (top)
  buttons[4] = b(left, 6);   // L
  buttons[5] = b(right, 6);  // R
  buttons[6] = b(left, 7);   // ZL
  buttons[7] = b(right, 7);  // ZR
  buttons[8] = b(shared, 0); // Minus
  buttons[9] = b(shared, 1); // Plus
  buttons[10] = b(shared, 3); // L-stick press
  buttons[11] = b(shared, 2); // R-stick press
  buttons[12] = b(left, 1);  // D-pad Up
  buttons[13] = b(left, 0);  // D-pad Down
  buttons[14] = b(left, 3);  // D-pad Left
  buttons[15] = b(left, 2);  // D-pad Right
  buttons[16] = b(shared, 4); // Home
  buttons[17] = b(shared, 5); // Capture

  // Sticks: 12-bit x/y packed into 3 bytes each. Center ~2048; divide by ~1500
  // so a normal full tilt reaches ±1 despite per-unit calibration we don't read.
  const norm = (v: number) => Math.max(-1, Math.min(1, (v - 2048) / 1500));
  const lx = d.getUint8(5) | ((d.getUint8(6) & 0xf) << 8);
  const ly = (d.getUint8(6) >> 4) | (d.getUint8(7) << 4);
  const rx = d.getUint8(8) | ((d.getUint8(9) & 0xf) << 8);
  const ry = (d.getUint8(9) >> 4) | (d.getUint8(10) << 4);
  // Nintendo stick Y is up-positive; the Gamepad API is down-positive → invert.
  const axes = [norm(lx), -norm(ly), norm(rx), -norm(ry)];

  return { buttons, axes };
}

/**
 * Parse one input report into normalized controller state. `collections` is the
 * HIDDevice.collections descriptor; `reportId` and `dataView` come from the
 * WebHID `inputreport` event (dataView excludes the reportId prefix byte).
 * Returns null if the report has no recognizable gamepad fields.
 */
export function parseHidGamepadReport(
  collections: HidCollectionInfo[] | undefined,
  reportId: number,
  dataView: DataView,
): NormalizedControllerState | null {
  // Nintendo Switch controllers (Pro Controller / Joy-Con) in "standard full"
  // mode send a vendor-defined 0x30 report the generic HID parser can't read
  // (its fields are declared under a vendor usage page). Decode it explicitly
  // into the standard mapping. reportId 0x30 is Nintendo-specific, so this is a
  // safe special case.
  if (reportId === 0x30 && dataView.byteLength >= 11) {
    return parseNintendoStandardFullReport(dataView);
  }

  if (!collections) return null;
  const items = collectInputItems(collections, reportId || 0);
  if (!items.length) return null;

  const buttons: boolean[] = [];
  const axes: number[] = [0, 0, 0, 0];
  const axisSet = [false, false, false, false];
  let matched = false;
  let bitOffset = 0;

  const setButton = (idx: number, on: boolean) => {
    if (idx < 0) return;
    while (buttons.length <= idx) buttons.push(false);
    if (on) buttons[idx] = true;
  };
  const setAxis = (idx: number, val: number, force: boolean) => {
    if (idx < 0 || idx > 3) return;
    if (!axisSet[idx] || force) { axes[idx] = val; axisSet[idx] = true; }
  };

  for (const item of items) {
    const size = item.reportSize || 0;
    const count = item.reportCount || 0;
    const logMin = item.logicalMinimum ?? 0;
    const logMax = item.logicalMaximum ?? 0;

    for (let k = 0; k < count; k++) {
      const fieldOffset = bitOffset + k * size;
      if (item.isConstant) continue; // padding — offset still advances (below)

      // Resolve this field's 32-bit usage.
      let usage32: number;
      if (item.isRange) {
        usage32 = (item.usageMinimum ?? 0) + k;
      } else {
        const u = item.usages || [];
        usage32 = u.length ? (k < u.length ? u[k] : u[u.length - 1]) : 0;
      }
      const usagePage = (usage32 >> 16) & 0xffff;
      const usage = usage32 & 0xffff;

      if (usagePage === USAGE_PAGE_BUTTON) {
        // HID buttons are 1-based; map button N → buttons[N-1].
        setButton(usage - 1, readBits(dataView, fieldOffset, size) !== 0);
        matched = true;
      } else if (usagePage === USAGE_PAGE_GENERIC_DESKTOP) {
        const raw = readBits(dataView, fieldOffset, size);
        if (usage === U_HAT) {
          let v = raw - logMin;
          if (v >= 0 && v < 8) {
            const [up, dn, lf, rt] = HAT_DIRS[v];
            if (up) setButton(12, true);
            if (dn) setButton(13, true);
            if (lf) setButton(14, true);
            if (rt) setButton(15, true);
          }
          // ensure dpad slots exist even when centered
          setButton(15, buttons[15] === true);
          matched = true;
        } else {
          const norm = normAxis(raw, logMin, logMax);
          if (usage === U_X) { setAxis(0, norm, true); matched = true; }
          else if (usage === U_Y) { setAxis(1, norm, true); matched = true; }
          else if (usage === U_Z) { setAxis(2, norm, true); matched = true; }
          else if (usage === U_RZ) { setAxis(3, norm, true); matched = true; }
          else if (usage === U_RX) { setAxis(2, norm, false); matched = true; } // fallback for right-stick X
          else if (usage === U_RY) { setAxis(3, norm, false); matched = true; } // fallback for right-stick Y
        }
      }
    }
    bitOffset += size * count;
  }

  if (!matched) return null;
  // Pad to the standard-mapping length so BUTTON_MAP's fixed indices are safe.
  while (buttons.length < 17) buttons.push(false);
  return { buttons, axes };
}

// ── Controller-state resolver ────────────────────────────────────────────────

export interface ControllerResolver {
  /** Feed a freshly-parsed WebHID frame (also stamps it "now"). */
  setHidFrame: (frame: NormalizedControllerState) => void;
  /** Latest state: the WebHID frame if recent, else the Gamepad API fallback. */
  getState: () => NormalizedControllerState | null;
  /** True when a WebHID frame arrived within the freshness window. */
  hasFreshHid: () => boolean;
}

const HID_FRESH_MS = 400; // a WebHID frame this recent wins over the Gamepad API

/**
 * WebHID-preferred, Gamepad-API-fallback resolver. `getGamepads` is injected so
 * the module stays portable (a service worker has no navigator.getGamepads;
 * pass a no-op there — it only ever relays, never resolves).
 */
export function makeControllerResolver(
  getGamepads: () => (Gamepad | null)[] | null | undefined,
): ControllerResolver {
  let hidFrame: NormalizedControllerState | null = null;
  let hidAt = 0;

  return {
    setHidFrame(frame) { hidFrame = frame; hidAt = Date.now(); },
    hasFreshHid() { return !!hidFrame && Date.now() - hidAt < HID_FRESH_MS; },
    getState() {
      if (hidFrame && Date.now() - hidAt < HID_FRESH_MS) return hidFrame;
      const pads = getGamepads ? getGamepads() : null;
      if (pads) {
        for (let i = 0; i < pads.length; i++) {
          const p = pads[i];
          if (p) return { buttons: p.buttons.map(b => b.pressed), axes: p.axes.slice() };
        }
      }
      return null;
    },
  };
}
