import React, { useState, useCallback, useEffect } from 'react';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { ArrowUpFromLine, ArrowRight, KeyRound, Target, Globe, LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { StateDef } from '@/types/wantType';
import { SelectInput } from '@/components/common/SelectInput';
import { classNames } from '@/utils/helpers';
import { CardGridShell, PURPLE_SCHEME } from '@/components/forms/CardPrimitives';
import { getTypeStyle } from '@/components/forms/sections/ParameterGridSection';
import { useDataTypes } from '@/hooks/useDataTypes';

export interface ExposeEntry {
  currentState?: string;
  param?: string;
  as?: string;
  /** Push currentState to parent's Goal-labeled state (bottom-up). */
  asGoal?: string;
  /** Write currentState directly to a named global parameter. */
  asGlobalParam?: string;
}

type ExposeMode = 'state' | 'goal' | 'globalParam';

interface ExposeSectionProps {
  exposes: ExposeEntry[];
  onExposesChange: (exposes: ExposeEntry[]) => void;
  stateDefs?: StateDef[];
  /** Keys added via the add-field UI (DerivedFieldEditor) — not part of the want
   * type's schema, so stateDefs may already include synthetic entries for them.
   * Passed separately just to mark them in the picker (e.g. a "custom" tag). */
  customFieldNames?: Set<string>;
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
  'border-purple-200 dark:border-purple-700',
  'focus:outline-none focus:ring-1 focus:ring-purple-400',
);

export const ExposeSection: React.FC<ExposeSectionProps> = ({
  exposes,
  onExposesChange,
  stateDefs,
  customFieldNames,
  initialAddKey,
  onInitialKeyConsumed,
  isActive = true,
  focusRequest,
  onExitTop,
  onExitBottom,
}) => {
  const { getTypeInfo } = useDataTypes();
  const [adding, setAdding] = useState(false);
  const [newState, setNewState] = useState('');
  const [newAs, setNewAs] = useState('');
  const [mode, setMode] = useState<ExposeMode>('state');
  const [navFocused, setNavFocused] = useState(-1);

  useEffect(() => {
    if (!initialAddKey) return;
    setNewState(initialAddKey);
    setAdding(true);
    onInitialKeyConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddKey]);

  // Exposable fields first, then the rest (both groups sorted by name)
  const stateFields = (stateDefs?.filter(s => s.name !== 'final_result') ?? [])
    .slice()
    .sort((a, b) => {
      if (a.exposable === b.exposable) return a.name.localeCompare(b.name);
      return a.exposable ? -1 : 1;
    });

  const validExposes = exposes.filter(e => e.currentState && (e.as || e.asGoal || e.asGlobalParam));

  const navCount = validExposes.length + (adding ? 0 : 1);

  const { gridProps: navGridProps } = useCardGridNavigation({
    count: navCount,
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    onConfirm: (i) => { if (i === validExposes.length) setAdding(true); },
    focusRequest,
    onExitTop,
    onExitBottom,
  });

  useEffect(() => {
    if (!isActive) setNavFocused(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const resetForm = useCallback(() => {
    setNewState('');
    setNewAs('');
    setMode('state');
  }, []);

  const handleSave = useCallback(() => {
    if (!newState || !newAs.trim()) return;
    const next = exposes.filter(e => e.currentState !== newState);
    if (mode === 'goal') {
      next.push({ currentState: newState, asGoal: newAs.trim() });
    } else if (mode === 'globalParam') {
      next.push({ currentState: newState, asGlobalParam: newAs.trim() });
    } else {
      next.push({ currentState: newState, as: newAs.trim() });
    }
    onExposesChange(next);
    resetForm();
    setAdding(false);
  }, [exposes, onExposesChange, newState, newAs, mode, resetForm]);

  const handleCancel = useCallback(() => {
    setAdding(false);
    resetForm();
  }, [resetForm]);

  const handleDelete = useCallback((i: number) => {
    const target = validExposes[i];
    onExposesChange(exposes.filter(e => e.currentState !== target.currentState));
  }, [validExposes, exposes, onExposesChange]);

  const footerNote =
    mode === 'goal'
      ? 'Goal values are set on the parent want as a goal state (asGoal).'
      : mode === 'globalParam'
      ? 'Global param values are written directly to a named global parameter (asGlobalParam).'
      : 'Exposed values are written to global parameters after each execution cycle.';

  const placeholder =
    mode === 'goal' ? 'parent goal key' :
    mode === 'globalParam' ? 'global param name' :
    'global key';

  return (
    <>
      <CardGridShell
      scheme={PURPLE_SCHEME}
      BgIcon={ArrowUpFromLine}
      count={validExposes.length}
      editingIndex={adding ? validExposes.length : null}
      navFocusedIndex={navFocused}
      navGridProps={navGridProps}
      addLabel="Add expose"
      onAdd={() => setAdding(true)}
      onDeleteItem={handleDelete}
      onSave={handleSave}
      onCancel={handleCancel}
      saveDisabled={!newState || !newAs.trim()}
      // Same type-driven tint the parameter and state field cards use, so a
      // card's colour tells you what kind of value it carries.
      getItemScheme={(i) => {
        const e = validExposes[i];
        const sd = stateDefs?.find(s => s.name === e.currentState);
        return sd ? getTypeStyle(sd.type, false, null).scheme : null;
      }}
      getItemBgIcon={(i) => {
        const e = validExposes[i];
        const sd = stateDefs?.find(s => s.name === e.currentState);
        if (!sd) return null;
        const dtInfo = getTypeInfo(sd.subType || sd.type);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Icon = (LucideIcons as any)[dtInfo.icon] as LucideIcon | undefined;
        if (!Icon) return null;
        return { BgIcon: Icon, bgIconStyle: { color: dtInfo.color } };
      }}
      renderItemHeaderLeft={(i) => {
        const e = validExposes[i];
        return (
          <span className="text-[11px] font-semibold card-ink truncate leading-none font-mono">
            {e.currentState}
          </span>
        );
      }}
      renderItemBody={(i) => {
        const e = validExposes[i];
        const isGoal = !!e.asGoal;
        const isGlobalParam = !!e.asGlobalParam;
        return (
          <div className="flex items-center gap-1">
            {isGoal
              ? <Target className="w-2.5 h-2.5 text-purple-400 dark:text-purple-500 flex-shrink-0 opacity-60" />
              : isGlobalParam
              ? <Globe className="w-2.5 h-2.5 text-teal-400 dark:text-teal-500 flex-shrink-0 opacity-70" />
              : <ArrowRight className="w-2.5 h-2.5 text-purple-400 dark:text-purple-500 flex-shrink-0 opacity-40" />
            }
            <span className={classNames(
              'font-mono text-xs truncate',
              isGlobalParam
                ? 'text-teal-700 dark:text-teal-300'
                : 'text-purple-700 dark:text-purple-300',
            )}>
              {isGoal ? `goal: ${e.asGoal}` : isGlobalParam ? `global: ${e.asGlobalParam}` : e.as}
            </span>
          </div>
        );
      }}
      renderFormHeader={(isNew) => (
        <>
          <ArrowUpFromLine className="w-2.5 h-2.5 text-purple-400" />
          <span className="text-[10px] text-purple-500 dark:text-purple-400 font-medium">
            {isNew ? 'New expose' : 'Edit expose'}
          </span>
        </>
      )}
      renderFormContent={() => (
        <>
          <SelectInput
            value={newState}
            onChange={setNewState}
            options={[
              { value: '', label: 'state field' },
              ...stateFields
                .filter(s => !exposes.some(e => e.currentState === s.name))
                .map(s => ({
                  value: s.name,
                  label: (s.exposable ? `◆ ${s.name}` : s.name) + (customFieldNames?.has(s.name) ? ' (custom)' : ''),
                })),
            ]}
            className="w-full mb-1.5"
          />
          {/* Mode toggle: state / goal / globalParam */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <button
              type="button"
              onClick={() => setMode('state')}
              className={classNames(
                'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors',
                mode === 'state'
                  ? 'bg-purple-100 dark:bg-purple-900 border-purple-400 text-purple-700 dark:text-purple-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400',
              )}
            >
              <ArrowRight className="w-2.5 h-2.5" /> state
            </button>
            <button
              type="button"
              onClick={() => setMode('goal')}
              className={classNames(
                'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors',
                mode === 'goal'
                  ? 'bg-purple-100 dark:bg-purple-900 border-purple-400 text-purple-700 dark:text-purple-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400',
              )}
            >
              <Target className="w-2.5 h-2.5" /> goal
            </button>
            <button
              type="button"
              onClick={() => setMode('globalParam')}
              className={classNames(
                'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors',
                mode === 'globalParam'
                  ? 'bg-teal-100 dark:bg-teal-900 border-teal-400 text-teal-700 dark:text-teal-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400',
              )}
            >
              <Globe className="w-2.5 h-2.5" /> global
            </button>
          </div>
          <input
            type="text"
            value={newAs}
            onChange={e => setNewAs(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            }}
            placeholder={placeholder}
            className={inputCls}
          />
        </>
      )}
      footerNote={footerNote}
      />
    </>
  );
};

ExposeSection.displayName = 'ExposeSection';
