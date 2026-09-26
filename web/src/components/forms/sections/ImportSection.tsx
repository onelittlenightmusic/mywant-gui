import React, { useState, useCallback, useEffect, useId } from 'react';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { ArrowDownToLine, ArrowRight, Globe, LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { StateDef } from '@/types/wantType';
import { classNames } from '@/utils/helpers';
import { CardGridShell, TEAL_SCHEME } from '@/components/forms/CardPrimitives';
import { getTypeStyle } from '@/components/forms/sections/ParameterGridSection';
import { useDataTypes } from '@/hooks/useDataTypes';

interface ImportSectionProps {
  imports: Record<string, string>;
  onImportsChange: (imports: Record<string, string>) => void;
  stateDefs?: StateDef[];
  globalStateKeys?: string[];
  initialAddKey?: string | null;
  onInitialKeyConsumed?: () => void;
  isActive?: boolean;
  focusRequest?: number;
  /** Arrow-key ways out of this grid — see useCardGridNavigation. */
  onExitTop?: () => void;
  onExitBottom?: () => void;
}

const inputCls = classNames(
  'w-full text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 mb-1.5',
  'text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600',
  'border-teal-200 dark:border-teal-700',
  'focus:outline-none focus:ring-1 focus:ring-teal-400',
);

export const ImportSection: React.FC<ImportSectionProps> = ({
  imports,
  onImportsChange,
  stateDefs,
  globalStateKeys = [],
  initialAddKey,
  onInitialKeyConsumed,
  isActive = true,
  focusRequest,
  onExitTop,
  onExitBottom,
}) => {
  const { getTypeInfo } = useDataTypes();
  const uid = useId();
  const datalistId = `import-global-keys-${uid}`;
  const localKeyDatalistId = `import-local-keys-${uid}`;

  const [adding, setAdding] = useState(false);
  const [newGlobalKey, setNewGlobalKey] = useState('');
  const [newLocalKey, setNewLocalKey] = useState('');
  const [navFocused, setNavFocused] = useState(-1);

  useEffect(() => {
    if (!initialAddKey) return;
    setNewLocalKey(initialAddKey);
    setAdding(true);
    onInitialKeyConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddKey]);

  // entries: [globalKey, localKey][]
  const entries = Object.entries(imports);

  const navCount = entries.length + (adding ? 0 : 1);

  const { gridProps: navGridProps } = useCardGridNavigation({
    count: navCount,
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    onConfirm: (i) => { if (i === entries.length) setAdding(true); },
    focusRequest,
    onExitTop,
    onExitBottom,
  });

  useEffect(() => {
    if (!isActive) setNavFocused(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const stateFields = stateDefs?.filter(s => s.name !== 'final_result') ?? [];
  const localKeySuggestions = stateFields.filter(
    s => !Object.values(imports).includes(s.name) || s.name === newLocalKey,
  );

  const handleSave = useCallback(() => {
    const gk = newGlobalKey.trim();
    const lk = newLocalKey.trim();
    if (!gk || !lk) return;
    const next = { ...imports, [gk]: lk };
    onImportsChange(next);
    setNewGlobalKey('');
    setNewLocalKey('');
    setAdding(false);
  }, [imports, onImportsChange, newGlobalKey, newLocalKey]);

  const handleCancel = useCallback(() => {
    setAdding(false);
    setNewGlobalKey('');
    setNewLocalKey('');
  }, []);

  const handleDelete = useCallback((i: number) => {
    const [gk] = entries[i];
    const next = { ...imports };
    delete next[gk];
    onImportsChange(next);
  }, [entries, imports, onImportsChange]);

  // Suggestion list: union of provided global state keys — exclude already-imported keys (except current editing)
  const suggestions = Array.from(new Set(globalStateKeys)).filter(
    k => !(k in imports) || k === newGlobalKey,
  );

  return (
    <>
      <CardGridShell
      scheme={TEAL_SCHEME}
      BgIcon={ArrowDownToLine}
      count={entries.length}
      editingIndex={adding ? entries.length : null}
      navFocusedIndex={navFocused}
      navGridProps={navGridProps}
      addLabel="Add import"
      onAdd={() => setAdding(true)}
      onDeleteItem={handleDelete}
      onSave={handleSave}
      onCancel={handleCancel}
      saveDisabled={!newGlobalKey.trim() || !newLocalKey.trim()}
      // Same type-driven tint the parameter and state field cards use, so a
      // card's colour tells you what kind of value it carries.
      getItemScheme={(i) => {
        const [, lk] = entries[i];
        const sd = stateDefs?.find(s => s.name === lk);
        return sd ? getTypeStyle(sd.type, false, null).scheme : null;
      }}
      getItemBgIcon={(i) => {
        const [, lk] = entries[i];
        const sd = stateDefs?.find(s => s.name === lk);
        if (!sd) return null;
        const dtInfo = getTypeInfo(sd.subType || sd.type);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Icon = (LucideIcons as any)[dtInfo.icon] as LucideIcon | undefined;
        if (!Icon) return null;
        return { BgIcon: Icon, bgIconStyle: { color: dtInfo.color } };
      }}
      renderItemHeaderLeft={(i) => {
        const [gk] = entries[i];
        return (
          <span className="text-[11px] font-semibold card-ink truncate leading-none font-mono">
            {gk}
          </span>
        );
      }}
      renderItemBody={(i) => {
        const [, lk] = entries[i];
        return (
          <div className="flex items-center gap-1">
            <ArrowRight className="w-2.5 h-2.5 text-teal-400 dark:text-teal-500 flex-shrink-0 opacity-40" />
            <span className="font-mono text-xs text-teal-700 dark:text-teal-300 truncate">{lk}</span>
          </div>
        );
      }}
      renderFormHeader={(isNew) => (
        <>
          <ArrowDownToLine className="w-2.5 h-2.5 text-teal-400" />
          <span className="text-[10px] text-teal-500 dark:text-teal-400 font-medium">
            {isNew ? 'New import' : 'Edit import'}
          </span>
        </>
      )}
      renderFormContent={() => (
        <>
          {/* Global key: free text + datalist suggestions from current global state */}
          <input
            type="text"
            list={suggestions.length > 0 ? datalistId : undefined}
            value={newGlobalKey}
            onChange={e => setNewGlobalKey(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            }}
            placeholder="global state key"
            className={inputCls}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <datalist id={datalistId}>
              {suggestions.map(k => <option key={k} value={k} />)}
            </datalist>
          )}

          {/* Local key: free text (a want's declared state fields are only suggestions —
              types like work_log have no fixed schema and need an arbitrary new name here) */}
          <input
            type="text"
            list={localKeySuggestions.length > 0 ? localKeyDatalistId : undefined}
            value={newLocalKey}
            onChange={e => setNewLocalKey(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            }}
            placeholder="local state key"
            className={inputCls}
            autoComplete="off"
          />
          {localKeySuggestions.length > 0 && (
            <datalist id={localKeyDatalistId}>
              {localKeySuggestions.map(s => <option key={s.name} value={s.name} />)}
            </datalist>
          )}
        </>
      )}
      footerNote="Imported fields read directly from global state — no copy, always current."
      />
    </>
  );
};

ImportSection.displayName = 'ImportSection';
