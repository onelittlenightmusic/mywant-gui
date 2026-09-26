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
export function cursorManAvatarCircleMarkup(avatar: string, color: string, size: number): string {
  const fontSize = Math.round(size * 0.58);
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background-color:${color}33;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;line-height:1;filter:drop-shadow(0 0 6px ${color}99)">${avatar}</div>`;
}
