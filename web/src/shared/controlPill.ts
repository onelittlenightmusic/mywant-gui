/**
 * The global control pill's look — one source for every place it is drawn.
 *
 * The pill (status, pause, alert, news, and a place to talk) is drawn by the
 * GUI in its header (components/layout/GlobalControlPill.tsx) and by the
 * browser extension and the bookmarklet on every other page (mywant-guiex's
 * webext-src/pill.js, which bundles this file). They used to be kept looking
 * alike by hand, and every change was made twice. Now both draw the same
 * elements with the same classes (mwp-*), from this stylesheet, these icons
 * and these words; each keeps only what is its own — where the pill sits, how
 * it opens on a phone, what pressing a cell does.
 *
 * The overlay design a person picks reaches the pill as values (the design's
 * portable half, stored with the choice on their character): controlPillVars
 * turns them into custom properties, which the host sets on the pill.
 *
 * Framework-free on purpose: no React, no app imports — the extension bundles
 * it as a plain script.
 */

// ── Icons ────────────────────────────────────────────────────────────────────

/** Lucide paths (24×24, stroked) — the same drawing in every host. */
const ICONS = {
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  paused: '<path d="M10 15V9"/><path d="M14 15V9"/><path d="M7.714 2h8.572L22 7.714v8.572L16.286 22H7.714L2 16.286V7.714L7.714 2z"/>',
  pause: '<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  // LogIn, mirrored: an arrow going left, into a doorway on the left.
  warp: '<g transform="translate(24 0) scale(-1 1)"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></g>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  talk: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
} as const;

export type ControlPillIcon = keyof typeof ICONS;

/** An icon as markup, sized by the stylesheet (.mwp-icon svg). */
export function controlPillIcon(name: ControlPillIcon): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
}

// ── Words ────────────────────────────────────────────────────────────────────

export const CONTROL_PILL_LABELS = {
  running: 'Running',
  paused: 'Paused',
  unknown: '—',
  pause: 'Pause',
  play: 'Play',
  alert: 'Alert',
  news: 'News',
  warp: 'Warp',
  save: 'Save',
  ask: 'Ask',
  // A web want's page, framed (the want card's bar) or on its own page.
  browse: 'Browse',
  canvas: 'Canvas',
  zoom: 'Zoom',
  reload: 'Reload',
  open: 'Open',
} as const;

// ── Design ───────────────────────────────────────────────────────────────────

/**
 * What of an overlay design the pill reads — its portable values (see
 * components/overlay/design.ts's OverlayPortableStyle), structurally, so this
 * file needs nothing from the app.
 */
export interface ControlPillDesignValues {
  tones?: Partial<Record<'confirm' | 'caution' | 'info' | string, string>>;
  cellRadius?: number;
  cellGap?: number;
  labelTransform?: string;
  labelWeight?: number;
}

/**
 * The design as custom properties for the pill element.
 *
 * With a gap between cells the buttons are shapes of their own: a faint
 * ground each, no hairlines between them, and the pill's own round at its two
 * ends. Without one they are segments of one bar, divided by hairlines and
 * clipped by the pill.
 */
export function controlPillVars(d: ControlPillDesignValues | null | undefined): Record<string, string> {
  const v: Record<string, string> = {};
  if (!d) return v;
  const tones = d.tones ?? {};
  for (const t of ['confirm', 'caution', 'info']) {
    const c = tones[t];
    if (typeof c === 'string' && c) v[`--mwp-${t}`] = cssValue(c);
  }
  const gap = typeof d.cellGap === 'number' ? d.cellGap : 0;
  if (typeof d.cellRadius === 'number') v['--mwp-cell-radius'] = `${d.cellRadius}px`;
  if (gap > 0) {
    v['--mwp-gap'] = `${gap}px`;
    v['--mwp-divider-width'] = '0px';
    v['--mwp-cell-fill'] = 'rgba(148,163,184,.16)';
    v['--mwp-end-radius'] = '9999px';
  }
  if (typeof d.labelTransform === 'string' && d.labelTransform) v['--mwp-label-transform'] = cssValue(d.labelTransform);
  if (typeof d.labelWeight === 'number') v['--mwp-label-weight'] = String(d.labelWeight);
  return v;
}

