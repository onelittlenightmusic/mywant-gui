import React, { useState, useEffect } from 'react';
import { Plus, X, Type, Braces, Save, Trash2 } from 'lucide-react';
import { Want } from '@/types/want';
import { useWantStore } from '@/stores/wantStore';
import { useDataTypes } from '@/hooks/useDataTypes';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { EnumToggleGroup } from '@/components/common/EnumToggleGroup';
import { removeWantStateKey } from '@/api/wantState';

// Kept in sync with the engine (mywant/engine/core/derived_fields.go).
export const DERIVED_FIELDS_LABEL = 'mywant.io/derived-fields';

type TextToken = { field: string } | { literal: string };
interface TextExpr { kind: 'text'; tokens: TextToken[] }
interface JsonExpr { kind: 'json'; entries: { key: string; value: TextExpr }[] }
type Expr = TextExpr | JsonExpr;
export interface DerivedDef {
  key: string;
  expr: Expr;
  /** Optional data-type catalog key (datatypes.yaml) hinting how to render this
   * field's value. For JSON-mode fields, this should match the value's own
   * self-descriptive `type` entry (see the self-descriptive object convention) —
   * selecting one here auto-adds/updates that entry. */
  subType?: string;
}

/** Reads the GUI-authored derived-field definitions off a want's label. Every key
 * here is "user custom" — added via the add-field UI rather than the want type's
 * declared schema — so callers use this to separate custom fields for display. */
