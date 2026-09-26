/*
 * Build-time home-screen icon set — one PNG per built-in want category, each
 * with that category's real Lucide glyph on the category's gradient.
 *
 * The /w/<id> "one want as an app" page points its apple-touch-icon (and the
 * manifest icon) at /want-icons/<category>-<size>.png. iOS fetches that by URL
 * at "Add to Home Screen" time, so the icon must be a real static file — a
 * canvas/data: URI does not work there.
 *
 * The glyph paths come from lucide-static (the same icon set the app renders at
 * runtime); an SVG is composed per category and rasterised with the pure-wasm
 * @resvg/resvg-wasm, so there is no native dependency and no browser.
 *
 * Runs from web/package.json "build" before tsc/vite. Regenerate by hand with:
 *   node scripts/gen-want-icons.mjs
 *
 * Only the statically-known categories get their own glyph; anything else
 * (plugin categories, whose icon/colour only exist in the running backend) uses
 * "default". The generated key set is written to src/generated/wantIconKeys.ts
 * so the runtime code knows which categories have a file.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import iconNodes from 'lucide-static/icon-nodes.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_ICONS = join(HERE, '..', 'public', 'want-icons');
const OUT_KEYS = join(HERE, '..', 'src', 'generated', 'wantIconKeys.ts');
const SIZES = [180, 192, 512];

// Colour stops per category — the dark-theme category gradients from
// components/dashboard/WantTypeVisuals.ts (richer on a home screen than the
// pastel light set). [from, to] as #rrggbb.
const COLORS = {
  default:     ['#3b82f6', '#1e3a8a'],
  travel:      ['#0284c7', '#0c4a6e'],
  mathematics: ['#7c3aed', '#4c1d95'],
  math:        ['#7c3aed', '#4c1d95'],
  queue:       ['#059669', '#064e3b'],
  approval:    ['#d97706', '#92400e'],
  system:      ['#475569', '#1e293b'],
  transport:   ['#0e7490', '#083344'],
  tunnel:      ['#1d4ed8', '#1e3a8a'],
  effect:      ['#c026d3', '#701a75'],
  ui:          ['#4f46e5', '#312e81'],
  utility:     ['#0d9488', '#134e4a'],
  web:         ['#1d4ed8', '#1e3a8a'],
};

// Category → Lucide icon name, mirroring CATEGORY_ICON_NAME in WantTypeVisuals.ts
// (kebab-case as lucide-static ships it).
const ICON = {
  default:     'target',
  travel:      'plane',
  mathematics: 'calculator',
  math:        'calculator',
  queue:       'layers',
  approval:    'circle-check',
  system:      'monitor',
  transport:   'train-front',
  tunnel:      'globe',
  effect:      'sparkles',
  ui:          'panels-top-left',
  utility:     'cog',
  web:         'globe',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Serialise a lucide icon-node array ([[tag, attrs], …], 24×24 viewBox) to SVG.
const glyphMarkup = (name) => {
  const nodes = iconNodes[name];
  if (!nodes) throw new Error(`lucide-static has no icon "${name}"`);
  return nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${esc(v)}"`)
        .join(' ');
      return `<${tag} ${a} />`;
    })
    .join('');
};

const svgFor = (size, from, to, iconName) => {
  // Lucide is a 24u square centred on (12,12); scale it to ~54% of the icon.
  const k = (size * 0.54) / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${from}"/>
    <stop offset="1" stop-color="${to}"/>
  </linearGradient>
  <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="${size * 0.012}" stdDeviation="${size * 0.02}" flood-color="#0b1220" flood-opacity="0.30"/>
  </filter>
</defs>
<rect width="${size}" height="${size}" fill="url(#g)"/>
<g filter="url(#s)" transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(-12 -12)"
   fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${glyphMarkup(iconName)}
</g>
</svg>`;
};

const renderPng = (size, from, to, iconName) =>
  new Resvg(svgFor(size, from, to, iconName), { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();

// ── run ─────────────────────────────────────────────────────────────────────
const wasmDir = dirname(require.resolve('@resvg/resvg-wasm'));
await initWasm(readFileSync(join(wasmDir, 'index_bg.wasm')));

mkdirSync(OUT_ICONS, { recursive: true });
mkdirSync(dirname(OUT_KEYS), { recursive: true });

let count = 0;
for (const [key, [from, to]] of Object.entries(COLORS)) {
  const iconName = ICON[key] ?? ICON.default;
  for (const size of SIZES) {
    writeFileSync(join(OUT_ICONS, `${key}-${size}.png`), renderPng(size, from, to, iconName));
    count++;
  }
}

const keys = Object.keys(COLORS).sort();
writeFileSync(
  OUT_KEYS,
  `// AUTO-GENERATED by scripts/gen-want-icons.mjs — do not edit.\n` +
    `// The built-in want categories that have a /want-icons/<key>-<size>.png file.\n` +
    `export const WANT_ICON_KEYS: ReadonlySet<string> = new Set(${JSON.stringify(keys)});\n`,
);

console.log(`gen-want-icons: wrote ${count} PNGs for ${keys.length} keys → public/want-icons/`);
