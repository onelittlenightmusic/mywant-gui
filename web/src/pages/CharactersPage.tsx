import { useHostPanel } from '@/lib/nativeHost';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Users, MousePointer2, User } from 'lucide-react';
import { useAppHeader } from '@/hooks/useAppHeader';
import { useAppSidebar } from '@/hooks/useAppSidebar';
import { CharacterCard } from '@/components/characters/CharacterCard';
import { EntityCard, EntityCardAction } from '@/components/common/EntityCard';
import { CardCursorMan } from '@/components/dashboard/CardCursorMan';
import { CursorManSVG } from '@/components/dashboard/CursorManIcon';
import { Character, CharacterDisplay } from '@/types/character';
import { apiClient } from '@/api/client';
import { useSSEEvent } from '@/hooks/useSSEEvent';
import { classNames } from '@/utils/helpers';
import { useGridFocus } from '@/hooks/useGridFocus';
import { useInputActions } from '@/hooks/useInputActions';
import { useGridCols } from '@/hooks/useGridCols';
import { GRID_COLUMN_WIDTH } from '@/utils/gridUtils';
import { useCharacterStore } from '@/stores/characterStore';
import { AVATAR_PRESETS, COLOR_PRESETS } from '@/components/characters/characterPresets';
import { CharacterDetailsSidebar } from '@/components/sidebar/CharacterDetailsSidebar';
import { useCardOverlayStore, entityCardId } from '@/stores/cardOverlayStore';

interface NewCharForm {
  name: string;
  avatar: string;
  color: string;
}

