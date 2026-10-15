// Plain, framework-agnostic markup for the CursorMan indicator — the single
// source of truth for both web/src/components/dashboard/CursorManIcon.tsx
// (React, via dangerouslySetInnerHTML) and webext/cursorOverlayCore.ts
// (the extension's and the bookmarklet's CursorMan, via build-time source
// embedding — see webext/build-cursor-overlay-src.js). Only the shape/content is shared; each
// consumer's own outer wrapper (size, glow/drop-shadow style, etc.) stays
// where it is.

/** Inner shapes of the default (no character bound) stick-figure SVG. */
export function cursorManStickFigureInnerSvgMarkup(color: string): string {
  return `
    <circle cx="12" cy="5" r="3.5" fill="${color}" />
    <rect x="8.5" y="9.5" width="7" height="7" rx="1" fill="${color}" />
    <line x1="8.5" y1="11" x2="5" y2="15" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
    <line x1="15.5" y1="11" x2="19" y2="15" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
    <line x1="10" y1="16.5" x2="8" y2="22" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
    <line x1="14" y1="16.5" x2="16" y2="22" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />
    <ellipse cx="12" cy="23.5" rx="4" ry="1.5" fill="rgba(0,0,0,0.25)" />
  `;
}

/**
 * Full standalone markup for the character-emoji-in-colored-circle variant
 * (used when a character is bound to the cursor instead of the default
 * stick figure). Self-contained (no outer wrapper needed from callers).
 *
 * A circle, always. The app itself draws a character in the shape that
 * character chose (CharacterBadge, shared/characterShapes.ts); the overlays
 * this markup serves are given an avatar, a colour and a size by their
 * config and have no character record to read a shape from. Keeping the shape
 * catalogue out of here is also what keeps this function spliceable: it is
 * embedded in the extension as its own source text and cannot call into
 * another module (see webext/build-shared-visuals.js).
 */
/**
 * A character as the board draws them (CharacterBadge): their outline (a path in
 * the shape catalogue's 100x100 box, shared/characterShapes) filled flat in
 * their colour, with their picture inside it — the same outline drawn in a
 * little, so a rim of the colour shows — or their emoji over the middle. For
 * the overlays, which have no React to draw the badge with; self-contained for
 * the same reason as the circle below.
 */
export function cursorManBadgeMarkup(avatar: string, color: string, size: number, shapePath: string, image?: string): string {
  const okImage = !!image && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image);
  const okPath = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/.test(shapePath) ? shapePath : 'M4 50 A46 46 0 1 0 96 50 A46 46 0 1 0 4 50 Z';
  const clip = 'mwc-shape-' + Math.random().toString(36).slice(2, 10);
  const stroke = (2.5 * 100) / size;
  const glyph = Math.round(size * 0.56);
  return `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 6px ${color}99)">`
    + `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="position:absolute;inset:0;overflow:visible;pointer-events:none" aria-hidden="true">`
    + `<path d="${okPath}" fill="${color}" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round"/>`
    + (okImage
      ? `<clipPath id="${clip}"><path d="${okPath}" transform="translate(9 9) scale(0.82)"/></clipPath>`
        + `<image href="${image}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/>`
      : '')
    + `</svg>`
    + (okImage ? '' : `<span style="position:relative;font-size:${glyph}px;line-height:1;pointer-events:none">${avatar}</span>`)
    + `</div>`;
}

export function cursorManAvatarCircleMarkup(avatar: string, color: string, size: number, image?: string): string {
  // The person's picture (Character.avatarImage), when they have one, in place
  // of the emoji: filling the circle inside its rim of their colour.
  if (image && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;background-color:${color};border:2px solid ${color};overflow:hidden;filter:drop-shadow(0 0 6px ${color}99)"><img src="${image}" alt="" draggable="false" style="display:block;width:100%;height:100%;border-radius:50%;object-fit:cover"></div>`;
  }
  const fontSize = Math.round(size * 0.58);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background-color:${color}33;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;line-height:1;filter:drop-shadow(0 0 6px ${color}99)">${avatar}</div>`;
}
