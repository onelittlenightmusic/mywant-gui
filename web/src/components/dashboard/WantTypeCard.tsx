import React from 'react';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { Download, Zap, Heart, Plus } from 'lucide-react';
import { WantTypeListItem } from '@/types/wantType';
import { truncateText, classNames } from '@/utils/helpers';
import {
  getPatternIcon,
  getPatternBadgeClass,
  getCategoryBadgeClass,
  getCategoryHexColor,
  resolveIconForFamily,
  type IconFamily,
} from './WantTypeVisuals';
import { useConfigStore } from '@/stores/configStore';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId } from '@/stores/cardOverlayStore';
import { wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getBackgroundToneColor } from '@/utils/backgroundStyles';

interface WantTypeCardProps {
  wantType: WantTypeListItem;
  selected?: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  onView: (wantType: WantTypeListItem) => void;
  /** Deploys the type's first example. */
  onDeploy?: (wantType: WantTypeListItem) => void;
  /** Downloads the type definition as JSON. */
  onDownload?: (wantType: WantTypeListItem) => void;
  className?: string;
}

export const WantTypeCard: React.FC<WantTypeCardProps> = ({
  wantType,
  selected = false, keepFocus,
  onView,
  onDeploy,
  onDownload,
  className,
}) => {
  const iconFont = useIconFont() as IconFamily;
  const iconStrokeWidth = iconFont === 'lucide-thin' ? 1 : undefined;
  const PatIcon = getPatternIcon(wantType.pattern);
  const CatIcon = resolveIconForFamily(wantType.category ?? '', wantType.name, iconFont);
  const isDarkMode = useDarkMode();

  const actions: EntityCardAction[] = [
    {
      icon: (
        <span className="relative inline-flex">
          <Heart className="w-5 h-5 text-white" />
          <Plus className="w-3 h-3 text-white absolute -top-1.5 -right-1.5" style={{ strokeWidth: 3 }} />
        </span>
      ),
      label: 'Add Want',
      onClick: () => onDeploy?.(wantType),
      tone: 'primary',
      disabled: !onDeploy,
      title: `Add a ${wantType.name} want`,
    },
    {
      icon: <Download className="w-5 h-5 text-white" />,
      label: 'Download',
      onClick: () => onDownload?.(wantType),
      tone: 'special',
      disabled: !onDownload,
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('want-type', wantType.name)}
      title={truncateText(wantType.title, 30)}
      selected={selected}
      keepFocus={keepFocus}
      onView={() => onView(wantType)}
      actions={actions}
      iconBadgeColor={getBackgroundToneColor(wantType.name) ?? getCategoryHexColor(wantType.category ?? '', isDarkMode)}
      icon={<CatIcon style={wantTypeIconStyle(wantType.name, wantType.category ?? '', isDarkMode)} strokeWidth={iconStrokeWidth} />}
      titleIcon={<Zap className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-yellow-500" />}
      className={className}
      badges={
        <>
          <span className={classNames(
            'inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-medium',
            getPatternBadgeClass(wantType.pattern),
          )}>
            <PatIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="capitalize hidden sm:inline">{wantType.pattern}</span>
          </span>
          <span
            className={classNames(
              'inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full',
              getCategoryBadgeClass(wantType.category),
            )}
            title={wantType.category}
          >
            <CatIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={wantTypeIconStyle(wantType.name, wantType.category ?? '', isDarkMode)} strokeWidth={iconStrokeWidth} />
          </span>
        </>
      }
    />
  );
};
