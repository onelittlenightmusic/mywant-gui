import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Resolves a Lucide icon name (e.g. "Building2") — as stored in the engine's
 * datatypes.yaml — to its React component. Returns null when the name is
 * unknown.
 *
 * Looked up off the namespace rather than a hand-written allow-list. The
 * allow-list this replaced was there to keep named imports tree-shakeable, but
 * several callers already resolve icons dynamically off the same namespace, so
 * the whole set ships either way and the list bought nothing — it only meant a
 * data type whose icon was missing from it silently fell back to the `Type` T,
 * which reads as "the type failed to resolve" when only its icon did.
 *
 * Note: Lucide icons are React.forwardRef components, so typeof === 'object',
 * not 'function'. Both are accepted to be safe.
 */
export function resolveLucideIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  const icon = (LucideIcons as Record<string, unknown>)[name];
  if (!icon) return null;
  if (typeof icon === 'function' || typeof icon === 'object') return icon as LucideIcon;
  return null;
}