export default function CharactersPage() {
  const toggleCardOverlay = useCardOverlayStore(s => s.toggleCardOverlay);
  const [characters, setCharacters] = useState<Character[]>([]);
  // Which character the details sidebar shows, and whether it is in edit mode
  // (opened by the card's Edit overlay action).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<NewCharForm>({ name: '', avatar: '🧙', color: '#6366f1' });

  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const myDefaultColor = useCharacterStore(s => s.myDefaultCursorColor);
  const setMyCharacter = useCharacterStore(s => s.setMyCharacter);
  const setMyDefaultCursorColor = useCharacterStore(s => s.setMyDefaultCursorColor);
  const [saving, setSaving] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const cols = useGridCols(gridRef);
  const newNameRef = useRef<HTMLInputElement>(null);
  const charactersRef = useRef(characters);
  charactersRef.current = characters;

  // total items = Default card + characters + "add" card
  const DEFAULT_IDX = 0;
  const totalItems = 1 + characters.length + 1;
  const addCardIdx = 1 + characters.length;
  const charIdxOffset = 1;

  const { focusedIdx, setFocusedIdx } = useGridFocus({
    count: totalItems,
    cols,
    enabled: !creating,
    onConfirm: (idx) => {
      if (idx === DEFAULT_IDX) {
        setMyCharacter(null);
      } else if (idx === addCardIdx) {
        startCreating();
      }
      // Character cards: focus already drives the details sidebar, and
      // "set as my cursor" is an explicit action on the card overlay.
    },
    onContextMenu: (idx) => {
      const char = charactersRef.current[idx - charIdxOffset];
      if (char) toggleCardOverlay(entityCardId('character', char.id));
    },
  });

  const load = useCallback(async () => {
    try {
      const list = await apiClient.listCharacters();
      setCharacters(list);
      // Keep characterStore in sync so CursorManIcon reflects latest
      useCharacterStore.setState({ characters: list });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Saves made elsewhere — an extension's controls in the sheet, another tab —
  // arrive as this event; the list here is the page's own copy.
  useSSEEvent('character_changed', () => { void load(); });

  const startCreating = () => {
    setCreating(true);
    setNewForm({ name: '', avatar: '🧙', color: '#6366f1' });
    setTimeout(() => newNameRef.current?.focus(), 50);
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true);
    try {
      await apiClient.createCharacter({ name: newForm.name.trim(), avatar: newForm.avatar, color: newForm.color });
      await load();
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  // While the new-character form is open, useGridFocus above is disabled
  // (enabled: !creating), so this hook owns confirm/cancel for the form.
  //
  // captureInput: keyboard and gamepad both route here. Enter/Escape in this
  // form submit and cancel it — they are not text editing, so there is no
  // reason for the name input to implement them a second time.
  //
  // ignoreWhenInputFocused: false is required, not incidental. The name input
  // auto-focuses when the form opens, so confirm/cancel have to work *while*
  // the caret is in it. Ordinary typing is unaffected: only Enter and Escape
  // are claimed, and useInputActions leaves character keys and Space alone in
  // text fields.
  useInputActions({
    enabled: creating,
    captureInput: true,
    ignoreWhenInputFocused: false,
    onConfirm: () => { if (!saving) handleCreate(); },
    onCancel: () => setCreating(false),
  });

  const handleSave = async (id: string, patch: Pick<Character, 'name' | 'avatar' | 'color' | 'shape'>) => {
    await apiClient.updateCharacter(id, patch);
    await load();
  };

  const handleSaveDisplay = async (id: string, display: CharacterDisplay) => {
    await apiClient.setCharacterDisplay(id, display);
    await load();
  };

  const handleDelete = async (id: string) => {
    await apiClient.deleteCharacter(id);
    if (myCharacterId === id) setMyCharacter(null);
    await load();
  };

  // Closed on arrival: a panel about nothing was the first thing the page put
  // up. The 📊 Summary button below opens it on demand.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const myChar = characters.find(c => c.id === myCharacterId);
  // Grid focus drives the details sidebar (the Default and Add cards have no
  // detail view, hence the offset check).
  const focusedChar = focusedIdx >= charIdxOffset && focusedIdx < addCardIdx
    ? characters[focusedIdx - charIdxOffset] ?? null
    : null;

  useAppHeader({
    onCreateWant: startCreating,
    title: 'Characters',
    createButtonLabel: 'Add Character',
    itemCount: characters.length,
    itemLabel: 'character',
  });

  const panelRoute = useHostPanel(
    creating ? '__new' : focusedChar ? focusedChar.id : summaryOpen ? '__summary' : null,
    (id) => {
      if (id === '__new') { setCreating(true); return; }
      if (id === '__summary') { setSummaryOpen(true); return; }
      const idx = characters.findIndex(c => c.id === id);
      if (idx < 0) return false;
      setFocusedIdx(idx + charIdxOffset);
    },
    characters.length,
  );

  useAppSidebar({
    // In an app on a phone, the app's own sheet (lib/nativeHost, useHostPanel).
    hostRoute: panelRoute,
    open: creating || summaryOpen || !!focusedChar,
    title: creating ? 'New character' : focusedChar ? focusedChar.name : 'Summary',
    onClose: () => {
      if (creating) setCreating(false);
      else if (focusedChar) { setEditingId(null); setFocusedIdx(-1); }
      else setSummaryOpen(false);
    },
    // A detail panel opens on its subject's card and takes the host's identity
    // row — one name, one close, in the same place on every page. The Summary
    // half and the new-character form keep the header: neither has a card of
    // its own to say what it is with.
    chromeless: !creating && !!focusedChar,
    // A new character is edited where an existing one is: the card grid stays a
    // grid of characters, rather than growing a form in the middle of it.
    content: creating ? (
      <NewCharacterForm
        form={newForm}
        nameRef={newNameRef}
        onChange={setNewForm}
        onSave={handleCreate}
        onCancel={() => setCreating(false)}
        saving={saving}
      />
    ) : focusedChar ? (
      <CharacterDetailsSidebar
        character={focusedChar}
        isMyCursor={myCharacterId === focusedChar.id}
        editing={editingId === focusedChar.id}
        onEditingChange={(on) => setEditingId(on ? focusedChar.id : null)}
        onSave={handleSave}
        onSaveDisplay={handleSaveDisplay}
        onSetAsMyCursor={() => setMyCharacter(focusedChar.id)}
        onDelete={handleDelete}
      />
    ) : (
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Statistics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{characters.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Characters</div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
              <div className="text-2xl">{myChar ? myChar.avatar : '🤖'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">My cursor</div>
            </div>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">My cursor</h3>
          <div className="flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <span className="text-xl" style={{ color: myChar?.color ?? myDefaultColor }}>{myChar ? myChar.avatar : '🤖'}</span>
            <span className="text-sm text-gray-800 dark:text-gray-100">{myChar ? myChar.name : 'Default CursorMan'}</span>
          </div>
        </div>
      </div>
    ),
  });

  return (
    <div className="flex flex-col h-full bg-transparent text-gray-900 dark:text-gray-100">
      {!summaryOpen && !focusedChar && !creating && (
        <button
          onClick={() => setSummaryOpen(true)}
          className="fixed z-40 right-3 bottom-3 px-3 py-2 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-lg hover:bg-indigo-500"
        >
          📊 Summary
        </button>
      )}
      {/* The panel's width is reserved whether or not a panel is open — the
          same as every other page. Reserving it only when something was open
          made the grid reflow the moment you selected a card: four columns
          became three, and every card moved out from under the pointer that
          had just chosen one. */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-24 lg:mr-[480px]">
        {/* Grid — always shown (Default card is always first) */}
        <div
          ref={gridRef}
          className="grid gap-3 sm:gap-[26px] lg:gap-[34px]"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${GRID_COLUMN_WIDTH}px, 100%), 1fr))` }}
        >
          {/* Default CursorMan card */}
          <DefaultCursorCard
            isFocused={focusedIdx === DEFAULT_IDX}
            isSelected={myCharacterId === null}
            currentColor={myDefaultColor}
            onFocus={() => setFocusedIdx(DEFAULT_IDX)}
            onSetAsCursor={() => { setFocusedIdx(DEFAULT_IDX); setMyCharacter(null); }}
            onColorChange={setMyDefaultCursorColor}
          />

          {/* Character cards */}
          {characters.map((c, idx) => (
            <div key={c.id} className="group">
              <CharacterCard
                character={c}
                isFocused={focusedIdx === idx + charIdxOffset}
                isMyCursor={myCharacterId === c.id}
                onDelete={handleDelete}
                onClick={() => { setFocusedIdx(idx + charIdxOffset); setEditingId(null); }}
                onEdit={() => { setFocusedIdx(idx + charIdxOffset); setEditingId(c.id); }}
                onSetAsMyCursor={() => setMyCharacter(c.id)}
              />
            </div>
          ))}

          {/* Empty hint (no characters yet) inside grid */}
          {characters.length === 0 && !creating && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
                Create characters and assign them to devices.
              </p>
            </div>
          )}

          {/* "+ Add" card — the form itself opens in the sidebar */}
          {(
            <div className="relative h-full" style={{ isolation: 'isolate' }}>
              <CardCursorMan visible={focusedIdx === addCardIdx} />
              <button
                onClick={() => { setFocusedIdx(addCardIdx); startCreating(); }}
                data-free-cursor-item
                className={classNames(
                  'w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all duration-200',
                  focusedIdx === addCardIdx
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-cyan-400/60'
                    : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10',
                  'text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400',
                )}
              >
                <Plus className="w-6 h-6" />
                <span className="text-sm font-semibold">Add Character</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/* ── New-character form, rendered in the sidebar ─────────────────────────── */
interface NewCharacterFormProps {
  form: NewCharForm;
  nameRef: React.RefObject<HTMLInputElement>;
  onChange: (form: NewCharForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const NewCharacterForm: React.FC<NewCharacterFormProps> = ({
  form, nameRef, onChange, onSave, onCancel, saving,
}) => (
  // No card chrome or heading: the sidebar already frames this and titles it.
  <div className="flex flex-col gap-3 p-4">

    {/* No onKeyDown: Enter/Escape are handled once, by the page's
        useInputActions hook, so keyboard and gamepad take the same path. They
        submit / cancel the form rather than edit text, so this input has no
        business defining them itself. */}
    <input
      ref={nameRef}
      type="text"
      value={form.name}
      onChange={e => onChange({ ...form, name: e.target.value })}
      placeholder="Name…"
      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
    />

    <div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">Avatar</p>
      <div className="flex flex-wrap gap-1">
        {AVATAR_PRESETS.map(a => (
          <button
            key={a}
            onClick={() => onChange({ ...form, avatar: a })}
            className={classNames(
              'w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all',
              form.avatar === a
                ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/40'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
            )}
          >{a}</button>
        ))}
      </div>
    </div>

    <div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">Color</p>
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_PRESETS.map(col => (
          <button
            key={col}
            onClick={() => onChange({ ...form, color: col })}
            className={classNames(
              'w-6 h-6 rounded-full transition-all',
              form.color === col ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-indigo-500 scale-110' : 'hover:scale-110',
            )}
            style={{ backgroundColor: col }}
          />
        ))}
      </div>
    </div>

    <div className="flex items-center gap-2 py-1 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: form.color + '28', border: `2px solid ${form.color}` }}
      >{form.avatar}</div>
      <span className="text-sm font-semibold truncate" style={{ color: form.color }}>{form.name || 'Preview'}</span>
    </div>

    <div className="flex gap-2">
      <button
        onClick={onSave}
        disabled={saving || !form.name.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        {saving ? 'Creating…' : 'Create'}
      </button>
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="w-3.5 h-3.5 flex items-center justify-center text-xs">✕</span>
        Cancel
      </button>
    </div>
  </div>
);

/* ── Default CursorMan card ──────────────────────────────────────────────── */
interface DefaultCursorCardProps {
  isFocused: boolean;
  isSelected: boolean;
  currentColor: string;
  /** Focus/open the card only — does NOT change who "me" is (matches CharacterCard). */
  onFocus: () => void;
  /** Explicitly adopt the default CursorMan as my character (overlay action only). */
  onSetAsCursor: () => void;
  onColorChange: (color: string) => void;
}

/**
 * キャラクターカードと同じ EntityCard で描く（枠線・フォーカス枠・下部バー・
 * オーバーレイ操作の見た目を他のキャラクターと揃えるため）。
 * このカード固有なのは色プリセットだけで、それは face の上に重ねて置く。
 */
const DefaultCursorCard: React.FC<DefaultCursorCardProps> = ({
  isFocused, isSelected, currentColor, onFocus, onSetAsCursor, onColorChange,
}) => {
  const actions: EntityCardAction[] = [
    {
      icon: <MousePointer2 className="w-5 h-5 text-white" />,
      label: 'Cursor',
      onClick: onSetAsCursor,
      tone: 'caution',
      disabled: isSelected,
      title: isSelected ? 'Already your CursorMan' : 'Set as my CursorMan',
    },
  ];

  return (
    <EntityCard
      navId={entityCardId('character', 'default-cursorman')}
      title="Default CursorMan"
      selected={isFocused}
      onView={onFocus}
      actions={actions}
      iconBadgeColor={currentColor}
      icon={<CursorManSVG size={44} color={currentColor} />}
      titleIcon={<User className="h-2 w-2 sm:h-3.5 sm:w-3.5 flex-shrink-0" style={{ color: currentColor }} />}
      badges={isSelected ? <MousePointer2 className="w-3 h-3 text-amber-500 flex-shrink-0" /> : undefined}
    >
      {/* 色プリセット。カード本体の onClick を拾わないよう伝播を止める。 */}
      <div
        className="absolute top-1.5 left-1.5 right-1.5 z-20 flex flex-wrap gap-1"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {COLOR_PRESETS.map(col => (
          <button
            key={col}
            onClick={() => { onColorChange(col); onFocus(); }}
            className={classNames(
              'w-4 h-4 rounded-full transition-all',
              currentColor === col && isSelected
                ? 'ring-2 ring-offset-1 dark:ring-offset-gray-800 ring-amber-500 scale-110'
                : 'hover:scale-110',
            )}
            style={{ backgroundColor: col }}
          />
        ))}
      </div>
      {/* My CursorMan badge — bottom-right pill, thing-card style. */}
      {isSelected && (
        <div
          className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 pointer-events-none"
          title="My CursorMan"
        >
          <MousePointer2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
        </div>
      )}
    </EntityCard>
  );
};
