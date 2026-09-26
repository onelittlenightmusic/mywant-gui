import React, { useState, useEffect } from 'react';
import { BaseModal } from './BaseModal';
import { useConfigStore } from '@/stores/configStore';
import { useDebugStore } from '@/stores/debugStore';
import { POLLING_PRESETS } from '@/constants/polling';
import { Power, RotateCcw, ShieldAlert, Bug, Gamepad2, Pencil, Info } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { apiClient } from '@/api/client';
import { useInputActions } from '@/hooks/useInputActions';
import { Slot } from '@/extensions/Slot';
import { connectController, onControllerStatus, ControllerStatus } from '@/lib/controllerHub';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}






const WEATHER_EFFECT_OPTIONS = [
  { id: '',       label: 'Auto',   emoji: '🔄' },
  { id: 'sunny',  label: 'Sunny',  emoji: '☀️' },
  { id: 'cloudy', label: 'Cloudy', emoji: '☁️' },
  { id: 'rain',   label: 'Rain',   emoji: '🌧️' },
  { id: 'storm',  label: 'Storm',  emoji: '⛈️' },
  { id: 'snow',   label: 'Snow',   emoji: '❄️' },
  { id: 'fog',    label: 'Fog',    emoji: '🌫️' },
];




const INTERACTION_MODES = [
  { id: 'edit' as const, label: 'Edit', icon: Pencil },
  { id: 'game' as const, label: 'Game', icon: Gamepad2 },
];

