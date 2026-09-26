import React from 'react';
import { classNames } from '@/utils/helpers';
import { CONTROL_TAB, CONTROL_ICON_CLASS } from '@/design/controls';

/**
 * The tab bar a detail sheet wears: icon above label, blue when active, a rule
 * under the one you are on.
 *
 * Lifted out of WantDetailsSidebar, where it had been a private helper, when the
 * character sheet grew tabs of its own. Two sheets with hand-rolled tab bars is
 * two sheets that drift — different heights, different active colours, and a
 * gamepad that switches tabs on one of them and not the other.
 *
 * Deliberately matches FormTabBar rather than replacing it: that one carries
 * badges and a fixed tab vocabulary for the want form, this one takes whatever
 * tabs it is handed. Same shape, different jobs.
 */
export function SubTabBar<T extends string>({
  tabs,
  active,
  onChange,
  isBottom = false,
}: {
  tabs: { id: T; label: string; icon: React.ElementType; hasData?: boolean }[];
  active: T;
  onChange: (id: T) => void;
  isBottom?: boolean;
}) {
  return (
    <div className={classNames(
      'flex flex-shrink-0 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50',
      isBottom ? 'border-t' : 'border-b',
    )}>
      {tabs.map(({ id, label, icon: Icon, hasData }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            // A stop like the controls below it, so the arrows can walk up into
            // the tabs and the stick can land on them. A tab bar you can see but
            // not reach is a tab bar that needs a finger.
            data-free-cursor-item
            className={classNames(
              // Same floor as every other tab strip — see design/controls.ts.
              CONTROL_TAB,
              'flex-1 flex flex-col items-center justify-center gap-0.5 px-0.5 transition-all relative min-w-0',
              isActive
                ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/30',
              !hasData && !isActive && 'opacity-40',
            )}
          >
            <div className="relative">
              <Icon className={classNames(CONTROL_ICON_CLASS.md, 'flex-shrink-0')} />
              {hasData && !isActive && (
                <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500" />
              )}
            </div>
            <span className="hidden sm:block text-[10px] font-bold uppercase tracking-tighter truncate w-full text-center sm:mt-0.5">
              {label}
            </span>
            {isActive && (
              <div className={classNames(
                'absolute h-0.5 bg-blue-600 dark:bg-blue-400 left-0 right-0',
                isBottom ? 'top-0' : 'bottom-0',
              )} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
