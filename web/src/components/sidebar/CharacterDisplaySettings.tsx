import React, { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, Volume2, VolumeX, Layout as LayoutIcon, ArrowUp, ArrowDown, Rows2, Rows3, Rows4, Type, ALargeSmall, Droplet, Blend, Contrast, Smile, Palette, ImageIcon, X, LayoutGrid } from 'lucide-react';
import type { Character, CharacterDisplay } from '@/types/character';
import { DISPLAY_DEFAULTS } from '@/hooks/useDisplaySettings';
import { listOverlayDesigns, onOverlayDesignRegistered, overlayDesignOf, withOverlayDesign } from '@/components/overlay';
import { classNames } from '@/utils/helpers';
import { TabContent, TabSection } from '@/components/sidebar/DetailsSidebar';
import { SettingSlider } from './SettingSlider';
import { Slot } from '@/extensions/Slot';

/**
 * How this person likes the app to look and sound.
 *
 * These were the global Settings, and moving them here is the point: a
 * character is a person, two people share one server and one board, and how
 * loud the interface is or what colour the ground is was never a fact about the
 * board. Everything a character has not chosen falls back to DISPLAY_DEFAULTS —
 * one place, so no two screens can disagree about what "unset" looks like.
 *
 * Saved on every press rather than behind a Save button. There is nothing to
 * validate and nothing to lose: each of these is a look you are trying on, and
 * seeing it immediately is most of how you decide.
 */

interface Props {
  character: Character;
  onSave: (display: CharacterDisplay) => Promise<void>;
}

interface PillProps { label: string; icon?: React.ReactNode; active: boolean; onClick: () => void }

/** One choice in a group. The same chip the design pickers use. */
const Pill: React.FC<PillProps> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    // A stop for the roaming cursor, which is confined to this panel while the
    // panel holds the stick (see keyHoldingSurface). Untagged, the stick could
    // be pushed around a sheet with nothing in it to land on.
    data-free-cursor-item
    className={classNames(
      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
      active
        ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
    )}
  >
    {icon}
    {label}
  </button>
);

const Group: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div>
    <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
      {icon}{title}
    </p>
    <div className="flex flex-wrap gap-1">{children}</div>
  </div>
);