/** A value from someone's display lands in a stylesheet: nothing that could end the declaration. */
function cssValue(s: string): string {
  return s.replace(/[;{}<>\\]/g, '');
}

// ── The stylesheet ───────────────────────────────────────────────────────────

/**
 * The pill's stylesheet. Every rule is scoped to mwp-* classes, so it can sit
 * in the app's document or inside a shadow root on somebody else's page.
 *
 * The pill's size and position are the host's (a header cell, a floating bar);
 * this is everything about how it looks.
 */
export function controlPillCss(): string {
  return [
    // Light by default; .mwp-dark on the pill (the app's dark mode, or the
    // viewer's colour mode on another page) turns it.
    // .mwp-theme carries the same colours for a host's own pieces beside the
    // pill (a field that opens next to it, an answer shown under it).
    '.mwp-pill, .mwp-theme { --mwp-surface:#ffffff; --mwp-outline:#d1d5db; --mwp-ink:#374151; --mwp-muted:#9ca3af; --mwp-hover:#f3f4f6; --mwp-divider:#e5e7eb; --mwp-running:#059669; }',
    '.mwp-pill.mwp-dark, .mwp-theme.mwp-dark { --mwp-surface:#1f2937; --mwp-outline:#374151; --mwp-ink:#e5e7eb; --mwp-muted:#6b7280; --mwp-hover:#374151; --mwp-divider:#374151; --mwp-running:#34d399; }',
    '.mwp-pill { box-sizing:border-box; border-radius:9999px; overflow:hidden; background:var(--mwp-surface); color:var(--mwp-ink); ' +
      'border:1px solid var(--mwp-outline); box-shadow:0 1px 2px rgba(0,0,0,.08); font:12px system-ui,-apple-system,sans-serif; }',
    '.mwp-pill.mwp-paused { border-color:var(--mwp-caution, #f59e0b); }',
    '.mwp-row, .mwp-group { display:flex; align-items:stretch; height:100%; gap:var(--mwp-gap, 0px); }',
    '.mwp-row { width:max-content; box-sizing:border-box; padding:var(--mwp-gap, 0px); }',
    '.mwp-cell { position:relative; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; ' +
      'min-width:52px; height:100%; padding:0 8px; margin:0; border:none; border-radius:var(--mwp-cell-radius, 0px); ' +
      'background:var(--mwp-cell-fill, transparent); color:inherit; font:inherit; cursor:pointer; transition:background-color .15s ease, filter .15s ease; }',
    '.mwp-divided { border-left:var(--mwp-divider-width, 1px) solid var(--mwp-divider); }',
    'button.mwp-cell:hover:not(:disabled) { background:var(--mwp-hover); }',
    'button.mwp-cell:disabled { opacity:.5; cursor:default; }',
    // The pill's own round at its two ends, for separate buttons.
    '.mwp-start { border-top-left-radius:var(--mwp-end-radius, var(--mwp-cell-radius, 0px)); border-bottom-left-radius:var(--mwp-end-radius, var(--mwp-cell-radius, 0px)); }',
    '.mwp-end { border-top-right-radius:var(--mwp-end-radius, var(--mwp-cell-radius, 0px)); border-bottom-right-radius:var(--mwp-end-radius, var(--mwp-cell-radius, 0px)); }',
    '.mwp-icon { display:flex; } .mwp-icon svg { width:24px; height:24px; display:block; }',
    '.mwp-label { font-size:9px; font-weight:var(--mwp-label-weight, 700); line-height:1; ' +
      'text-transform:var(--mwp-label-transform, uppercase); letter-spacing:-0.02em; white-space:nowrap; }',
    // Status: a sign, green and breathing while things run.
    '.mwp-status { color:var(--mwp-running); cursor:default; padding-left:14px; }',
    '.mwp-status.is-unknown { color:var(--mwp-muted); }',
    '.mwp-status.is-paused { background:var(--mwp-caution, #d97706); color:#fff; }',
    // Something needs a person: the sign itself turns, so a folded or shrunk
    // pill still says so — and green keeps meaning "nothing needs you".
    '.mwp-status.is-called:not(.is-paused):not(.is-unknown) { color:var(--mwp-caution, #d97706); }',
    '.mwp-status:not(.is-paused):not(.is-unknown) .mwp-icon svg { animation:mwp-pulse 2s cubic-bezier(.4,0,.6,1) infinite; }',
    // Tones, as the overlay design has them.
    '.mwp-toggle.is-paused { background:var(--mwp-confirm, rgba(5,150,105,.9)); color:#fff; }',
    '.mwp-alert { background:var(--mwp-caution, #d97706); color:#fff; }',
    '.mwp-alert .mwp-icon svg { border-radius:6px; animation:mwp-blink 1.6s ease-in-out infinite; }',
    '.mwp-count { position:absolute; top:3px; right:4px; min-width:16px; height:16px; padding:0 4px; border-radius:9999px; background:#dc2626; color:#fff; ' +
      'font:700 10px/16px system-ui,-apple-system,sans-serif; text-align:center; box-sizing:border-box; }',
    'button.mwp-toggle.is-paused:hover:not(:disabled), button.mwp-alert:hover:not(:disabled), button.mwp-save:hover:not(:disabled) { filter:brightness(1.08); }',
    'button.mwp-toggle.is-paused:hover:not(:disabled) { background:var(--mwp-confirm, rgba(5,150,105,.9)); }',
    'button.mwp-alert:hover:not(:disabled) { background:var(--mwp-caution, #d97706); }',
    // The attention dot, in the viewer's colour (--mwp-dot).
    '.mwp-dot { position:absolute; top:6px; right:10px; width:8px; height:8px; border-radius:9999px; background:var(--mwp-dot, #ef4444); box-shadow:0 0 0 2px var(--mwp-surface); }',
    // Warp home: half as wide again, first on a page that is not mywant.
    '.mwp-warp { min-width:78px; } .mwp-warp .mwp-icon svg { width:26px; height:26px; }',
    // Save this page: what the pill is for elsewhere, so the biggest and filled.
    '.mwp-save { min-width:104px; flex-direction:row; gap:8px; background:var(--mwp-info, rgba(14,165,233,.9)); color:#fff; font-weight:800; }',
    'button.mwp-save:hover:not(:disabled) { background:var(--mwp-info, rgba(14,165,233,.9)); }',
    '.mwp-save .mwp-label { font-size:12px; letter-spacing:.04em; }',
    '.mwp-save.is-invite .mwp-icon svg { border-radius:6px; animation:mwp-blink 1.6s ease-in-out infinite; }',
    '.mwp-save.is-on { box-shadow:inset 0 2px 6px rgba(0,0,0,.35); filter:brightness(.85); }',
    // The talking cell: whatever the host puts in it, on the cell's ground.
    '.mwp-talk { display:flex; align-items:center; gap:6px; padding:0 8px; border-radius:var(--mwp-cell-radius, 0px); background:var(--mwp-cell-fill, transparent); }',
    // Where the keys or the controller's cursor are.
    '.mwp-focus { box-shadow:inset 0 0 0 3px #38bdf8 !important; }',
    '@keyframes mwp-pulse { 50% { opacity:.5; } }',
    '@keyframes mwp-blink { 0%,100% { box-shadow:0 0 0 0 rgba(56,189,248,0); opacity:1; } 50% { box-shadow:0 0 0 6px rgba(56,189,248,.35); opacity:.75; } }',
    '@media (prefers-reduced-motion: reduce) { .mwp-icon svg { animation:none !important; } }',
    // A phone: narrower cells, icons only.
    '@media (max-width: 639px) { .mwp-cell { min-width:40px; padding:0 4px; } .mwp-label { display:none; } .mwp-icon svg { width:20px; height:20px; } ' +
      '.mwp-status { padding-left:0; } .mwp-save { min-width:80px; } .mwp-save .mwp-label { display:inline; } }',
  ].join('\n');
}

/** Put the stylesheet into a document (or a shadow root) once. */
export function ensureControlPillCss(root: Document | ShadowRoot = document): void {
  const id = 'mwp-control-pill-css';
  const doc = root instanceof Document ? root : root.ownerDocument;
  if ((root as Document | ShadowRoot).querySelector?.(`#${id}`)) return;
  const style = doc.createElement('style');
  style.id = id;
  style.textContent = controlPillCss();
  (root instanceof Document ? root.head : root).appendChild(style);
}
