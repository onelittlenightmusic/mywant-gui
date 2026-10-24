import type { ImpactKind } from '@/stores/impactStore';
import type { ImpactEffect } from '../effect';
import { attackImpact } from './attack';
import { mendImpact } from './mend';
import { freezeImpact } from './freeze';
import { feedImpact } from './feed';

/** Every kind's look — one file each. A new kind is a file here and a line below. */
export const IMPACT_EFFECTS: Record<ImpactKind, ImpactEffect> = {
  attack: attackImpact,
  mend: mendImpact,
  freeze: freezeImpact,
  feed: feedImpact,
};
