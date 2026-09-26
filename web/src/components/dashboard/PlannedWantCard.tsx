/**
 * PlannedWantCard — a "ghost" card representing a planner-derived want
 * that has NOT been deployed yet (pending plan approval).
 *
 * Displayed in the balloon with a dashed border and muted colours to
 * distinguish it clearly from real deployed want cards.
 */
import React, { useEffect, useState } from 'react';
import { classNames } from '@/utils/helpers';
import { ZONE_PALETTES } from './WantZoneLayout';

export type PlannerRole = 'monitor' | 'intermediate' | 'terminal';

export interface PlannedStep {
  wantType: string;
  role: PlannerRole;
  confidence: 'certain' | 'inferred' | 'unknown';
  reasoning: string;
  providedBy?: string;
}

interface PlannedWantCardProps {
  step: PlannedStep;
  /** 0-based index used for staggered animation delay */
  animationIndex: number;
  visible: boolean;
}

const ROLE_TO_CHILD_ROLE: Record<PlannerRole, 'monitor' | 'thinker' | 'doer'> = {
  monitor:      'monitor',
  intermediate: 'thinker',
  terminal:     'doer',
};

const CONFIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  certain:  { label: 'certain',  className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  inferred: { label: 'inferred', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  unknown:  { label: 'unknown',  className: 'bg-red-100   text-red-700   dark:bg-red-900/40   dark:text-red-300'   },
};

export const PlannedWantCard: React.FC<PlannedWantCardProps> = ({ step, animationIndex, visible }) => {
  const [shown, setShown] = useState(false);

  // Stagger entrance: each card fades in 200ms after the previous
  useEffect(() => {
    if (!visible) { setShown(false); return; }
    const timer = setTimeout(() => setShown(true), animationIndex * 220);
    return () => clearTimeout(timer);
  }, [visible, animationIndex]);

  const childRole = ROLE_TO_CHILD_ROLE[step.role];
  const palette = ZONE_PALETTES[childRole];
  const badge = CONFIDENCE_BADGE[step.confidence] ?? CONFIDENCE_BADGE.unknown;

  return (
    <div
      className={classNames(
        'relative rounded-md border-2 border-dashed p-3 min-h-[5rem]',
        'bg-white/30 dark:bg-gray-900/20 backdrop-blur-sm',
        'transition-all duration-400',
        palette.borderRest,
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}
      style={{ transitionDelay: shown ? '0ms' : `${animationIndex * 220}ms` }}
    >
      {/* Role tag */}
      <div
        aria-hidden
        className="absolute top-0 left-0 text-white rounded-tl-[4px] rounded-br-[6px]"
        style={{
          backgroundColor: palette.dogEarColor,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1,
          padding: '3px 6px', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}
      >
        {palette.label}
      </div>

      {/* Want type name */}
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-3 truncate">
        {step.wantType.replace(/_/g, ' ')}
      </p>

      {/* Reasoning */}
      {step.reasoning && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 italic">
          {step.reasoning}
        </p>
      )}

      {/* Confidence badge */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className={classNames('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider', badge.className)}>
          {badge.label}
        </span>
        {step.providedBy && (
          <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate">
            ← {step.providedBy.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Pending indicator */}
      <div className="absolute top-2 right-2 flex gap-0.5">
        {[0, 1, 2].map(i => (
          <div key={i} className={classNames('w-1 h-1 rounded-full', palette.borderRest.replace('border-', 'bg-'))}
            style={{ animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s`, opacity: 0.6 }} />
        ))}
      </div>
    </div>
  );
};
