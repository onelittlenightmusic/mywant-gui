import React, { useState, useEffect, useRef } from 'react';
import { Check, X, MousePointer2, Users, UserRound, Palette, Smile, Droplet, Shapes } from 'lucide-react';
import { Character } from '@/types/character';
import { classNames } from '@/utils/helpers';
import { AVATAR_PRESETS, COLOR_PRESETS } from '@/components/characters/characterPresets';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { TabContent, TabSection } from '@/components/sidebar/DetailsSidebar';
import { CharacterDisplaySettings } from './CharacterDisplaySettings';
import { SubTabBar } from '@/components/sidebar/SubTabBar';
import { useInputActions } from '@/hooks/useInputActions';
import { useSpatialFocusNav } from '@/hooks/useSpatialFocusNav';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { Slot } from '@/extensions/Slot';
import type { CharacterDisplay } from '@/types/character';
import { CardStatusRow, CardStatusItem } from '@/components/sidebar/CardStatusRow';
import { CHARACTER_SHAPES, characterShapePath, type CharacterShapeId } from '@/shared/characterShapes';
import { CharacterBadge } from '@/components/dashboard/CharacterBadge';

interface CharacterDetailsSidebarProps {
  character: Character | null;
  isMyCursor: boolean;
  /** True while the card's Edit action has this character open for editing. */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave: (id: string, patch: Pick<Character, 'name' | 'avatar' | 'color' | 'shape'>) => Promise<void>;
  /** Take this character as my cursor — reachable from the embedded card, so
   *  the choice can still be made when the sheet covers the page behind it. */
  onSetAsMyCursor?: () => void;
  onDelete?: (id: string) => void;
  /** Persists this character's look-and-feel choices (the Display tab). */
  onSaveDisplay?: (id: string, display: CharacterDisplay) => Promise<void>;
}

/**
 * Read view plus the edit form that used to expand inside the character card.
 * The card triggers edit mode through its overlay grid so the interaction is
 * the same keyboard/gamepad path as every other card action.
 */
