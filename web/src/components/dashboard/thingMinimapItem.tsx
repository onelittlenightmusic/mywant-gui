import React from 'react';
import { Circle } from 'lucide-react';
import type { ThingRecord } from '@/types/thing';
import type { MinimapItem } from './ItemMinimap';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { iconEmbossFilter } from './WantCardFace';
import { thingBackgroundSrc, THING_BACKGROUND_SCRIM } from '@/utils/thingBackground';
import { dropCap, DROP_CAP_SCALE, thingDisplayName, thingFaceText, thingNameShadow, thingInk } from '@/utils/thingFace';

/**
 * A thing as a minimap tile: its card, small — its picture behind (held back
 * by the card's scrim), its name with the drop cap the board gives it, and its
 * kind's glyph as a decal low on the right (STYLE.md §3–§5).
 *
 * The Thing page's map draws its things with it, and so does anywhere else a
 * thing is shown as a tile of the map — a constellation's members in the
 * group's panel (guiex GroupMemberMiniCard).
 */
export function thingMinimapItem(
  r: Pick<ThingRecord, 'id' | 'value' | 'icon' | 'color' | 'background' | 'labels'>,
  isDarkMode: boolean,
): MinimapItem {
  const Icon = resolveLucideIcon(r.icon) ?? Circle;
  const isLight = !isDarkMode;
  const bg = thingBackgroundSrc(r.background, r.labels);
  const name = thingDisplayName(r.value);
  const { initial, rest } = dropCap(name);
  return {
    id: r.id,
    title: name,
    background: `${r.color}${isDarkMode ? '40' : '33'}`,
    icon: (
      <>
        {bg && (
          <>
            <img src={bg} alt="" aria-hidden draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none" />
            <div className={THING_BACKGROUND_SCRIM} />
          </>
        )}
        <Icon
          className="absolute right-1 bottom-0.5 pointer-events-none"
          style={{ width: 13, height: 13, color: thingInk(r.color, isLight), filter: iconEmbossFilter(isLight) }}
          strokeWidth={1.75}
        />
        <span className="relative z-10 font-bold leading-none flex items-baseline gap-px whitespace-nowrap pointer-events-none"
          style={{ color: thingFaceText(r.color, isLight), textShadow: thingNameShadow(r.color, isLight) }}>
          <span style={{ fontSize: 7 * DROP_CAP_SCALE, lineHeight: 1 }}>{initial}</span>
          {rest && <span style={{ fontSize: 7, lineHeight: 1 }}>{rest}</span>}
        </span>
      </>
    ),
  };
}
