import React, { useEffect, useState } from 'react';
import { Smartphone, Radio, RadioTower, UserRound, MapPin, MapPinOff, Puzzle, Download, Home } from 'lucide-react';
import { BrowserDevice } from '@/types/device';
import { Character } from '@/types/character';
import { classNames } from '@/utils/helpers';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { entityCardId, useCardOverlayStore } from '@/stores/cardOverlayStore';
import {
  listExtensionContexts,
  openExtensionContextOptions,
  serverNeedsAuth,
  setExtensionContext,
} from '@/lib/extensionContext';

interface DeviceCardProps {
  device: BrowserDevice;
  isFocused: boolean;
  /** Embedded in a sidebar: do not pull DOM focus (see EntityCard). */
  keepFocus?: boolean;
  isActive: boolean;
  isMe: boolean;
  isOnline: boolean;
  /** Opens the device's details sidebar. */
  onClick: () => void;
  /** Starts/stops location sending from this device. */
  onToggleLocation?: () => void;
  /** This device's browser runs all browser work (tabs open here, nowhere else). */
  isHome?: boolean;
  /** Makes this device home, or clears it when it already is. */
  onToggleHome?: () => void;
  /** Character assigned to this device, if any — shown as a small badge. */
  assignedCharacter?: Character;
}

/** Where the extension is published, for a browser that has none yet. */
const EXTENSION_DOWNLOAD_URL =
  'https://github.com/onelittlenightmusic/mywant-gui-dist/releases/latest';

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device, isFocused, keepFocus, isActive, isMe, isOnline, onClick, onToggleLocation, assignedCharacter,
  isHome = false, onToggleHome,
}) => {
  const navId = entityCardId('device', device.id);

  // Whether the browser extension answers, and which server it is on. Only
  // this device's own card can say anything about the extension — the others
  // are different browsers entirely — and the question is only asked once the
  // overlay is actually open, so merely visiting the page probes nothing.
  const overlayOpen = useCardOverlayStore(state => state.openCardId === navId);
  const [extension, setExtension] = useState<{ present: boolean; watching: string[] } | null>(null);

  useEffect(() => {
    if (!isMe || !overlayOpen || extension) return;
    let cancelled = false;
    // The list, not "which one is it on": the extension can take work from
    // several servers at once, so the question this card asks is whether THIS
    // server is among them.
    listExtensionContexts().then(list => {
      if (cancelled) return;
      setExtension({
        present: !!list,
        watching: (list?.contexts ?? [])
          .filter(p => p.watched !== false)
          .map(p => p.server.replace(/\/+$/, '')),
      });
    });
    return () => { cancelled = true; };
  }, [isMe, overlayOpen, extension]);

  const setExtensionToThisServer = async () => {
    const here = window.location.origin;
    const name = window.location.hostname || 'local';
    // A server behind Basic auth takes the password on the extension's own
    // options page: this page cannot read the credentials it was served with,
    // and has no business holding them.
    if (await serverNeedsAuth(here)) {
      await openExtensionContextOptions({ name, server: here });
    } else {
      await setExtensionContext({ name, server: here });
    }
    setExtension(null); // re-read on the next overlay open
  };
  // Last-seen time and the character picker live in the details sidebar; the
  // card shows only online state, "this device", and the assigned character.
  const actions: EntityCardAction[] = [
    {
      icon: <Radio className={classNames('w-5 h-5 text-white', isActive && 'animate-pulse')} />,
      label: isActive ? 'Stop' : 'Locate',
      onClick: () => onToggleLocation?.(),
      colorClass: isActive ? 'bg-rose-600/90' : 'bg-blue-600/90',
      disabled: !onToggleLocation,
      title: isActive ? 'Stop sending location' : 'Send location from this device',
    },
  ];

  // Home is a server-side setting naming which browser runs browser work, so
  // any device can set it — including for a device the user is not sitting at,
  // which is the case that matters when the home browser is the one across the
  // room.
  actions.push({
    icon: <Home className="w-5 h-5 text-white" />,
    label: isHome ? 'Unhome' : 'Set home',
    onClick: () => onToggleHome?.(),
    colorClass: isHome ? 'bg-emerald-600/90' : 'bg-indigo-600/90',
    disabled: !onToggleHome,
    title: isHome
      ? 'Stop running browser work here — any browser may take it again'
      : isMe
        ? 'Run all browser work in this browser'
        : `Run all browser work in ${device.name}`,
  });

  // The extension, by contrast, can only be asked about the browser it lives
  // in: another card is another browser entirely.
  if (isMe) {
    const onThisServer = !!extension?.present
      && extension.watching.indexOf(window.location.origin) !== -1;
    const missing = extension !== null && !extension.present;

    if (missing) {
      actions.push({
        icon: <Download className="w-5 h-5 text-white" />,
        label: 'Get ext',
        onClick: () => window.open(EXTENSION_DOWNLOAD_URL, '_blank', 'noreferrer'),
        colorClass: 'bg-gray-600/90',
        title: 'No extension answered — open the download page',
      });
    } else if (!onThisServer) {
      actions.push({
        icon: <Puzzle className="w-5 h-5 text-white" />,
        label: 'Watch',
        onClick: setExtensionToThisServer,
        colorClass: 'bg-amber-600/90',
        disabled: extension === null,
        title: extension === null
          ? 'Looking for the browser extension…'
          : extension.watching.length
            ? `Take work from this server too (already watching ${extension.watching.join(', ')})`
            : 'Take work from this server in this browser',
      });
    }
  }

  return (
    <EntityCard
      navId={navId}
      title={device.name}
      selected={isFocused}
      keepFocus={keepFocus}
      onView={onClick}
      actions={actions}
      className={isActive ? 'border-blue-400 dark:border-blue-500' : undefined}
      iconBadgeColor={isOnline ? '#22c55e' : '#94a3b8'}
      icon={<Smartphone style={{ color: isOnline ? '#22c55e' : '#94a3b8' }} />}
      titleIcon={
        isActive
          ? <RadioTower className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-blue-500 animate-pulse" />
          : <Smartphone className={classNames(
              'h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0',
              isOnline ? 'text-green-500' : 'text-gray-400',
            )} />
      }
      badges={
        <>
          {assignedCharacter && (
            <span
              className="flex items-center gap-0.5 text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: assignedCharacter.color + '22',
                color: assignedCharacter.color,
                border: `1px solid ${assignedCharacter.color}55`,
              }}
              title={assignedCharacter.name}
            >
              {assignedCharacter.avatar}
            </span>
          )}
          {isMe && (
            <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              me
            </span>
          )}
        </>
      }
    >
      {/* Status pill, sitting over the icon badge at the top-left: location
          sending state, home browser, and a "this device" marker. */}
      <div className="absolute top-1.5 left-1.5 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none">
        <span title={isActive ? 'Sending location' : 'Location stopped'} className="inline-flex">
          {isActive
            ? <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 animate-pulse" />
            : <MapPinOff className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 dark:text-gray-500" />}
        </span>
        {isHome && (
          <span title="Home browser — all browser work runs here" className="inline-flex">
            <Home className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
          </span>
        )}
        {isMe && (
          <span title="This device (me)" className="inline-flex">
            <UserRound className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
          </span>
        )}
        {assignedCharacter && (
          <span
            title={assignedCharacter.name}
            className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full text-[10px] sm:text-xs"
            style={{ backgroundColor: assignedCharacter.color + '33', border: `1px solid ${assignedCharacter.color}66` }}
          >
            {assignedCharacter.avatar}
          </span>
        )}
      </div>
    </EntityCard>
  );
};
