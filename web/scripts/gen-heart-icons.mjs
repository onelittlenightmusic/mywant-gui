/*
 * The app's own icon — the pink heart of public/favicon.svg — as the PNGs the
 * places that cannot take an SVG need:
 *
 *   webext/webext-src/icons/icon-<16|32|48|128>.png
 *     The browser extension's toolbar / extensions-page icon. MV3 manifests
 *     only take raster icons.
 *   web/public/heart-icons/heart-<180|512>.png
 *     apple-touch-icon for the bookmarklet install page. The bookmarklet is
 *     made by bookmarking that page and replacing its URL, so the icon the
 *     bookmark keeps is the one that page offers. iOS paints a transparent
 *     icon's background black, so this one sits on the app's dark background.
 *
 * Rasterised with @resvg/resvg-wasm like gen-want-icons.mjs. The outputs are
 * committed; regenerate by hand after changing favicon.svg:
 *   node scripts/gen-heart-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const FAVICON = join(HERE, '..', 'public', 'favicon.svg');
const OUT_WEBEXT = join(HERE, '..', '..', 'webext', 'webext-src', 'icons');
const OUT_TOUCH = join(HERE, '..', 'public', 'heart-icons');

const heart = readFileSync(FAVICON, 'utf8');
// The favicon's own drawing, reused inside a larger canvas for the tile.
const inner = heart.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// On a dark rounded-by-iOS square, the heart at about two thirds of it.
const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" fill="#111827"/>
  <g transform="translate(4 4.4) scale(0.6667)">${inner}</g>
</svg>`;

const png = (svg, size) =>
  new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

const wasmDir = dirname(require.resolve('@resvg/resvg-wasm'));
await initWasm(readFileSync(join(wasmDir, 'index_bg.wasm')));

mkdirSync(OUT_WEBEXT, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(OUT_WEBEXT, `icon-${size}.png`), png(heart, size));
}
mkdirSync(OUT_TOUCH, { recursive: true });
for (const size of [180, 512]) {
  writeFileSync(join(OUT_TOUCH, `heart-${size}.png`), png(tileSvg, size));
}
console.log('[gen-heart-icons] wrote', OUT_WEBEXT, 'and', OUT_TOUCH);
