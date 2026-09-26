import React from 'react';
import { SlidersHorizontal, Clock, Tag, Link2, BadgeInfo, ArrowUpFromLine, ArrowDownToLine, Code } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { CountBadge } from '@/components/common/CountBadge';
import { CONTROL_TAB, CONTROL_ICON_CLASS } from '@/design/controls';

export type FormTab = 'name' | 'params' | 'labels' | 'schedule' | 'deps' | 'expose' | 'import' | 'yaml';
export const FORM_TABS: FormTab[] = ['params', 'labels', 'schedule', 'deps', 'expose', 'import', 'name'];
export const SETTINGS_FORM_TABS: FormTab[] = ['params', 'labels', 'schedule', 'deps', 'name', 'yaml'];

const TagLinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <span className="relative inline-flex items-center justify-center" style={{ width: '1em', height: '1em' }}>
    <Tag className={className} />
    <Link2 className="absolute -bottom-1 -right-1 w-2 h-2" />
  </span>
);

export const FORM_TAB_META: Record<FormTab, { label: string; icon: React.ElementType }> = {
  name:     { label: 'Metadata', icon: BadgeInfo },
  params:   { label: 'Params',   icon: SlidersHorizontal },
  labels:   { label: 'Labels',   icon: Tag      },
  schedule: { label: 'Schedule', icon: Clock    },
  deps:     { label: 'Deps',     icon: TagLinkIcon },
  expose:   { label: 'Expose',   icon: ArrowUpFromLine },
  import:   { label: 'Import',   icon: ArrowDownToLine },
  yaml:     { label: 'YAML',     icon: Code     },
};

export function FormTabBar({
  activeTab,
  onTabChange,
  badges,
  isBottom,
  tabs = FORM_TABS,
}: {
  activeTab: FormTab | 'add';
  onTabChange: (tab: FormTab) => void;
  badges: Partial<Record<FormTab, string | number | null>>;
  isBottom: boolean;
  tabs?: FormTab[];
}) {
  return (
    <div className={classNames(
      'flex flex-shrink-0 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50',
      isBottom ? 'border-t' : 'border-b'
    )}>
      {tabs.map(tab => {
        const { label, icon: Icon } = FORM_TAB_META[tab];
        const badge = badges[tab];
        const isActive = activeTab !== 'add' && activeTab === tab;
        const isRequired = typeof badge === 'string' && badge.startsWith('★');
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            data-robot-target="settings_subtab"
            data-robot-id={tab}
            className={classNames(
              // One height at every width. It used to be `py-0.5 sm:py-2`,
              // which made the cell 18px tall on a phone and 42px on a desktop
              // — the wrong way round, since the phone is the one being
              // touched. See design/controls.ts.
              CONTROL_TAB,
              'flex-1 flex flex-col items-center justify-center gap-0.5 px-0.5 transition-all relative min-w-0',
              isActive
                ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/30'
            )}
          >
            <div className="relative">
              <Icon className={classNames(CONTROL_ICON_CLASS.md, 'flex-shrink-0')} />
              {badge !== null && (
                <CountBadge
                  // "required, and not filled in" is exactly what the alert
                  // tone means everywhere else; a plain count is info.
                  tone={isRequired ? 'alert' : 'info'}
                  size={14}
                  className="absolute -top-1.5 -right-2"
                >
                  {badge}
                </CountBadge>
              )}
            </div>
            <span className="hidden sm:block text-[10px] font-bold uppercase tracking-tighter truncate w-full text-center sm:mt-0.5">
              {label}
            </span>
            {isActive && (
              <div className={classNames(
                'absolute h-0.5 bg-blue-600 dark:bg-blue-400 left-0 right-0',
                isBottom ? 'top-0' : 'bottom-0'
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}
