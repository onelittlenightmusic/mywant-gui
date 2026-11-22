import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { iconName, useHostActions, useHostDockAction } from '@/lib/nativeHost';

/**
 * A panel's primary action as a round button floating at its bottom right —
 * Add World's, Add Character's (Add Want and Add Thing draw the same one):
 * the icon alone (its word the title), with a ＋ on its shoulder when it
 * makes something, in a browser as in an app — which draws it itself in an
 * app's sheet (useHostActions).
 *
 * The panel it floats over is `relative`; the button keeps clear of its
 * corner, which a phone's sheet rounds off.
 */
export const PanelFloatButton: React.FC<{
  label: string;
  icon: React.ElementType;
  onPress: () => void;
  disabled?: boolean;
  /** A ＋ on its shoulder: it makes something. */
  creates?: boolean;
  /** Its fill (a Tailwind bg class) when pressable. */
  color?: string;
}> = ({ label, icon: Icon, onPress, disabled, creates = true, color = 'bg-blue-600' }) => {
  const [focused, setFocused] = useState(false);
  const room = useHostActions([{
    id: 'primary', label, icon: iconName(Icon as { displayName?: string }, 'Plus'),
    disabled, tone: creates ? 'add' : 'save',
  }], () => { if (!disabled) onPress(); });
  const docked = useHostDockAction({
    id: 'primary', label, icon: iconName(Icon as { displayName?: string }, 'Plus'),
    disabled, tone: creates ? 'add' : 'save',
  }, () => { if (!disabled) onPress(); });
  if (docked) return null;
  return (
    <div className="absolute bottom-4 right-6 z-10 pointer-events-none">
      {room ? (
        <div ref={room} aria-hidden className="w-14 h-14 rounded-full invisible" />
      ) : (
        <button
          type="button"
          onClick={onPress}
          disabled={disabled}
          title={label}
          aria-label={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={classNames(
            'pointer-events-auto w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-150 sidebar-focus-ring',
            disabled ? 'bg-gray-400 cursor-not-allowed opacity-60'
              : focused ? 'bg-blue-500 active:opacity-80'
                : `${color} hover:brightness-110 active:opacity-80`,
          )}
        >
          <span className="relative inline-flex">
            <Icon className="w-6 h-6" />
            {creates && <Plus className="w-3 h-3 absolute -top-1 -right-1.5" style={{ strokeWidth: 3.5 }} />}
          </span>
        </button>
      )}
    </div>
  );
};
