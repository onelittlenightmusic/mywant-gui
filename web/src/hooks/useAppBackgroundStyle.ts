import React from 'react';
import { useDisplaySettings } from './useDisplaySettings';

/**
 * The background image, which belongs to whoever is looking at the app.
 *
 * It used to prefer a dynamic_background want's own picture, painted over
 * every page for everybody — a shared background, which is the thing that was
 * taken out for belonging to nobody and standing in for pictures that belong
 * to people. That want names a character now and writes to them, so its
 * picture still arrives here: by way of the person who was given it.
 */
export function useAppBackgroundUrl(): string | undefined {
  return useDisplaySettings().canvas_bg_url || undefined;
}

/**
 * Common background style for a page's root/scroll container — spread it onto
 * the element that already carries the opaque `bg-gray-50 dark:bg-gray-950`
 * surface so the image covers it (falling back to that color when unset).
 * Returns undefined when no background image is configured.
 */
export function useAppBackgroundStyle(): React.CSSProperties | undefined {
  const url = useAppBackgroundUrl();
  return url
    ? {
        backgroundImage: `url(${url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        // Size/anchor the image to the VIEWPORT, not the element. Pages whose
        // content box is narrower than the viewport (e.g. want-types/agents,
        // whose <main> is inset lg:mr-[480px] for the sidebar) would otherwise
        // scale `cover` into that narrower box and show the image zoomed in;
        // fixed attachment makes every page render it at the same scale/position.
        backgroundAttachment: 'fixed',
      }
    : undefined;
}
