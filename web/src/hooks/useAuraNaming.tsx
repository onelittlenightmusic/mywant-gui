import React, { useState } from 'react';
import { Tag, Trash2 } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { useCharacterStore } from '@/stores/characterStore';
import { useThingStore } from '@/stores/thingStore';
import { notify, type NoticeTarget } from '@/stores/noticeStore';
import { useThingNames } from '@/hooks/useThingNames';

// The value↔thing matching rules live in one place now — a road asks the same
// question a field card does, so neither owns the answer.
export { coordOf, metersBetween, PLACE_MATCH_RADIUS_M } from '@/utils/thingMatch';

interface UseAuraNamingArgs {
  /** The value being named. */
  value: unknown;
  /** Declared subtype; the value's own self-described type still wins over it. */
  subType?: string | null;
  /** Where to point the "pick a character first" notice, if anywhere. */
  notifyTarget?: NoticeTarget;
  /**
   * The want whose value this is. Recorded with the name, so the thing knows
   * which want produced the value it was given — a want computes values (an
   * image URL it resolved) that appear in no parameter, and those are exactly
   * the ones worth naming.
   */
  wantId?: string;
  /**
   * Where the name is written, when the default is wrong.
   *
   * A field card names the value IT is showing, which is what the default does
   * — clear the old name, set the new one, both against a kind and a value this
   * hook already resolved. A WANT card is naming something the server resolves
   * instead: the field a type nominated with `aura_mark_field`, which may not
   * be the value handed in here at all, and which brings a snapshot of the
   * other fields with it (see cardAuraName). Giving the caller the commit keeps
   * one pill, one set of keys and one look for both, while letting the two
   * writes be the different writes they are.
   */
  commit?: (name: string) => Promise<void>;
}

/**
 * The Aura naming flow, shared by every card that can name a value into its
 * catalog: state field cards, global state cards and parameter cards.
 *
 * One entry point (`open`) covers the whole life of a name — create, rename and
 * delete — because there is only ever one name per character per value. The
 * caller renders `editorNode` — the inline pill that takes over while naming —
 * inside a position:relative card. What the value already IS is not this hook's
 * business: the card wears that as a mark in its corner (see MarkButton).
 */