export function readDefs(want: Want): DerivedDef[] {
  try {
    const raw = want.metadata?.labels?.[DERIVED_FIELDS_LABEL];
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Removes a derived-field definition and its computed state key. The label patch
 * alone would leave the last-computed value orphaned in state.current forever, since
 * the engine's evaluateDerivedFields() only ever adds keys, never prunes removed ones. */
export async function deleteDerivedField(want: Want, key: string): Promise<void> {
  const id = want.metadata?.id || want.id;
  if (!id) return;
  const defs = readDefs(want).filter(d => d.key !== key);
  await useWantStore.getState().updateWantFields(id, { labels: { [DERIVED_FIELDS_LABEL]: JSON.stringify(defs) } });
  removeWantStateKey(id, key);
}

const isField = (t: TextToken): t is { field: string } => 'field' in t;

/** Token row editor for a text expression (field pills + free-text literals). */
const TokenRow: React.FC<{
  tokens: TextToken[];
  fieldNames: string[];
  onChange: (t: TextToken[]) => void;
}> = ({ tokens, fieldNames, onChange }) => (
  <div
    className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 min-h-[40px]"
    onDragOver={e => { if (e.dataTransfer.types.includes('application/mywant-field')) e.preventDefault(); }}
    onDrop={e => { const f = e.dataTransfer.getData('application/mywant-field'); if (f) { e.preventDefault(); onChange([...tokens, { field: f }]); } }}
  >
    {tokens.length === 0 && (
      <span className="text-[11px] text-gray-400 dark:text-gray-500">フィールドか自由文字列をドロップ／追加</span>
    )}
    {tokens.map((t, i) => (
      <span key={i} className="inline-flex items-center gap-1">
        {isField(t) ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-[11px] font-medium">
            {t.field}
          </span>
        ) : (
          <input
            value={t.literal}
            onChange={e => { const next = tokens.slice(); next[i] = { literal: e.target.value }; onChange(next); }}
            placeholder="文字"
            className="px-1.5 py-0.5 w-16 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[11px] text-gray-800 dark:text-gray-100 outline-none focus:border-blue-400"
          />
        )}
        <button
          onClick={() => onChange(tokens.filter((_, j) => j !== i))}
          className="text-gray-400 hover:text-red-500"
          title="削除"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    ))}
    <select
      value=""
      onChange={e => { if (e.target.value) onChange([...tokens, { field: e.target.value }]); e.currentTarget.value = ''; }}
      className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[11px] text-gray-600 dark:text-gray-300 outline-none"
      title="フィールドを追加"
    >
      <option value="">＋ field</option>
      {fieldNames.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
    <button
      onClick={() => onChange([...tokens, { literal: '' }])}
      className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      title="自由文字列を追加"
    >
      ＋ text
    </button>
  </div>
);

export const DerivedFieldEditor: React.FC<{
  want: Want;
  fieldNames: string[];
  onSaved?: () => void;
  /** Set to reopen the form pre-filled for editing an existing derived field
   * (e.g. from the field card overlay's Edit action). One-shot — consumed via
   * onEditConsumed once applied, same pattern as StateFieldCard's `activated`. */
  editTarget?: DerivedDef | null;
  onEditConsumed?: () => void;
}> = ({ want, fieldNames, onSaved, editTarget, onEditConsumed }) => {
  const { types: dataTypeCatalog } = useDataTypes();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [mode, setMode] = useState<'text' | 'json'>('text');
  const [textTokens, setTextTokens] = useState<TextToken[]>([]);
  const [jsonEntries, setJsonEntries] = useState<{ key: string; tokens: TextToken[] }[]>([{ key: '', tokens: [] }]);
  const [subType, setSubType] = useState('');
  const [saving, setSaving] = useState(false);
  // Non-null while editing an existing field — lets handleSave rename the key
  // (remove the old entry/state value instead of leaving it orphaned).
  const [originalKey, setOriginalKey] = useState<string | null>(null);

  const reset = () => { setKey(''); setMode('text'); setTextTokens([]); setJsonEntries([{ key: '', tokens: [] }]); setSubType(''); setOriginalKey(null); };

  useEffect(() => {
    if (!editTarget) return;
    setKey(editTarget.key);
    setOriginalKey(editTarget.key);
    setSubType(editTarget.subType ?? '');
    if (editTarget.expr.kind === 'json') {
      setMode('json');
      setJsonEntries(editTarget.expr.entries.map(e => ({ key: e.key, tokens: e.value.tokens })));
    } else {
      setMode('text');
      setTextTokens(editTarget.expr.tokens);
    }
    setOpen(true);
    onEditConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget]);

  // Subtype picker options: string-based subtypes for Text mode, object-based
  // subtypes for JSON mode (the self-descriptive object convention — see
  // datatypes.yaml). Switching mode clears any prior selection since the two
  // option sets don't overlap.
  const subTypeOptions = Object.entries(dataTypeCatalog)
    .filter(([, info]) => info.baseType === (mode === 'json' ? 'object' : 'string'))
    .map(([name, info]) => ({ value: name, label: name, icon: resolveLucideIcon(info.icon) ?? undefined }));

  const handleModeChange = (next: 'text' | 'json') => {
    setMode(next);
    setSubType('');
  };

  const handleSubTypeChange = (next: string) => {
    setSubType(next);
    // Self-descriptive convention: a JSON-mode field with an object subtype
    // must carry its own `type` entry naming that subtype. Auto-add/update it
    // so the resulting value is self-descriptive without the user having to
    // wire it up by hand.
    if (mode === 'json' && next) {
      setJsonEntries(prev => {
        const idx = prev.findIndex(e => e.key === 'type');
        const typeEntry = { key: 'type', tokens: [{ literal: next }] };
        if (idx === -1) return [...prev, typeEntry];
        const copy = prev.slice();
        copy[idx] = typeEntry;
        return copy;
      });
    }
  };

  const handleSave = async () => {
    const id = want.metadata?.id || want.id;
    if (!id || !key.trim()) return;
    const expr: Expr = mode === 'text'
      ? { kind: 'text', tokens: textTokens }
      : { kind: 'json', entries: jsonEntries.filter(e => e.key.trim()).map(e => ({ key: e.key.trim(), value: { kind: 'text', tokens: e.tokens } })) };
    const defs = readDefs(want).filter(d => d.key !== key.trim() && d.key !== originalKey);
    defs.push({ key: key.trim(), expr, ...(subType ? { subType } : {}) });
    setSaving(true);
    try {
      // The label alone (PATCH): the want's runtime state is not sent back,
      // so it cannot be reset by a stale copy.
      await useWantStore.getState().updateWantFields(id, { labels: { [DERIVED_FIELDS_LABEL]: JSON.stringify(defs) } });
      // Renamed while editing: the old key's computed value would otherwise stay
      // orphaned in state.current forever (evaluateDerivedFields only ever adds).
      if (originalKey && originalKey !== key.trim()) {
        removeWantStateKey(id, originalKey);
      }
      reset();
      setOpen(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    // Same h-14 footprint as StateFieldCard/JsonFieldCard so this sits as an
    // ordinary grid cell in UserCustomSection's card grid, not a separate
    // full-width row below it.
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-14 w-full flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> add field
      </button>
    );
  }

  return (
    <div className="col-span-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2">
      {originalKey && (
        <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">
          editing: {originalKey}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="new field key"
          className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-100 outline-none focus:border-blue-400"
        />
        <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
          <button onClick={() => handleModeChange('text')} className={`px-2 py-1 flex items-center gap-1 text-[11px] ${mode === 'text' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'}`}><Type className="w-3 h-3" />Text</button>
          <button onClick={() => handleModeChange('json')} className={`px-2 py-1 flex items-center gap-1 text-[11px] ${mode === 'json' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'}`}><Braces className="w-3 h-3" />JSON</button>
        </div>
      </div>

      {/* Subtype picker (optional) — same toggle-pill style as the choice want card */}
      {subTypeOptions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            subtype (optional)
          </div>
          <EnumToggleGroup
            value={subType}
            onChange={handleSubTypeChange}
            options={[{ value: '', label: 'none' }, ...subTypeOptions]}
            wrap
          />
        </div>
      )}

      {mode === 'text' ? (
        <TokenRow tokens={textTokens} fieldNames={fieldNames} onChange={setTextTokens} />
      ) : (
        <div
          className="space-y-2 rounded-lg"
          onDragOver={ev => { if (ev.dataTransfer.types.includes('application/mywant-field')) ev.preventDefault(); }}
          onDrop={ev => {
            const f = ev.dataTransfer.getData('application/mywant-field');
            if (!f) return;
            ev.preventDefault();
            // Dropping a field card adds a {key: field, value: field} pair.
            const cleaned = jsonEntries.filter(x => x.key.trim() || x.tokens.length > 0);
            setJsonEntries([...cleaned, { key: f, tokens: [{ field: f }] }]);
          }}
        >
          {jsonEntries.map((e, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <input
                value={e.key}
                onChange={ev => { const next = jsonEntries.slice(); next[i] = { ...next[i], key: ev.target.value }; setJsonEntries(next); }}
                placeholder="key"
                className="mt-1 px-2 py-1 w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-[11px] text-gray-800 dark:text-gray-100 outline-none focus:border-blue-400"
              />
              <span className="mt-1.5 text-gray-400">:</span>
              <div className="flex-1">
                <TokenRow tokens={e.tokens} fieldNames={fieldNames} onChange={t => { const next = jsonEntries.slice(); next[i] = { ...next[i], tokens: t }; setJsonEntries(next); }} />
              </div>
              <button onClick={() => setJsonEntries(jsonEntries.filter((_, j) => j !== i))} className="mt-1 text-gray-400 hover:text-red-500" title="行を削除"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setJsonEntries([...jsonEntries, { key: '', tokens: [] }])} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">＋ key</button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={() => { reset(); setOpen(false); }} className="px-2.5 py-1 rounded text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">キャンセル</button>
        <button onClick={handleSave} disabled={saving || !key.trim()} className="inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-500 disabled:opacity-50">
          <Save className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
};
