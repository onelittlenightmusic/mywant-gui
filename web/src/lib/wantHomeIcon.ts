/*
 * Render one want's home-screen icon in the browser — the same glyph the board
 * tile shows for it (live type/category-icon labels, brand marks, the viewer's
 * icon font), composited on the category gradient — and hand the PNG to the
 * server cache so the /w/<id> apple-touch-icon can point at a stable URL.
 *
 * This is the runtime counterpart to scripts/gen-want-icons.mjs: the build-time
 * set only knows the static per-category icons, so it is the fallback until an
 * upload from here lands.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveWantIcon, getCategoryBgDark } from '@/components/dashboard/WantTypeVisuals';
import type { IconFont } from '@/hooks/useDisplaySettings';

const DEFAULT_STOPS: [string, string] = ['#3b82f6', '#1e3a8a'];

/** First two #rrggbb in a CSS gradient string, or the app's default pair. */
function gradientStops(css: string | undefined): [string, string] {
  const found = css?.match(/#[0-9a-fA-F]{6}/g);
  if (found && found.length >= 2) return [found[0], found[1]];
  if (found && found.length === 1) return [found[0], found[0]];
  return DEFAULT_STOPS;
}

export interface WantHomeIconInput {
  typeName: string;
  category: string;
  isRecipeBased: boolean;
  iconFont: IconFont;
  size: number;
}

/** Compose the full icon SVG (gradient + centred glyph + soft shadow). */
function iconSvg({ typeName, category, isRecipeBased, iconFont, size }: WantHomeIconInput): string {
  const Icon = resolveWantIcon(typeName, category, isRecipeBased, iconFont);
  const strokeWidth = iconFont === 'lucide-thin' ? 1 : undefined;

  // The icon component renders its own <svg viewBox="0 0 24 24">; give it a
  // white currentColor (covers lucide's stroke and the brand marks' fill) and
  // place it as a nested <svg> at ~54% of the canvas, centred.
  const glyphPx = Math.round(size * 0.54);
  const offset = Math.round((size - glyphPx) / 2);
  let glyph = renderToStaticMarkup(
    createElement(Icon, {
      width: glyphPx,
      height: glyphPx,
      strokeWidth,
      style: { color: '#ffffff' },
    }),
  );
  glyph = glyph.replace('<svg ', `<svg x="${offset}" y="${offset}" `);

  const [c1, c2] = gradientStops(getCategoryBgDark(category));
  const dy = (size * 0.012).toFixed(2);
  const blur = (size * 0.02).toFixed(2);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient>` +
    `<filter id="s" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="0" dy="${dy}" stdDeviation="${blur}" flood-color="#0b1220" flood-opacity="0.3"/>` +
    `</filter>` +
    `</defs>` +
    `<rect width="${size}" height="${size}" fill="url(#g)"/>` +
    `<g filter="url(#s)">${glyph}</g>` +
    `</svg>`
  );
}

/** Rasterise the composed SVG to a PNG Blob at `size`×`size`. */
export async function renderWantHomeIconPng(input: WantHomeIconInput): Promise<Blob> {
  const svg = iconSvg(input);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();

  const canvas = document.createElement('canvas');
  canvas.width = input.size;
  canvas.height = input.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, input.size, input.size);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png',
    );
  });
}

/** PUT the PNG to the server's per-want icon cache. */
export async function uploadWantHomeIcon(id: string, size: number, blob: Blob): Promise<void> {
  const res = await fetch(`/w-home-icon/${encodeURIComponent(id)}?size=${size}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}