export function useAuraNaming({ value, subType, notifyTarget, wantId, commit }: UseAuraNamingArgs) {
  const characters = useCharacterStore(s => s.characters);
  // What this value is already called, and which catalog it names into — the
  // same question the mark on a card asks, asked in one place (useThingNames).
  const { catalogKind, namedDefs: rawNamedDefs } = useThingNames(value, subType);
  // Naming through this hook refreshes the ledger afterwards.
  const refreshThings = useThingStore(s => s.fetchThings);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const setAuraDefinition = useCharacterStore(s => s.setAuraDefinition);
  const clearAuraDefinition = useCharacterStore(s => s.clearAuraDefinition);

  const nameable = value !== null && value !== undefined && !(typeof value === 'string' && value === '');

  const suggestedName = (() => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const o = value as Record<string, unknown>;
      for (const k of ['name', 'address', 'city', 'label', 'title']) {
        if (typeof o[k] === 'string' && o[k]) return o[k] as string;
      }
      return '';
    }
    return typeof value === 'string' ? value : '';
  })();

  const [nameInput, setNameInput] = useState('');
  type NameEditor =
    | { mode: 'create' }
    | { mode: 'edit'; original: string; sel: 'rename' | 'delete' }
    | null;
  const [editor, setEditor] = useState<NameEditor>(null);

  // Names this value already carries, read from the thing ledger rather than
  // from each character's marks: a name belongs to the thing it names, and the
  // character file no longer keeps definitions at all.
  const namedDefs = rawNamedDefs
    .map(d => ({
      name: d.name,
      kind: d.subtype,
      color: characters.find(c => c.id === d.characterId)?.color ?? '#64748b',
      by: d.characterId ?? '',
    }));
  const myNamedDef = myCharacterId ? namedDefs.find(d => d.by === myCharacterId) ?? null : null;

  const open = () => {
    if (!nameable) return;
    // An aura mark is signed by its author, so with the default cursor there is
    // nobody to sign it and every write below would no-op. Say so rather than
    // swallowing the keypress.
    if (!myCharacterId) {
      notify(
        '名前を付けるにはキャラクターが要ります。Characters ページで自分のカーソルを選んでください。',
        notifyTarget,
      );
      return;
    }
    if (myNamedDef) {
      setNameInput(myNamedDef.name);
      setEditor({ mode: 'edit', original: myNamedDef.name, sel: 'rename' });
    } else {
      setNameInput(suggestedName);
      setEditor({ mode: 'create' });
    }
  };

  const commitName = async () => {
    const n = nameInput.trim();
    const original = editor?.mode === 'edit' ? editor.original : '';
    if (n && n !== original) {
      if (commit) {
        // The caller owns the write — a rename included, since the server
        // decides what is being renamed.
        await commit(n);
      } else {
        // Rename = drop the old name, add the new one — never a second tag.
        if (original) await clearAuraDefinition(catalogKind, original);
        await setAuraDefinition(catalogKind, n, value, wantId);
      }
      // The names live in the ledger now, so re-read it rather than trusting a
      // local copy that no longer exists on the character.
      void refreshThings();
    }
    setEditor(null);
  };

  const deleteName = async () => {
    const original = editor?.mode === 'edit' ? editor.original : '';
    if (original) {
      await clearAuraDefinition(catalogKind, original);
      void refreshThings();
    }
    setEditor(null);
  };

  // Focus stays in the input the whole time; arrows just move the Delete
  // highlight, and Enter acts on whatever is highlighted.
  const onEditorKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editor?.mode === 'edit' && editor.sel === 'delete') deleteName();
      else commitName();
    } else if (e.key === 'Escape') {
      setEditor(null);
    } else if (editor?.mode === 'edit' && e.key.startsWith('Arrow')) {
      e.preventDefault();
      setEditor(ed => ed && ed.mode === 'edit'
        ? { ...ed, sel: ed.sel === 'delete' ? 'rename' : 'delete' }
        : ed);
    }
  };

  // X used to be bound here, per card. It is bound by the card GRID now (see
  // useCardGridNavigation's onButtonX), because the grid is what holds the
  // exclusive input slot while one of its cards is focused: a binding made
  // here answered the keyboard and was silent on the gamepad, whose actions go
  // to the slot's owner and to nobody else. The flow is unchanged — X still
  // opens this editor on the focused card — but there is one route to it.

  const editorNode = editor ? (
    <div
      className="absolute bottom-0.5 left-1 z-50 flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={classNames(
        'flex items-center gap-0.5 rounded-full pl-1.5 pr-1 py-0.5 bg-white dark:bg-gray-900 shadow ring-1',
        editor.mode === 'edit' && editor.sel === 'delete' ? 'ring-gray-300 dark:ring-gray-700' : 'ring-emerald-400',
      )}>
        <Tag className="w-2.5 h-2.5 flex-shrink-0 text-emerald-500" />
        <input
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={onEditorKeyDown}
          onBlur={() => { if (editor.mode === 'create') commitName(); else setEditor(null); }}
          placeholder={`name this ${catalogKind}…`}
          className="w-24 bg-transparent text-[11px] font-semibold outline-none"
        />
      </div>
      {editor.mode === 'edit' && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); deleteName(); }}
          className={classNames(
            'pointer-events-auto flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white shadow',
            editor.sel === 'delete' ? 'bg-red-600 ring-2 ring-red-300' : 'bg-red-500/80',
          )}
          title="Delete this name"
        >
          <Trash2 className="w-2.5 h-2.5" /> Delete
        </button>
      )}
    </div>
  ) : null;

  return {
    /** False for empty values — nothing to name. */
    nameable,
    catalogKind,
    namedDefs,
    myNamedDef,
    isOpen: !!editor,
    open,
    editorNode,
  };
}
