/**
 * The open slot a GUI extension keeps its own values in — the `ext` field of
 * the config, the gui_state want and a character's display.
 *
 * The same rules as the engine's package ext: the first level is the
 * extension's name (ext.canvas.dpad), the engine stores and merges what is
 * under it without reading it, and a write is a JSON Merge Patch — name only
 * what changes, nested objects merge, null removes. So an extension adds a
 * setting without anybody changing mywant, and two windows each writing their
 * own corner never overwrite each other.
 */

export type Ext = Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** The value at a path, or undefined when any step is missing. */
export function getExt(ext: unknown, ...path: string[]): unknown {
  let cur: unknown = ext;
  for (const k of path) {
    if (!isObject(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

/** RFC 7396: patch applied to target, neither modified. */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isObject(patch)) return patch;
  const out: Record<string, unknown> = isObject(target) ? { ...target } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = mergePatch(out[k], v);
  }
  return out;
}

/** A patch that sets one value at a path — `{ canvas: { dpad: true } }`. */
export function extPatch(value: unknown, ...path: string[]): Ext {
  const root: Ext = {};
  let cur = root;
  path.forEach((k, i) => {
    if (i === path.length - 1) { cur[k] = value; return; }
    const next: Ext = {};
    cur[k] = next;
    cur = next;
  });
  return root;
}

/**
 * Every leaf of an ext value as a dotted path — `ext.canvas.chr-1.scale`.
 * For bookkeeping that works key by key (see stores/guiStateSync), so one
 * leaf pending does not hold the whole object back.
 */
export function extLeaves(value: unknown, prefix: string): Array<[string, unknown]> {
  if (!isObject(value)) return [[prefix, value]];
  return Object.entries(value).flatMap(([k, v]) => extLeaves(v, `${prefix}.${k}`));
}

/**
 * Two patches as one, b after a. Unlike mergePatch a null is kept — it is an
 * instruction the server still has to receive.
 */
export function combinePatches(a: unknown, b: unknown): unknown {
  if (!isObject(a) || !isObject(b)) return b;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = combinePatches(out[k], v);
  return out;
}
