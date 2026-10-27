import React from 'react';
import { classNames } from '@/utils/helpers';
import { CONTROL_TAB, CONTROL_ICON_CLASS } from '@/design/controls';
import { tabTrayClass, tabClass, tabIconClass, TAB_LABEL } from '@/design/tabs';

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
    <div className={tabTrayClass(!!isBottom)}>
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
              tabClass(isActive),
              !hasData && !isActive && 'opacity-40',
            )}
          >
            <div className="relative">
              <Icon className={classNames(CONTROL_ICON_CLASS.md, 'flex-shrink-0', tabIconClass(isActive))} />
              {hasData && !isActive && (
                <span className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500" />
              )}
            </div>
            <span className={TAB_LABEL}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
