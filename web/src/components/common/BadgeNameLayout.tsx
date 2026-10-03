import React from 'react';

/**
 * The inside of a picker card: a tinted badge with the icon on the left, the
 * name (and, under it, what kind it is) in the space to its right. The shape
 * every card in the app wears (EntityCard's icon badge), and one component so
 * the pickers that draw it — Add Want's want types, Add Thing's kinds, Pin's
 * things — cannot drift apart. Absolutely placed: it goes inside a `relative`
 * card of its own (aspect 2/1 in all three), over whatever picture is behind.
 */
export const BadgeNameLayout: React.FC<{
  /** The icon, sized to fill the badge as it likes (58% reads well). */
  badge: React.ReactNode;
  /** Washes the badge (at low alpha). A #rrggbb colour. */
  badgeColor: string;
  name: React.ReactNode;
  /** A second line under the name, smaller — e.g. a thing's kind. */
  sub?: React.ReactNode;
  isDark: boolean;
}> = ({ badge, badgeColor, name, sub, isDark }) => (
  <>
    <div className="absolute inset-y-0 left-0 z-10 flex items-center pl-1 pointer-events-none">
      <div
        className="flex items-center justify-center rounded-lg h-[76%] aspect-square"
        style={{ backgroundColor: `${badgeColor}3a` }}
      >
        {badge}
      </div>
    </div>
    <div className="absolute inset-y-0 left-[42%] right-0 z-10 flex flex-col items-center justify-center gap-0.5 px-1 pointer-events-none">
      <span
        className={[
          'text-[9px] font-semibold leading-tight text-center',
          isDark ? 'text-white' : 'text-gray-800',
        ].join(' ')}
        style={{
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          maxWidth: '100%',
          textShadow: isDark
            ? '0 1px 3px rgba(0,0,0,0.7)'
            : '0 1px 3px rgba(255,255,255,0.7), 0 0 2px rgba(0,0,0,0.2)',
        }}
      >
        {name}
      </span>
      {sub}
    </div>
  </>
);
