/**
 * WantZoneLayout — flat sorted grid with dog-ear role indicators.
 *
 * Child wants are sorted monitor → thinker → doer → other.
 * Each card gets a triangular dog-ear in its top-left corner coloured by role.
 * Zone column headers/separators are intentionally removed.
 */
import React from 'react';
import { Eye, Lightbulb, Zap, Plus } from 'lucide-react';
import { Want } from '@/types/want';
import { ChildRole } from './ChildMiniTile';
import { GRID_COLUMN_WIDTH } from '@/utils/gridUtils';

// ─── Role metadata (kept for CanvasChildOverlay icon/colour access) ───────────

interface ZonePalette {
  icon: React.ElementType;
  label: string;
  titleColor: string;
  borderRest: string;
  borderDrop: string;
  bg: string;
  headerBg: string;
  emptyBorder: string;
  dropRing: string;
  dogEarColor: string;
}

export const ZONE_PALETTES: Record<ChildRole, ZonePalette> = {
  monitor: {
    icon: Eye,
    label: 'Satisfied?',
    titleColor: 'text-blue-500 dark:text-blue-400',
    borderRest: 'border-blue-200 dark:border-blue-800',
    borderDrop: 'border-blue-500 dark:border-blue-400',
    bg: 'bg-blue-50/60 dark:bg-blue-950/30',
    headerBg: 'bg-blue-100/80 dark:bg-blue-900/50',
    emptyBorder: 'border-blue-300 dark:border-blue-700',
    dropRing: 'ring-2 ring-blue-400/40',
    dogEarColor: '#3b82f6',
  },
  thinker: {
    icon: Lightbulb,
    label: 'Need what?',
    titleColor: 'text-purple-500 dark:text-purple-400',
    borderRest: 'border-purple-200 dark:border-purple-800',
    borderDrop: 'border-purple-500 dark:border-purple-400',
    bg: 'bg-purple-50/60 dark:bg-purple-950/30',
    headerBg: 'bg-purple-100/80 dark:bg-purple-900/50',
    emptyBorder: 'border-purple-300 dark:border-purple-700',
    dropRing: 'ring-2 ring-purple-400/40',
    dogEarColor: '#a855f7',
  },
  doer: {
    icon: Zap,
    label: 'How do I do?',
    titleColor: 'text-green-500 dark:text-green-400',
    borderRest: 'border-green-200 dark:border-green-800',
    borderDrop: 'border-green-500 dark:border-green-400',
    bg: 'bg-green-50/60 dark:bg-green-950/30',
    headerBg: 'bg-green-100/80 dark:bg-green-900/50',
    emptyBorder: 'border-green-300 dark:border-green-700',
    dropRing: 'ring-2 ring-green-400/40',
    dogEarColor: '#22c55e',
  },
  other: {
    icon: Plus,
    label: 'Other',
    titleColor: 'text-gray-500 dark:text-gray-400',
    borderRest: 'border-gray-200 dark:border-gray-700',
    borderDrop: 'border-gray-400 dark:border-gray-500',
    bg: 'bg-gray-50/60 dark:bg-gray-900/20',
    headerBg: 'bg-gray-100/80 dark:bg-gray-800/50',
    emptyBorder: 'border-gray-300 dark:border-gray-600',
    dropRing: 'ring-2 ring-gray-400/40',
    dogEarColor: '#9ca3af',
  },
};

// Render order: monitor → thinker → doer → other
const ROLE_ORDER: ChildRole[] = ['monitor', 'thinker', 'doer', 'other'];

// ─── Role tag component ───────────────────────────────────────────────────────

interface RoleTagProps {
  role: ChildRole;
  compact?: boolean;
}

const RoleTag: React.FC<RoleTagProps> = ({ role, compact }) => {
  const pal = ZONE_PALETTES[role];
  if (role === 'other') return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 20,
        backgroundColor: pal.dogEarColor,
        color: '#fff',
        fontSize: compact ? 8 : 9,
        fontWeight: 700,
        letterSpacing: '0.04em',
        lineHeight: 1,
        padding: compact ? '2px 5px' : '3px 6px',
        borderTopLeftRadius: 6,
        borderBottomRightRadius: 6,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {pal.label}
    </div>
  );
};

// ─── Public helpers (used by WantChildrenBubble, CanvasChildOverlay) ──────────

export function shouldUseZoneLayout(childWants: Want[]): boolean {
  return childWants.some(w => {
    const role = w.metadata?.labels?.['child-role'];
    return role === 'monitor' || role === 'thinker' || role === 'doer';
  });
}

export function getWantRole(want: Want): ChildRole {
  const r = want.metadata?.labels?.['child-role'];
  if (r === 'monitor') return 'monitor';
  if (r === 'thinker') return 'thinker';
  if (r === 'doer') return 'doer';
  return 'other';
}

export function bucketByRole(wants: Want[]): {
  monitor: Want[];
  thinker: Want[];
  doer: Want[];
  other: Want[];
} {
  return wants.reduce(
    (acc, w) => {
      acc[getWantRole(w)].push(w);
      return acc;
    },
    { monitor: [] as Want[], thinker: [] as Want[], doer: [] as Want[], other: [] as Want[] },
  );
}

// ─── Public props ─────────────────────────────────────────────────────────────

export interface WantZoneLayoutProps {
  monitorWants: Want[];
  thinkerWants: Want[];
  doerWants: Want[];
  otherWants?: Want[];
  renderWant: (want: Want, role: ChildRole) => React.ReactNode;
  onDropToZone?: (role: ChildRole, draggedWantId: string) => void;
  onAddToZone?: (role: ChildRole) => void;
  compact?: boolean;
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export const WantZoneLayout: React.FC<WantZoneLayoutProps> = ({
  monitorWants,
  thinkerWants,
  doerWants,
  otherWants = [],
  renderWant,
  compact = false,
}) => {
  const byRole: Record<ChildRole, Want[]> = {
    monitor: monitorWants,
    thinker: thinkerWants,
    doer: doerWants,
    other: otherWants,
  };

  const sorted = ROLE_ORDER.flatMap(role =>
    byRole[role].map(w => ({ want: w, role })),
  );

  if (sorted.length === 0) return null;

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${compact ? 200 : GRID_COLUMN_WIDTH}px, 100%), 1fr))`,
      }}
    >
      {sorted.map(({ want, role }) => {
        const id = want.metadata?.id || want.id;
        return (
          <div key={id} style={{ position: 'relative' }}>
            <RoleTag role={role} compact={compact} />
            {renderWant(want, role)}
          </div>
        );
      })}
    </div>
  );
};
