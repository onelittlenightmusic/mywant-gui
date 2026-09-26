import React, { useEffect, useState } from 'react';
import { Globe, Check, LogIn, RefreshCw, Download } from 'lucide-react';
import { WorldSummary } from '@/types/world';
import { apiClient } from '@/api/client';
import { classNames } from '@/utils/helpers';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId } from '@/stores/cardOverlayStore';

interface WorldCardProps {
  world: WorldSummary;
  /** Keyboard/cursor focus — details sidebar shows this world. */
  selected?: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  /** Show the details of this world in the sidebar. */
  onView: (world: WorldSummary) => void;
  /** Switch the engine over to this world. */
  onOpen: (world: WorldSummary) => void;
  /** Re-fetch the world list. */
  onRefresh?: () => void;
  /** Download this world's snapshot YAML. */
  onExport?: (world: WorldSummary) => void;
  /** Truthy while this world is being exported. */
  exporting?: boolean;
  /** Truthy while this world is being opened. */
  opening?: boolean;
  /** Any world is being opened — disables the Open action. */
  busy?: boolean;
}

export const WorldCard: React.FC<WorldCardProps> = ({
  world,
  selected = false, keepFocus,
  onView,
  onOpen,
  onRefresh,
  onExport,
  opening = false,
  busy = false,
  exporting = false,
}) => {
  // Canvas screenshot captured periodically by the dashboard while this world
  // was open (see useWorldThumbnailCapture). Absent until the first capture.
  const thumbnailUrl = apiClient.worldThumbnailUrl(world.name, world.thumbnail_at);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const showThumbnail = !!thumbnailUrl && !thumbnailFailed;

  useEffect(() => { setThumbnailFailed(false); }, [thumbnailUrl]);

  const actions: EntityCardAction[] = [
    {
      icon: <LogIn className="w-5 h-5 text-white" />,
      label: opening ? 'Opening' : 'Open',
      onClick: () => onOpen(world),
      colorClass: 'bg-blue-600/90',
      disabled: world.current || busy,
      title: world.current ? 'Already the current world' : `Open world "${world.name}"`,
    },
    {
      icon: <Download className="w-5 h-5 text-white" />,
      label: exporting ? 'Exporting' : 'Export',
      onClick: () => onExport?.(world),
      colorClass: 'bg-emerald-600/90',
      disabled: !onExport || exporting,
      title: `Download world "${world.name}" as YAML`,
    },
    {
      icon: <RefreshCw className="w-5 h-5 text-white" />,
      label: 'Refresh',
      onClick: () => onRefresh?.(),
      colorClass: 'bg-purple-600/90',
      disabled: !onRefresh,
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('world', world.name)}
      title={world.name}
      selected={selected}
      keepFocus={keepFocus}
      onView={() => onView(world)}
      actions={actions}
      iconBadgeColor={world.current ? '#6366f1' : '#64748b'}
      icon={<Globe style={{ color: world.current ? '#6366f1' : '#64748b' }} />}
      backgroundNode={showThumbnail ? (
        <>
          <img
            src={thumbnailUrl!}
            alt=""
            onError={() => setThumbnailFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
          />
          {/* Scrim so the centred icon and bottom bar stay readable over the canvas shot. */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/80 via-white/30 to-white/80 dark:from-gray-900/85 dark:via-gray-900/40 dark:to-gray-900/85" />
        </>
      ) : undefined}
      titleIcon={<Globe className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-primary-500" />}
      badges={world.current ? (
        <span className="flex items-center gap-1 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
          <Check className="w-3 h-3" />Current
        </span>
      ) : undefined}
    >
      {/* "Current world" badge — bottom-right pill, same style as thing/device. */}
      {world.current && (
        <div
          className="absolute top-1.5 left-1.5 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none"
          title="Current world"
        >
          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 dark:text-primary-400" strokeWidth={3} />
        </div>
      )}
    </EntityCard>
  );
};
