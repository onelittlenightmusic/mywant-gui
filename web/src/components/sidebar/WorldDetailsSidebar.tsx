import React from 'react';
import { WorldCard } from '@/components/dashboard/WorldCard';
import { Check, Globe } from 'lucide-react';
import { WorldSummary } from '@/types/world';
import { CardStatusRow, CardStatusItem } from './CardStatusRow';
import { apiClient } from '@/api/client';
import { TabContent, TabSection, InfoRow } from './DetailsSidebar';

interface WorldDetailsSidebarProps {
  world: WorldSummary | null;
  /** Card overlay actions. EntityCard greys out any action with no
   *  handler, so the embedded card needs these to be usable. Open is worse
   *  than greyed without one: it stays lit and does nothing. */
  onRefresh?: () => void;
  onOpen?: (world: WorldSummary) => void;
  onExport?: (world: WorldSummary) => void;
  /** In-flight flags, so the embedded card says the same thing the grid's does. */
  opening?: boolean;
  exporting?: boolean;
  busy?: boolean;
}

/**
 * Read-only detail view. Open / Refresh are reached from the world card's
 * overlay grid, so every card action lives in one place regardless of input
 * device (see components/common/EntityCard).
 */
export const WorldDetailsSidebar: React.FC<WorldDetailsSidebarProps> = ({
  world, onRefresh, onOpen, onExport, opening = false, exporting = false, busy = false,
}) => {
  if (!world) {
    return (
      <div className="text-center py-12">
        <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a world to view details</p>
      </div>
    );
  }

  const thumbnailUrl = apiClient.worldThumbnailUrl(world.name, world.thumbnail_at);
  // The card's pill, in words (see components/sidebar/CardStatusRow).
  const pillItems: CardStatusItem[] = world.current
    ? [{ key: 'current', icon: <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" strokeWidth={3} />, label: 'Current world' }]
    : [];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <TabContent>
            {/* The card itself, first. On a phone the detail sheet covers the
                page behind it, so the card that would normally be tapped is out
                of reach; embedding it keeps its actions (long-press overlay
                included) reachable from inside the sheet. `selected` matters:
                EntityCard closes an overlay opened on an unselected card. */}
            <div className="mb-3 h-32 sm:h-36">
              <WorldCard
                world={world}
                selected
                keepFocus
                onRefresh={onRefresh}
                onView={() => {}}
                onOpen={(w) => onOpen?.(w)}
                onExport={onExport}
                opening={opening}
                exporting={exporting}
                busy={busy}
              />
            </div>
          {pillItems.length > 0 && <div className="mb-3"><CardStatusRow items={pillItems} /></div>}
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={`Canvas of world ${world.name}`}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
            />
          )}

          <TabSection title="World">
            <div className="space-y-2 sm:space-y-3">
              <InfoRow label="Name" value={<span className="font-mono">{world.name}</span>} />
              <InfoRow label="Wants" value={world.want_count} />
              <InfoRow
                label="Status"
                value={world.current
                  ? <span className="text-primary-600 dark:text-primary-400">Current</span>
                  : 'Saved snapshot'}
              />
              <InfoRow
                label="Modified"
                value={world.modified_at ? new Date(world.modified_at).toLocaleString() : '—'}
              />
            </div>
          </TabSection>

          <TabSection title="Storage">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-mono break-all">
              ~/.mywant/worlds/{world.name}.yaml
            </p>
          </TabSection>

          <TabSection title="About">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              A world is a named snapshot of the whole want set. Opening a world replaces the
              wants currently running in the engine with the ones stored in this snapshot.
            </p>
          </TabSection>
        </TabContent>
      </div>
    </div>
  );
};