export const CharacterDisplaySettings: React.FC<Props> = ({ character, onSave }) => {
  // The edited copy: what the character has chosen, over the defaults, so every
  // group has a pill lit from the start rather than an empty row meaning "some
  // default you cannot see".
  const [d, setD] = useState<CharacterDisplay>({ ...DISPLAY_DEFAULTS, ...(character.display ?? {}) });
  // Re-seed on what the character's choices ARE, not on the object holding them.
  // The list is refetched constantly (SSE, saves, polling), so a dependency on
  // identity re-seeds on every unrelated refresh; and a dependency on nothing
  // leaves the pills showing a choice the server no longer has, which is what
  // happened after changing a setting from outside this screen.
  const saved = JSON.stringify(character.display ?? {});
  useEffect(() => {
    setD({ ...DISPLAY_DEFAULTS, ...(character.display ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  // Overlay designs register themselves as their files load — from extensions
  // and design plugins, possibly after the first render.
  const [, forceDesignUpdate] = useState(0);
  useEffect(() => onOverlayDesignRegistered(() => forceDesignUpdate(v => v + 1)), []);

  const put = (patch: Partial<CharacterDisplay>) => {
    const next = { ...d, ...patch };
    setD(next);
    void onSave(next);
  };

  return (
    <div className="h-full overflow-y-auto">
      <TabContent>
        <TabSection title="Display">
          <div className="space-y-3">
            <Group title="Appearance" icon={<Sun className="w-3 h-3" />}>
              <Pill label="Light"  icon={<Sun className="w-3 h-3" />}     active={d.color_mode === 'light'}  onClick={() => put({ color_mode: 'light' })} />
              <Pill label="Dark"   icon={<Moon className="w-3 h-3" />}    active={d.color_mode === 'dark'}   onClick={() => put({ color_mode: 'dark' })} />
              <Pill label="System" icon={<Monitor className="w-3 h-3" />} active={d.color_mode === 'system'} onClick={() => put({ color_mode: 'system' })} />
            </Group>

            <Group title="Sound Effects" icon={<Volume2 className="w-3 h-3" />}>
              <Pill label="On"  icon={<Volume2 className="w-3 h-3" />}  active={d.sound_enabled !== false} onClick={() => put({ sound_enabled: true })} />
              <Pill label="Off" icon={<VolumeX className="w-3 h-3" />} active={d.sound_enabled === false} onClick={() => put({ sound_enabled: false })} />
            </Group>

            <Group title="Layout" icon={<LayoutIcon className="w-3 h-3" />}>
              <Pill label="Header top"    icon={<ArrowUp className="w-3 h-3" />}   active={d.header_position !== 'bottom'} onClick={() => put({ header_position: 'top' })} />
              <Pill label="Header bottom" icon={<ArrowDown className="w-3 h-3" />} active={d.header_position === 'bottom'} onClick={() => put({ header_position: 'bottom' })} />
            </Group>

            <SettingSlider
              title="Card Height"
              titleIcon={<Rows3 className="w-3 h-3" />}
              value={d.card_height ?? DISPLAY_DEFAULTS.card_height}
              onChange={v => put({ card_height: v })}
              options={[
                { value: 'sm' as const, label: 'Short',  icon: <Rows4 className="w-3 h-3" /> },
                { value: 'md' as const, label: 'Medium', icon: <Rows3 className="w-3 h-3" /> },
                { value: 'lg' as const, label: 'Tall',   icon: <Rows2 className="w-3 h-3" /> },
              ]}
            />

            {/* A scale, so it is drawn as one — see SettingSlider. */}
            <SettingSlider
              title="System Font"
              titleIcon={<Type className="w-3 h-3" />}
              value={d.system_font_size ?? DISPLAY_DEFAULTS.system_font_size}
              onChange={v => put({ system_font_size: v })}
              options={[
                { value: 'small'  as const, label: 'Small',  icon: <ALargeSmall className="w-3 h-3" /> },
                { value: 'medium' as const, label: 'Medium', icon: <ALargeSmall className="w-3.5 h-3.5" /> },
                { value: 'large'  as const, label: 'Large',  icon: <ALargeSmall className="w-4 h-4" /> },
              ]}
            />

            {/* Also a scale: one card, at four strengths of solid. */}
            <SettingSlider
              title="Card Opacity"
              titleIcon={<Droplet className="w-3 h-3" />}
              value={d.card_opacity ?? DISPLAY_DEFAULTS.card_opacity}
              onChange={v => put({ card_opacity: v })}
              options={[
                { value: 0.5,  label: '50%',   icon: <Blend className="w-3 h-3" /> },
                { value: 0.7,  label: '70%',   icon: <Blend className="w-3 h-3" /> },
                { value: 0.85, label: '85%',   icon: <Contrast className="w-3 h-3" /> },
                { value: 1,    label: 'Solid', icon: <Contrast className="w-3 h-3" /> },
              ]}
            />

            <Group title="Icon Style" icon={<Smile className="w-3 h-3" />}>
              {([
                ['lucide', 'Lucide'],
                ['lucide-thin', 'Lucide Thin'],
                ['heroicons-outline', 'Heroicons'],
                ['heroicons-solid', 'Heroicons Solid'],
              ] as const).map(([v, label]) => (
                <Pill key={v} label={label} icon={<Smile className="w-3 h-3" />} active={d.icon_font === v} onClick={() => put({ icon_font: v })} />
              ))}
            </Group>

            {/* Look choices an extension brings — the canvas's design. */}
            <Slot name="characterDisplay" display={d} put={put} />

            {/* How every menu and dialog over a card or the board is drawn.
                Grid is built in; an extension can bring another. */}
            <Group title="Overlay Design" icon={<LayoutGrid className="w-3 h-3" />}>
              {listOverlayDesigns().map(design => (
                <Pill
                  key={design.id}
                  label={design.name}
                  icon={<LayoutGrid className="w-3 h-3" />}
                  active={overlayDesignOf(d) === design.id}
                  onClick={() => put({ ext: withOverlayDesign(d, design.id) })}
                />
              ))}
            </Group>

            <Group title="Canvas Background" icon={<ImageIcon className="w-3 h-3" />}>
              {/* The board is the same board; this is the ground YOU see it on. */}
              <Pill label="Theme" icon={<Palette className="w-3 h-3" />} active={!d.canvas_bg_color} onClick={() => put({ canvas_bg_color: '' })} />
              {CANVAS_GROUNDS.map(c => (
                <button
                  key={c}
                  data-free-cursor-item
                  onClick={() => put({ canvas_bg_color: c })}
                  title={c}
                  className={classNames(
                    'w-6 h-6 rounded-full transition-all',
                    d.canvas_bg_color === c
                      ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-indigo-500 scale-110'
                      : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </Group>

            {/* A picture, not a colour.
                
                The swatches above are the ground the board sits on; this is a
                photograph behind it, and it is the same field a
                dynamic_background want writes when it is pointed at a
                character — so an album cover arriving from Spotify and a URL
                typed here are the same setting, and one can be seen and
                cleared where the other put it. */}
            <Group title="Background Image" icon={<ImageIcon className="w-3 h-3" />}>
              <input
                type="url"
                value={d.canvas_bg_url ?? ''}
                onChange={e => put({ canvas_bg_url: e.target.value })}
                placeholder="https://… (empty = none)"
                data-free-cursor-item
                className="w-full px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {d.canvas_bg_url && (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-10 h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-center bg-cover flex-shrink-0"
                    style={{ backgroundImage: `url(${JSON.stringify(d.canvas_bg_url)})` }}
                  />
                  <Pill label="Clear" icon={<X className="w-3 h-3" />} active={false} onClick={() => put({ canvas_bg_url: '' })} />
                </div>
              )}
            </Group>
          </div>
        </TabSection>
      </TabContent>
    </div>
  );
};

/** Ground colours on offer. A short list of picked tones rather than a colour
 *  wheel: the ground sits under everything, and most of the wheel fights it. */
const CANVAS_GROUNDS = ['#f0ede6', '#e8e3d5', '#dbe7f0', '#e6e0ef', '#2a1e0e', '#1c2431', '#14231c', '#292928'];

CharacterDisplaySettings.displayName = 'CharacterDisplaySettings';