export const CharacterDetailsSidebar: React.FC<CharacterDetailsSidebarProps> = ({
  character, isMyCursor, editing, onEditingChange, onSave, onSetAsMyCursor, onDelete, onSaveDisplay,
}) => {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [color, setColor] = useState('');
  const [shape, setShape] = useState<CharacterShapeId>('circle');
  const [saving, setSaving] = useState(false);
  // Which half of the sheet you are looking at. Two tabs rather than one long
  // scroll: who this character is, and how they like the app — related, but not
  // read at the same time, and the settings half is nine groups deep.
  const [tab, setTab] = useState<'about' | 'display'>('about');
  const isBottom = useHeaderAtBottom();

  // L1/R1 walk the tabs, the same bumpers that walk the want sheet's. A sheet
  // that can only be tabbed with a finger is a sheet the gamepad has to be put
  // down for, and the two sheets are read the same way.
  const cycleTab = (dir: 1 | -1) => {
    const order: Array<'about' | 'display'> = ['about', 'display'];
    setTab(prev => order[(order.indexOf(prev) + dir + order.length) % order.length]);
  };
  useInputActions({
    gamepadOnly: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    enabled: !!character && !editing,
    onTabForward:  () => cycleTab(1),
    onTabBackward: () => cycleTab(-1),
  });
  const nameRef = useRef<HTMLInputElement>(null);
  // The arrows step between this sheet's controls, by where they are — the same
  // stops the stick lands on. Off while the edit form is up, where the arrows
  // belong to the name box. See useSpatialFocusNav.
  const sheetRef = useRef<HTMLDivElement>(null);
  useSpatialFocusNav(sheetRef, !editing);

  // Seed from the character, whether or not the form is open.
  //
  // It used to seed only when edit mode opened, because only the form could
  // change anything. The read view carries the live controls now — a colour, a
  // design, a speed are chosen by pressing them, not by entering a mode first —
  // so the state behind them has to be right from the moment the sheet appears.
  useEffect(() => {
    if (!character) return;
    setName(character.name);
    setAvatar(character.avatar);
    setColor(character.color);
    // Anyone who has never chosen is a circle, which is what they have always
    // been drawn as — there is no "unset" state for a silhouette to be in.
    setShape(character.shape ?? 'circle');
  }, [character]);

  // The name box takes the caret when the form opens; nothing else does.
  useEffect(() => {
    if (editing) setTimeout(() => nameRef.current?.focus(), 50);
  }, [editing]);

  if (!character) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a character to view details</p>
      </div>
    );
  }

  // A pill is a decision, not a draft: picking a colour or a shape applies on
  // the press, like the Display tab beside it. The name keeps Save — it is
  // typed rather than chosen, and saving every keystroke would name the
  // character "a", "aa", "aaa" on the way to "aaron".
  // Avatar and colour ride the same call the name does, so the name goes with
  // them — whatever is in the box at the time, which is what the user can see.
  const applyIdentity = (next: { avatar?: string; color?: string; shape?: CharacterShapeId }) => {
    const av = next.avatar ?? avatar;
    const co = next.color  ?? color;
    // The shape rides here with them: it is what this person looks like to
    // everyone, saved by the same call, and a shape left out of the payload is
    // a shape cleared by the next rename (the endpoint replaces the record).
    const sh = next.shape  ?? shape;
    setAvatar(av); setColor(co); setShape(sh);
    if (name.trim()) void onSave(character.id, { name: name.trim(), avatar: av, color: co, shape: sh });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(character.id, { name: name.trim(), avatar, color, shape });
      onEditingChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    // The card's pill, in words (see components/sidebar/CardStatusRow).
    const pillItems: CardStatusItem[] = [
      ...(isMyCursor ? [{
        key: 'cursor',
        icon: <MousePointer2 className="w-3.5 h-3.5 text-amber-500" />,
        label: 'My CursorMan',
      }] : []),
    ];

    return (
      // flex-col, so the bar can be re-ordered under the body when the sheet
      // docks to the bottom. isBottom was already reaching SubTabBar — which
      // flipped its border and its indicator — while the bar itself stayed at
      // the top, so the sheet disagreed with itself about which way was up.
      // Same shape every other detail sheet uses; see WantDetailsSidebar.
      <div ref={sheetRef} className="h-full flex flex-col overflow-hidden">
        <SubTabBar<'about' | 'display'>
          tabs={[
            { id: 'about',   label: 'Character', icon: UserRound, hasData: true },
            { id: 'display', label: 'Display',   icon: Palette,   hasData: true },
          ]}
          active={tab}
          onChange={setTab}
          isBottom={isBottom}
        />
        <div className={classNames('flex-1 min-h-0 overflow-y-auto', isBottom && 'order-first')}>
        {tab === 'display' ? (
          onSaveDisplay
            ? <CharacterDisplaySettings character={character} onSave={(d) => onSaveDisplay(character.id, d)} />
            : null
        ) : (
        <TabContent>
          {/* The character's own card, at the top. On a phone the sheet covers
              the page behind it, so the card that would normally be tapped is
              out of reach — putting it here keeps every action it offers,
              "use as my cursor" above all, available from inside the sheet. */}
          <div className="mb-3 h-32 sm:h-36">
            <CharacterCard
              character={character}
              // Focused = EntityCard's `selected`; without it the long-press
              // overlay closes itself the moment it opens.
              isFocused
              keepFocus
              isMyCursor={isMyCursor}
              onClick={() => {}}
              onEdit={() => onEditingChange(true)}
              onDelete={(id) => onDelete?.(id)}
              onSetAsMyCursor={onSetAsMyCursor}
            />
          </div>
          {/* Whose cursor this is, and how to make it yours.
              Taking a character used to be an action on the card's overlay, so
              the sheet could tell you this character was not yours and give you
              no way to say otherwise. It is a press here — one line that reads
              as a state when it is settled and as an offer when it is not. */}
          <div className="mb-3">
            {isMyCursor ? (
              <CardStatusRow items={pillItems} />
            ) : onSetAsMyCursor ? (
              <button
                data-free-cursor-item
                onClick={onSetAsMyCursor}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                           bg-amber-50 text-amber-700 border border-amber-300
                           dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700
                           hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                Use as my CursorMan
              </button>
            ) : null}
          </div>
          {/* The live controls, not a report of them.
              Reading "Move speed: 1×" and then having to find Edit to change it
              makes a mode out of a decision that has none — these apply on the
              press, like the Display tab beside them. Edit is left for the name
              and the avatar, which are typed and picked rather than nudged. */}
          <TabSection title="Character">
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider"><Droplet className="w-3 h-3" />Colour</p>
                <div className="flex gap-1.5 flex-wrap">
                  {COLOR_PRESETS.map(col => (
                    <button
                      key={col}
                      data-free-cursor-item
                      onClick={() => applyIdentity({ color: col })}
                      title={col}
                      className={classNames(
                        'w-6 h-6 rounded-full transition-all',
                        (color || character.color) === col
                          ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-indigo-500 scale-110'
                          : 'hover:scale-110',
                      )}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              {/* What outline they stand in. A row of the shapes themselves,
                  drawn in this character's own colour — a list of the words
                  "star", "ship", "airplane" would make the one question this
                  answers (which do I want to be) unanswerable without trying
                  each. */}
              <div>
                <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider"><Shapes className="w-3 h-3" />Shape</p>
                <ShapeRow color={color || character.color} value={shape} onPick={sh => applyIdentity({ shape: sh })} />
              </div>

              {/* How they appear on a board an extension draws — the
                  canvas's tile, aura and speeds, from mywant-guiex. */}
              <Slot name="characterDetails" character={character} />
            </div>
          </TabSection>

          <TabSection title="ID">
            <p className="text-xs text-gray-500 dark:text-gray-500 font-mono break-all">{character.id}</p>
          </TabSection>
        </TabContent>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <TabContent>
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
          Edit character
        </p>

        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name…"
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onEditingChange(false);
          }}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
        />

        <div>
          <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider"><Smile className="w-3 h-3" />Avatar</p>
          <div className="flex flex-wrap gap-1">
            {AVATAR_PRESETS.map(a => (
              <button
                key={a}
                onClick={() => applyIdentity({ avatar: a })}
                className={classNames(
                  'w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all',
                  avatar === a
                    ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/40'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
                )}
              >{a}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider"><Droplet className="w-3 h-3" />Color</p>
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_PRESETS.map(col => (
              <button
                key={col}
                onClick={() => applyIdentity({ color: col })}
                className={classNames(
                  'w-6 h-6 rounded-full transition-all',
                  color === col ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-indigo-500 scale-110' : 'hover:scale-110',
                )}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider"><Shapes className="w-3 h-3" />Shape</p>
          <ShapeRow color={color} value={shape} onPick={sh => applyIdentity({ shape: sh })} />
        </div>

        <Slot name="characterDetails" character={character} />

        {/* The preview draws the badge the board draws (CharacterBadge), so
            the shape and the colour can be judged here rather than by walking
            out onto the canvas to look. */}
        <div className="flex items-center gap-2 py-1 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <CharacterBadge
            avatar={avatar}
            color={color}
            shape={shape}
            size={32}
            strokeWidth={2}
            fontSize={17}
            style={{ flexShrink: 0 }}
          />
          <span className="text-sm font-semibold truncate" style={{ color }}>{name || 'Preview'}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => onEditingChange(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </TabContent>
    </div>
  );
};

/**
 * The shapes, drawn rather than named, in the colour the character wears.
 *
 * Each button is the outline at badge weight and nothing else: no avatar inside
 * it, because the emoji is the same in every one of them and would be the only
 * thing the eye had to compare. The picked one is ringed like the colour
 * swatches above it — this is the same kind of choice, one row further down.
 */
const ShapeRow: React.FC<{
  color: string;
  value: CharacterShapeId;
  onPick: (shape: CharacterShapeId) => void;
}> = ({ color, value, onPick }) => (
  <div className="flex gap-1.5 flex-wrap">
    {CHARACTER_SHAPES.map(sh => (
      <button
        key={sh.id}
        // A stop for the roaming cursor, like every other pressable in this
        // sheet — a shape that can only be chosen with a finger is not a
        // choice on a gamepad.
        data-free-cursor-item
        onClick={() => onPick(sh.id)}
        title={sh.label}
        aria-label={sh.label}
        className={classNames(
          'w-7 h-7 rounded-md flex items-center justify-center transition-all',
          value === sh.id
            ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 scale-110'
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
        )}
      >
        <svg width={18} height={18} viewBox="0 0 100 100" style={{ overflow: 'visible' }} aria-hidden>
          <path d={characterShapePath(sh.id)} fill={color + '33'} stroke={color} strokeWidth={10} strokeLinejoin="round" />
        </svg>
      </button>
    ))}
  </div>
);
