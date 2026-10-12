import React from 'react';
import { Type } from 'lucide-react';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { useThingStore } from '@/stores/thingStore';
import {
  type ThingPictureKind, type ThingPictureSource,
  parseClock, thingCoords, thingPhoto, thingPictureKind,
} from '@/utils/thingPicture';
import { ClockDial } from '@/components/common/ClockDial';
import { ThingMap } from '@/components/common/ThingMap';
import { iconEmbossFilter, vividIconColor } from './WantCardFace';

/**
 * A thing's picture — what its card shows of it, and what the board shows of
 * it up close (the board draws this, at its own size). One part for both, so
 * the two never draw the same thing two ways. Which picture is
 * thingPictureKind's call; this fills its box with it.
 */
export const ThingPicture: React.FC<{
  source: ThingPictureSource;
  isLight: boolean;
  /** Draw this kind rather than the thing's own (a card puts a map or a photo
   *  behind itself, and shows the glyph in the middle). */
  kind?: ThingPictureKind;
  /** Emboss the glyph with a drop-shadow. Off where the picture is enlarged
   *  after it is painted (the board), which blurs a filter. */
  emboss?: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({ source, isLight, kind, emboss = true, className, style }) => {
  const k = kind ?? thingPictureKind(source);
  const ink = vividIconColor(source.color, isLight);
  const clock = k === 'clock' ? parseClock(source.value) : null;
  if (clock) {
    return <ClockDial h={clock.h} m={clock.m} ink={ink} isLight={isLight} className={className} style={style} />;
  }
  if (k === 'photo' && source.photo) {
    return (
      <img
        src={source.photo}
        alt=""
        draggable={false}
        onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
        className={`object-cover select-none pointer-events-none ${className ?? ''}`}
        style={style}
      />
    );
  }
  if (k === 'map' && source.coords) {
    return (
      <div className={className} style={style}>
        <ThingMap lat={source.coords.lat} lng={source.coords.lng} color={source.color} className="w-full h-full" />
      </div>
    );
  }
  const Icon = resolveLucideIcon(source.icon) ?? Type;
  return (
    <Icon
      className={className}
      style={{ color: ink, filter: emboss ? iconEmbossFilter(isLight) : undefined, ...style }}
      strokeWidth={1.75}
    />
  );
};

/**
 * What ThingPicture needs to know about a thing beyond its tile or record:
 * where it was named and the picture it was named for, out of the ledger's
 * definitions (loaded here if nothing has yet).
 */
export function useThingPictureSource(thing: {
  id: string; subtype: string; value: string; icon: string; color: string; picture?: string;
}): ThingPictureSource {
  const definitions = useThingStore(s => s.definitions);
  const ensureThings = useThingStore(s => s.ensureThings);
  React.useEffect(() => { ensureThings(); }, [ensureThings]);
  const { id, subtype, value, icon, color, picture } = thing;
  return React.useMemo(() => ({
    subtype, value, icon, color,
    coords: thingCoords(definitions, id),
    photo: thingPhoto(definitions, id, subtype, picture),
  }), [definitions, id, subtype, value, icon, color, picture]);
}