// Number of buttons in each navigation group (must match JSX order).
//
// The look-and-feel groups that used to head this list — appearance, sound,
// layout, card height and opacity, icon style, canvas design and ground — are
// not settings of the server. They belong to whoever is looking at it, and they
// live on the character now (see CharacterDisplaySettings). What is left here
// is what really is the server's: how often it is polled, whether the board can
// be rearranged, and the process itself.
// Group 0: Debug             (pollingPresets)
// Group 1: Interaction Mode  (interactionModes)
// Group 2: System            (restart, stop)
// What an extension adds (settingsSection) sits between 1 and 2 and keeps its
// own controls.
const GROUP_SIZES = [POLLING_PRESETS.length, INTERACTION_MODES.length, 2];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { config, updateConfig } = useConfigStore();
  const { pollingIntervalMs, setPollingIntervalMs } = useDebugStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [focus, setFocus] = useState({ group: -1, item: -1 });

  // Build versions of the two processes behind the page: the mywant engine
  // (GET /health) and the GUI server that serves this bundle and proxies to it
  // (GET /api/v1/gui-version). Fetched fresh each time the modal opens.
  const [versions, setVersions] = useState<{
    backend?: string; backendCommit?: string; gui?: string; guiCommit?: string;
  }>({});
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    (async () => {
      const [b, g] = await Promise.allSettled([
        fetch('/health').then((r) => r.json()),
        fetch('/api/v1/gui-version').then((r) => r.json()),
      ]);
      if (!alive) return;
      setVersions({
        backend: b.status === 'fulfilled' ? b.value?.version : undefined,
        backendCommit: b.status === 'fulfilled' ? b.value?.commit : undefined,
        gui: g.status === 'fulfilled' ? g.value?.version : undefined,
        guiCommit: g.status === 'fulfilled' ? g.value?.commit : undefined,
      });
    })();
    return () => { alive = false; };
  }, [isOpen]);
  // Re-render when a design registers (built-in on load, or external plugin async).

  // WebHID controller connection status (see @/lib/controllerHub).
  const [controller, setController] = useState<ControllerStatus>({ connected: false, name: '' });
  const [controllerError, setControllerError] = useState<string | null>(null);
  useEffect(() => onControllerStatus(setController), []);
  const hidSupported = typeof navigator !== 'undefined' && !!(navigator as unknown as { hid?: unknown }).hid;
  const handleConnectController = () => {
    setControllerError(null);
    connectController().catch(err => setControllerError(err instanceof Error ? err.message : String(err)));
  };

  // Initialize focus to first button when modal opens; reset on close.
  useEffect(() => {
    if (isOpen) setFocus({ group: 0, item: 0 });
    else        setFocus({ group: -1, item: -1 });
  }, [isOpen]);



  const handleStopServer = async () => {
    if (!confirm('Are you sure you want to STOP the server? You will lose connection to this dashboard.')) return;
    setIsProcessing(true);
    try {
      const res = await apiClient.stopServer();
      setMessage(res.message);
    } catch {
      setMessage('Failed to stop server');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestartServer = () => {
    window.location.reload();
  };

  // Action table indexed by [group][item] — must match GROUP_SIZES and JSX order.
  const groupActions: Array<Array<() => void>> = [
    POLLING_PRESETS.map(p => () => setPollingIntervalMs(p.value)),
    INTERACTION_MODES.map(m => () => updateConfig({ interaction_mode: m.id })),
    [handleRestartServer, handleStopServer],
  ];

  useInputActions({
    enabled: isOpen,
    captureInput: isOpen,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,

    onNavigate: (dir) => {
      setFocus(prev => {
        switch (dir) {
          case 'up': {
            if (prev.group <= 0) return prev;
            const g = prev.group - 1;
            return { group: g, item: Math.min(prev.item, GROUP_SIZES[g] - 1) };
          }
          case 'down': {
            if (prev.group >= GROUP_SIZES.length - 1) return prev;
            const g = prev.group + 1;
            return { group: g, item: Math.min(prev.item, GROUP_SIZES[g] - 1) };
          }
          case 'left':
            return { ...prev, item: Math.max(0, prev.item - 1) };
          case 'right':
            return { ...prev, item: Math.min(GROUP_SIZES[prev.group] - 1, prev.item + 1) };
          case 'home':
            return { group: 0, item: 0 };
          case 'end': {
            const lastG = GROUP_SIZES.length - 1;
            return { group: lastG, item: GROUP_SIZES[lastG] - 1 };
          }
          default:
            return prev;
        }
      });
    },

    onConfirm: () => {
      const { group, item } = focus;
      if (group >= 0 && item >= 0) groupActions[group]?.[item]?.();
    },

    onCancel: onClose,
  });

  if (!config) return null;

  const isFocused = (g: number, i: number) => focus.group === g && focus.item === i;

  // Shared flat button style — icon + label side by side, minimal height
  const optBtn = (isActive: boolean, focused: boolean, extra?: string) => classNames(
    "flex flex-row items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border transition-all text-xs font-medium",
    isActive
      ? "border-primary-400 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:border-primary-600 dark:text-primary-300"
      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700",
    focused && "ring-2 ring-sky-400 dark:ring-sky-400",
    extra ?? ""
  );

  const sectionHead = "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5";

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Settings" size="sm">
      <div className="space-y-4">








        {/* The weather override: not a look (those are the character's), but
            what the wants are doing — drawn over the list and the board alike. */}
        <section>
          <h4 className={sectionHead}><Gamepad2 className="w-3.5 h-3.5" />Weather</h4>
          {/* Weather Effect selector */}
          <div className="mt-3">
            <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5">Weather Effect (canvas overlay)</span>
            <div className="flex gap-1.5 flex-wrap">
              {WEATHER_EFFECT_OPTIONS.map(opt => {
                const active = (config.canvas_weather_effect ?? '') === opt.id;
                return (
                  <button
                    key={opt.id}
                    title={opt.label}
                    onClick={() => updateConfig({ canvas_weather_effect: opt.id })}
                    className={classNames(
                      'flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] transition-all',
                      active
                        ? 'border-primary-400 ring-1 ring-primary-400 text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400',
                    )}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">Auto = read from weather_effect want</p>
          </div>
        </section>

        {/* Controller (WebHID) — no keyboard nav group (needs a user-gesture click) */}
        <section className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <h4 className={sectionHead}><Gamepad2 className="w-3.5 h-3.5" />Controller (WebHID)</h4>
          {hidSupported ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConnectController}
                  className={classNames(
                    'flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all text-xs font-medium',
                    controller.connected
                      ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-900/40 dark:text-green-400'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700',
                  )}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  {controller.connected ? '接続済み' : 'コントローラーを接続'}
                </button>
                {controller.connected && controller.name && (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{controller.name}</span>
                )}
              </div>
              {controllerError && <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">{controllerError}</p>}
              <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                接続すると Gamepad API より WebHID が優先されます。一度許可すると記憶します（mac/Chrome専用）。
              </p>
            </>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">このブラウザは WebHID 未対応です（mac/Chrome が必要）。</p>
          )}
        </section>

        {/* Debug Options — group 0 */}
        <section className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <h4 className={sectionHead}><Bug className="w-3.5 h-3.5" />Debug — Polling Interval</h4>
          <div className="flex gap-2 flex-wrap">
            {POLLING_PRESETS.map((preset, i) => (
              <button key={preset.value} onClick={() => setPollingIntervalMs(preset.value)}
                className={optBtn(pollingIntervalMs === preset.value, isFocused(0, i))}>
                {preset.label}
              </button>
            ))}
          </div>
        </section>

        {/* Interaction Mode — group 1 */}
        <section>
          <h4 className={sectionHead}><Pencil className="w-3.5 h-3.5" />Interaction Mode</h4>
          <div className="flex gap-2">
            {INTERACTION_MODES.map((mode, i) => (
              <button key={mode.id} onClick={() => updateConfig({ interaction_mode: mode.id })}
                className={optBtn((config.interaction_mode ?? 'edit') === mode.id, isFocused(1, i), "flex-1")}>
                <mode.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {mode.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            Game mode locks want tile positions on the canvas (drag, keyboard, gamepad, and CLI moves are all blocked).
          </p>
        </section>

        {/* What extensions add — the canvas's pad, who answers as the robot. */}
        <Slot name="settingsSection" />

        {/* System Control — group 2 */}
        <section className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <h4 className={classNames(sectionHead, "text-red-500 dark:text-red-400")}>
            <ShieldAlert className="w-3.5 h-3.5" />System Control
          </h4>
          <div className="flex gap-2">
            <button onClick={handleRestartServer} disabled={isProcessing}
              className={classNames(
                "flex-1 flex flex-row items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border transition-all text-xs font-medium border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400 disabled:opacity-50",
                isFocused(2, 0) && "ring-2 ring-sky-400"
              )}>
              <RotateCcw className="w-3.5 h-3.5" />Reload
            </button>
            <button onClick={handleStopServer} disabled={isProcessing}
              className={classNames(
                "flex-1 flex flex-row items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border transition-all text-xs font-medium border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400 disabled:opacity-50",
                isFocused(2, 1) && "ring-2 ring-sky-400"
              )}>
              <Power className="w-3.5 h-3.5" />Stop
            </button>
          </div>
          {message && (
            <p className="mt-2 text-xs text-center font-medium text-primary-600 dark:text-primary-400 animate-pulse">{message}</p>
          )}
        </section>

        {/* About — the two build versions, the source, and whose it is. */}
        <section className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <h4 className={sectionHead}><Info className="w-3.5 h-3.5" />About</h4>
          <dl className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">mywant</dt>
              <dd className="font-mono text-gray-700 dark:text-gray-300 truncate">
                {versions.backend ?? '—'}
                {versions.backendCommit ? ` (${versions.backendCommit})` : ''}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-500 dark:text-gray-400">GUI</dt>
              <dd className="font-mono text-gray-700 dark:text-gray-300 truncate">
                {versions.gui ?? '—'}
                {versions.guiCommit ? ` (${versions.guiCommit})` : ''}
              </dd>
            </div>
          </dl>
          <a
            href="https://github.com/onelittlenightmusic/MyWant"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-primary-600 dark:text-primary-400 hover:underline break-all"
          >
            github.com/onelittlenightmusic/MyWant
          </a>
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            © Hiroyuki Osaki
          </p>
        </section>
      </div>
    </BaseModal>
  );
};
