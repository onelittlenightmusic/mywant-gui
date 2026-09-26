import React from 'react';
import { DeviceCard } from '@/components/devices/DeviceCard';
import { Smartphone, Wifi, WifiOff, MapPin, MapPinOff, Home, UserRound } from 'lucide-react';
import { CardStatusRow, CardStatusItem } from './CardStatusRow';
import { BrowserDevice } from '@/types/device';
import { Character } from '@/types/character';
import { classNames } from '@/utils/helpers';
import { CharacterSelect } from '@/components/characters/CharacterSelect';
import { TabContent, TabSection, InfoRow } from './DetailsSidebar';

function timeAgo(ms: number): string {
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

interface DeviceDetailsSidebarProps {
  device: BrowserDevice | null;
  isActive: boolean;
  isMe: boolean;
  isOnline: boolean;
  characters: Character[];
  assignedCharacterId?: string;
  /** This device's browser runs all browser work. */
  isHome?: boolean;
  onCharacterChange?: (deviceId: string, characterId: string | null) => void;
  /**
   * The card's own overlay actions. The embedded card disables any action whose
   * handler is missing, so without these the sheet shows Locate and Set home
   * greyed out — the one place a phone user can reach them.
   */
  onToggleLocation?: () => void;
  onToggleHome?: () => void;
}

/**
 * Detail view for one device. Starting/stopping location lives on the card's
 * overlay grid; everything descriptive — last seen, ids, character assignment
 * — lives here.
 */
export const DeviceDetailsSidebar: React.FC<DeviceDetailsSidebarProps> = ({
  device, isActive, isMe, isOnline, characters, assignedCharacterId, onCharacterChange, isHome = false,
  onToggleLocation, onToggleHome,
}) => {
  if (!device) {
    return (
      <div className="text-center py-12">
        <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a device to view details</p>
      </div>
    );
  }

  const assigned = characters.find(c => c.id === assignedCharacterId);
  // Whatever the card's pill said, said again in words.
  const pillItems: CardStatusItem[] = [
    {
      key: 'location',
      icon: isActive
        ? <MapPin className="w-3.5 h-3.5 text-green-500" />
        : <MapPinOff className="w-3.5 h-3.5 text-gray-400" />,
      label: isActive ? 'Sending location' : 'Location off',
    },
    ...(isHome ? [{
      key: 'home',
      icon: <Home className="w-3.5 h-3.5 text-indigo-500" />,
      label: 'Home browser',
      title: 'All browser work runs in this browser',
    }] : []),
    ...(isMe ? [{
      key: 'me',
      icon: <UserRound className="w-3.5 h-3.5 text-blue-500" />,
      label: 'This device',
    }] : []),
    ...(assigned ? [{
      key: 'character',
      icon: <span>{assigned.avatar}</span>,
      label: assigned.name,
    }] : []),
  ];

  return (
    <div className="h-full overflow-y-auto">
      <TabContent>
        {/* The card itself, first. On a phone the sheet covers the page, so
            the card that would be tapped there is out of reach; embedding it keeps
            its actions (long-press overlay included) available. `selected` keeps
            EntityCard from closing that overlay; `keepFocus` stops it stealing DOM
            focus, which would silence the canvas arrow keys. */}
        <div className="mb-3 h-32 sm:h-36">
          <DeviceCard
            device={device}
            isFocused
            keepFocus
            isActive={isActive}
            isMe={isMe}
            isOnline={isOnline}
            isHome={isHome}
            assignedCharacter={characters.find(c => c.id === assignedCharacterId)}
            onClick={() => {}}
            onToggleLocation={onToggleLocation}
            onToggleHome={onToggleHome}
          />
        </div>
        <div className="mb-3"><CardStatusRow items={pillItems} /></div>
        <TabSection title="Status">
          <div className="space-y-2 sm:space-y-3">
            <InfoRow
              label="Connection"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {isOnline
                    ? <Wifi className="w-3 h-3 text-green-500" />
                    : <WifiOff className="w-3 h-3 text-gray-400" />}
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              }
            />
            <InfoRow label="Last seen" value={timeAgo(device.lastSeen)} />
            <InfoRow label="Location" value={isActive ? 'Sending' : 'Not sending'} />
          </div>
        </TabSection>

        {onCharacterChange && (
          <TabSection title="Character">
            <CharacterSelect
              characters={characters}
              currentCharacterId={assignedCharacterId}
              onChange={charId => onCharacterChange(device.id, charId)}
            />
          </TabSection>
        )}

        <TabSection title="ID">
          <p className="text-xs text-gray-500 dark:text-gray-500 font-mono break-all">{device.id}</p>
        </TabSection>
      </TabContent>
    </div>
  );
};
