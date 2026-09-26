import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, ChevronDown, ChevronRight, Copy, Check, Eraser, SlidersHorizontal, Plus, BarChart3, Radar, Type, X, KeyRound, Hash, ToggleLeft, List, Trash2, Tag, Percent } from 'lucide-react';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { apiClient } from '@/api/client';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { useInputActions } from '@/hooks/useInputActions';
import { classNames } from '@/utils/helpers';
import { useDebugStore } from '@/stores/debugStore';
import { DetailsSidebar } from './DetailsSidebar';
import { ConfirmationBubble } from '@/components/notifications/ConfirmationBubble';
import { SummarySidebarContent, SummarySidebarContentProps } from '@/components/sidebar/SummarySidebarContent';
import { DisplayCard, AddCard, FormCard, CardScheme, BLUE_SCHEME, AMBER_SCHEME, GREEN_SCHEME, CYAN_SCHEME } from '@/components/forms/CardPrimitives';
import { EnumToggleGroup } from '@/components/common/EnumToggleGroup';
import { StateFieldCard, JsonFieldCard } from '@/components/sidebar/WantDetailsSidebar';
import { isPlainObject } from '@/components/common/ObjectResultDisplay';
import { NumberSliderInput } from '@/components/common/NumberSliderInput';
import { ParameterDef } from '@/types/wantType';

// --- Shared state renderers (mirrors WantDetailsSidebar) ---

const CopyValueButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      title="Copy value"
      className="w-4 h-4 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-blue-400 dark:hover:text-blue-500 transition-colors flex-shrink-0"
    >
      {copied ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  );
};


// --- Settings (Global Parameters) tab ---

const PARAM_TYPES = ['text', 'int', 'float64', 'bool'] as const;
type ParamType = typeof PARAM_TYPES[number];

const TYPE_LABELS: Record<ParamType, string> = {
  text: 'Text',
  int: 'Int',
  float64: 'Float',
  bool: 'Bool',
};

const TYPE_ICONS = { text: Type, int: Hash, float64: Percent, bool: ToggleLeft } as const;

function TypeToggle({ value, onChange }: { value: ParamType; onChange: (v: ParamType) => void }) {
  return (
    <div className="flex rounded-2xl bg-gray-100 dark:bg-gray-700/60 p-0.5 w-full">
      {PARAM_TYPES.map(t => {
        const Icon = TYPE_ICONS[t];
        const isSelected = t === value;
        return (
          <button
            key={t}
            type="button"
            onClick={e => { e.stopPropagation(); onChange(t); }}
            className={[
              'flex-1 flex items-center justify-center gap-0.5 py-1 text-[10px] rounded-xl transition-all duration-150 whitespace-nowrap focus:outline-none',
              isSelected
                ? 'bg-blue-500 dark:bg-blue-600 text-white font-medium shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}
          >
            <Icon className="w-2.5 h-2.5 flex-shrink-0" />
            {TYPE_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

interface ParamRow {
  key: string;
  value: string;
  type: ParamType;
  subType?: string;
}

interface SettingsTabProps {
  parameters: Record<string, unknown>;
  definitions?: ParameterDef[];
  onUpdate: (parameters: Record<string, unknown>, definitions: ParameterDef[]) => Promise<void>;
  loading?: boolean;
  isActive?: boolean;
  onTabForward?: () => void;
  onTabBackward?: () => void;
  /** When set, scroll to and highlight the card with this param key */
  focusParamKey?: string | null;
}

function TypedValueInput({
  def, value, onChange,
}: {
  def: ParameterDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const hasEnum = !!(def.validation?.enum && def.validation.enum.length > 0);
  const isNumber = def.type === 'int' || def.type === 'float64';
  const isBool = def.type === 'bool';

  if (hasEnum) {
    return (
      <select
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
        className="flex-1 min-w-0 text-xs px-1.5 py-1 rounded border border-cyan-200 dark:border-cyan-800/40 bg-white/80 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
      >
        {def.validation!.enum!.map(opt => (
          <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
        ))}
      </select>
    );
  }

  if (isNumber && def.validation?.min !== undefined && def.validation?.max !== undefined) {
    const numVal = typeof value === 'number' ? value : (Number(value) || (def.validation.min as number));
    return (
      <NumberSliderInput
        value={numVal}
        min={def.validation.min as number}
        max={def.validation.max as number}
        step={def.type === 'float64' ? 0.1 : 1}
        onChange={onChange}
        stopPropagation
        className="flex-1"
      />
    );
  }

  if (isNumber) {
    const numVal = typeof value === 'number' ? value : (value === '' ? '' : Number(value));
    return (
      <input
        type="number"
        value={numVal as number | string}
        step={def.type === 'float64' ? 'any' : 1}
        onChange={e => onChange(e.target.value === '' ? '' : (def.type === 'float64' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)))}
        onClick={e => e.stopPropagation()}
        className="flex-1 min-w-0 text-xs px-1.5 py-1 rounded border border-amber-200 dark:border-amber-800/40 bg-white/80 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
      />
    );
  }

  if (isBool) {
    const boolVal = value === true || value === 'true';
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onChange(!boolVal); }}
        className={classNames(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0',
          boolVal ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
        )}
      >
        <span className={classNames(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          boolVal ? 'translate-x-4' : 'translate-x-0.5'
        )} />
      </button>
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className="flex-1 min-w-0 text-xs px-1.5 py-1 rounded border border-blue-100 dark:border-blue-900/40 bg-white/80 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
    />
  );
}



function defScheme(def: ParameterDef) {
  const hasEnum = !!(def.validation?.enum?.length);
  if (hasEnum) return { scheme: CYAN_SCHEME, Icon: List };
  if (def.type === 'int' || def.type === 'float64') return { scheme: AMBER_SCHEME, Icon: Hash };
  if (def.type === 'bool') return { scheme: GREEN_SCHEME, Icon: ToggleLeft };
  return { scheme: BLUE_SCHEME, Icon: Type };
}

/** Derives scheme + icons from a param row — shared between display, edit, and add cards. */
function getParamCardVisuals(
  type: ParamType,
  subType: string | undefined,
  subtypeDefs: Record<string, { key: string; icon: string }>,
  def?: ParameterDef,
) {
  const { scheme, Icon } = defScheme(def ?? { name: '', type, description: '', required: false });
  const subTypeIconName = subType ? subtypeDefs[subType]?.icon : undefined;
  const SubTypeIcon = subTypeIconName ? (resolveLucideIcon(subTypeIconName) ?? null) : null;
  const BgIcon = SubTypeIcon ?? Icon;
  return { scheme, Icon, SubTypeIcon, BgIcon };
}

const SETTINGS_COLS = 2;

const SettingsTab: React.FC<SettingsTabProps> = ({
  parameters, definitions, onUpdate, loading, isActive, onTabForward, onTabBackward, focusParamKey,
}) => {
  const defByName = React.useMemo(() => {
    const m = new Map<string, ParameterDef>();
    for (const d of definitions ?? []) m.set(d.name, d);
    return m;
  }, [definitions]);
  const [rows, setRows] = useState<ParamRow[]>([]);
  // editingIndex: null = all display mode, 0..n-1 = editing that row, rows.length = adding new
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<ParamRow>({ key: '', value: '', type: 'text', subType: '' });
  const [error, setError] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [subtypeDefs, setSubtypeDefs] = useState<Record<string, { key: string; icon: string }>>({});
  const rowsRef = useRef<ParamRow[]>([]);
  rowsRef.current = rows;

  // Only reset when this tab becomes inactive
  useEffect(() => {
    if (!isActive) { setFocusedIndex(-1); setEditingIndex(null); }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load subtype definitions once on mount
  useEffect(() => {
    apiClient.getSubtypeDefinitions().then(setSubtypeDefs).catch(() => {});
  }, []);

  // Build subtype toggle options: "none" first, then all known subtypes sorted
  const subtypeOptions = React.useMemo(() => [
    { value: '', label: 'none', icon: X },
    ...Object.entries(subtypeDefs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, info]) => ({
        value: name,
        label: name,
        icon: resolveLucideIcon(info.icon) ?? Tag,
      })),
  ], [subtypeDefs]);

  // Scroll to and highlight a specific param card when focusParamKey changes
  useEffect(() => {
    if (!focusParamKey) return;
    const idx = rowsRef.current.findIndex(r => r.key === focusParamKey);
    if (idx >= 0) {
      setFocusedIndex(idx);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`[data-global-param-key="${focusParamKey}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [focusParamKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // L1/R1 tab switching — registered as a broadcast listener so it fires even when
  // useCardGridNavigation holds the exclusive capture slot.
  useInputActions({
    gamepadOnly: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    enabled: isActive !== false,
    onTabForward,
    onTabBackward,
  });

  const { gridProps } = useCardGridNavigation({
    count: rows.length,
    cols: SETTINGS_COLS,
    isActive: isActive !== false,
    focusedIndex,
    setFocusedIndex,
    onConfirm: (i) => { setEditBuffer({ ...rowsRef.current[i] }); setEditingIndex(i); },
  });

  // Update local rows when parameters prop changes, but only if not editing
  useEffect(() => {
    if (editingIndex === null) {
      setRows(
        Object.entries(parameters).map(([key, value]) => {
          const def = defByName.get(key);
          const paramType = (def?.type as ParamType | undefined) ?? 'text';
          return {
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
            type: PARAM_TYPES.includes(paramType) ? paramType : 'text',
            subType: def?.subType ?? '',
          };
        })
      );
    }
  }, [parameters, editingIndex, defByName]);

  const buildUpdateArgs = (updatedRows: ParamRow[]): [Record<string, unknown>, ParameterDef[]] => {
    const newParams: Record<string, unknown> = {};
    for (const row of updatedRows) {
      const k = row.key.trim();
      if (!k) continue;
      if (row.type === 'int') {
        const n = parseInt(row.value, 10);
        newParams[k] = isNaN(n) ? row.value : n;
      } else if (row.type === 'float64') {
        const n = parseFloat(row.value);
        newParams[k] = isNaN(n) ? row.value : n;
      } else if (row.type === 'bool') {
        newParams[k] = row.value === 'true';
      } else {
        try { newParams[k] = JSON.parse(row.value); } catch { newParams[k] = row.value; }
      }
    }
    const newDefs: ParameterDef[] = updatedRows
      .filter(r => r.key.trim())
      .map(r => ({
        name: r.key.trim(),
        type: r.type,
        subType: r.subType?.trim() || undefined,
        description: defByName.get(r.key.trim())?.description ?? '',
        label: defByName.get(r.key.trim())?.label ?? '',
        required: false,
      }));
    return [newParams, newDefs];
  };

  const handleSaveSingle = async () => {
    const isAdding = editingIndex === rows.length;
    setError(null);
    try {
      let updatedRows: ParamRow[];
      if (isAdding) {
        if (!editBuffer.key.trim()) return;
        updatedRows = [...rows, editBuffer];
      } else {
        updatedRows = rows.map((r, i) => i === editingIndex ? editBuffer : r);
      }
      const [newParams, newDefs] = buildUpdateArgs(updatedRows);
      await onUpdate(newParams, newDefs);
      setRows(updatedRows);
      setEditingIndex(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditBuffer({ key: '', value: '', type: 'text', subType: '' });
    setError(null);
  };

  const handleDeleteRow = async (index: number) => {
    const updatedRows = rows.filter((_, i) => i !== index);
    try {
      const [newParams, newDefs] = buildUpdateArgs(updatedRows);
      await onUpdate(newParams, newDefs);
      setRows(updatedRows);
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    }
  };

  const handleAddRow = () => {
    setEditBuffer({ key: '', value: '', type: 'text', subType: '' });
    setEditingIndex(rows.length);
  };

  if (loading && Object.keys(parameters).length === 0) {
    return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading parameters...</div>;
  }

  // Live visuals derived from editBuffer — shared by both edit and add FormCards.
  const { scheme: editScheme, Icon: EditIcon, SubTypeIcon: EditSubTypeIcon, BgIcon: EditBgIcon } =
    getParamCardVisuals(editBuffer.type, editBuffer.subType ?? '', subtypeDefs);

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 bg-opacity-50 overflow-hidden p-3 sm:p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <h4 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">Global Parameters</h4>
          {loading && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
        </div>

        {error && (
          <div className="mb-2 px-2 py-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Card grid */}
        <div {...gridProps} className="grid grid-cols-2 gap-2 outline-none">
          {rows.map((row, index) => {
            const def = defByName.get(row.key);
            const syntheticDef: ParameterDef = def ?? { name: row.key, type: row.type, description: '', required: false };
            const { scheme, Icon, SubTypeIcon, BgIcon } = getParamCardVisuals(row.type, row.subType, subtypeDefs, { ...syntheticDef, type: row.type });
            const isFocused = focusedIndex === index;
            const isEditing = editingIndex === index;

            if (isEditing) {
              return (
                <FormCard
                  key={index}
                  borderClass={editScheme.formBorder}
                  bgClass={editScheme.cardBg}
                  saveColorClass={editScheme.saveColor}
                  BgIcon={EditBgIcon}
                  bgIconColor={editScheme.bgIconColor}
                  header={
                    <>
                      <EditIcon className={classNames('w-2.5 h-2.5', editScheme.iconColor)} />
                      <span className={classNames('text-[10px] font-medium', editScheme.iconColor)}>
                        {def ? (def.label || def.name) : (editBuffer.key || 'Edit param')}
                      </span>
                      {editBuffer.subType && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex-shrink-0 flex items-center gap-0.5">
                          {EditSubTypeIcon ? <EditSubTypeIcon className="w-2 h-2" /> : <Tag className="w-2 h-2" />}
                          {editBuffer.subType}
                        </span>
                      )}
                    </>
                  }
                  onSave={handleSaveSingle}
                  onCancel={handleCancelEdit}
                  saveDisabled={!editBuffer.key.trim()}
                >
                  <div
                    className="flex flex-col gap-1.5"
                    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); handleCancelEdit(); } }}
                  >
                    {!def && (
                      <input
                        autoFocus
                        type="text"
                        value={editBuffer.key}
                        onChange={e => setEditBuffer(b => ({ ...b, key: e.target.value }))}
                        placeholder="key name"
                        className="w-full text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    )}
                    <TypedValueInput
                      def={{ ...syntheticDef, type: editBuffer.type }}
                      value={(() => { try { return JSON.parse(editBuffer.value); } catch { return editBuffer.value; } })()}
                      onChange={v => setEditBuffer(b => ({ ...b, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }))}
                    />
                    <TypeToggle
                      value={editBuffer.type}
                      onChange={v => setEditBuffer(b => ({ ...b, type: v, subType: v !== 'text' ? '' : b.subType }))}
                    />
                    {editBuffer.type === 'text' && (
                      <EnumToggleGroup
                        value={editBuffer.subType ?? ''}
                        onChange={v => setEditBuffer(b => ({ ...b, subType: v }))}
                        options={subtypeOptions}
                      />
                    )}
                  </div>
                </FormCard>
              );
            }

            // Display mode
            const currentValue = (() => { try { return JSON.parse(row.value); } catch { return row.value; } })();
            const displayValue = typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? '');

            return (
              <DisplayCard
                key={index}
                className={classNames(
                  'relative rounded-xl p-1.5 h-14 transition-all duration-150 cursor-pointer shadow-sm group',
                  isFocused
                    ? 'shadow-md mw-card-focus bg-white dark:bg-gray-800'
                    : `${scheme.cardBg} ${scheme.cardHover}`
                )}
                BgIcon={BgIcon}
                bgIconColor={scheme.bgIconColor}
                showBgIcon={!isFocused}
                showFocusBar={isFocused}
                dataAttrs={{ 'data-global-param-key': row.key, 'data-robot-target': 'global_param_card', 'data-robot-id': row.key }}
                onClick={() => { setEditBuffer({ ...row, subType: row.subType ?? '' }); setEditingIndex(index); setFocusedIndex(index); }}
                headerLeft={
                  <>
                    <span className="text-[11px] font-semibold card-ink truncate" title={def?.description}>
                      {def ? (def.label || def.name) : row.key}
                    </span>
                    {row.subType && SubTypeIcon && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex-shrink-0 flex items-center gap-0.5">
                        <SubTypeIcon className="w-2 h-2" />
                        {row.subType}
                      </span>
                    )}
                    {row.subType && !SubTypeIcon && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex-shrink-0 flex items-center gap-0.5">
                        <Tag className="w-2 h-2" />
                        {row.subType}
                      </span>
                    )}
                  </>
                }
                headerRight={
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteRow(index); }}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-all"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                }
              >
                <div className="h-full flex items-end justify-end overflow-hidden gap-1">
                  {row.type === 'bool' ? (
                    <span className={classNames(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      currentValue === true || currentValue === 'true'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    )}>
                      {(currentValue === true || currentValue === 'true') ? 'ON' : 'OFF'}
                    </span>
                  ) : (() => {
                    const shownVal = displayValue || '—';
                    const bigFont = shownVal.length <= 8;
                    return (
                      <>
                        {displayValue && <CopyValueButton value={displayValue} />}
                        <span className={classNames(
                          'italic text-right leading-none',
                          bigFont ? 'text-2xl font-medium' : 'text-xs truncate',
                          displayValue ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600',
                        )}>
                          {shownVal}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </DisplayCard>
            );
          })}

          {/* Add param */}
          {editingIndex === rows.length ? (
            <FormCard
              borderClass={editScheme.formBorder}
              bgClass={editScheme.cardBg}
              saveColorClass={editScheme.saveColor}
              BgIcon={EditBgIcon}
              bgIconColor={editScheme.bgIconColor}
              header={
                <>
                  <EditIcon className={classNames('w-2.5 h-2.5', editScheme.iconColor)} />
                  <span className={classNames('text-[10px] font-medium', editScheme.iconColor)}>
                    {editBuffer.key || 'New parameter'}
                  </span>
                  {editBuffer.subType && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex-shrink-0 flex items-center gap-0.5">
                      {EditSubTypeIcon ? <EditSubTypeIcon className="w-2 h-2" /> : <Tag className="w-2 h-2" />}
                      {editBuffer.subType}
                    </span>
                  )}
                </>
              }
              onSave={handleSaveSingle}
              onCancel={handleCancelEdit}
              saveDisabled={!editBuffer.key.trim()}
            >
              <div
                className="flex flex-col gap-1.5"
                onKeyDown={e => {
                  if (e.key === 'Enter' && editBuffer.key.trim()) handleSaveSingle();
                  if (e.key === 'Escape') { e.stopPropagation(); handleCancelEdit(); }
                }}
              >
                <input
                  autoFocus
                  type="text"
                  value={editBuffer.key}
                  onChange={e => setEditBuffer(b => ({ ...b, key: e.target.value }))}
                  placeholder="key name"
                  className="w-full text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <TypedValueInput
                  def={{ name: editBuffer.key || 'new', type: editBuffer.type, description: '', required: false }}
                  value={(() => { try { return JSON.parse(editBuffer.value); } catch { return editBuffer.value; } })()}
                  onChange={v => setEditBuffer(b => ({ ...b, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }))}
                />
                <TypeToggle
                  value={editBuffer.type}
                  onChange={v => setEditBuffer(b => ({ ...b, type: v, subType: v !== 'text' ? '' : b.subType }))}
                />
                {editBuffer.type === 'text' && (
                  <EnumToggleGroup
                    value={editBuffer.subType ?? ''}
                    onChange={v => setEditBuffer(b => ({ ...b, subType: v }))}
                    options={subtypeOptions}
                  />
                )}
              </div>
            </FormCard>
          ) : (
            <AddCard
              borderClass={BLUE_SCHEME.addBorder}
              iconClass={BLUE_SCHEME.addIcon}
              label="Add param"
              onClick={handleAddRow}
            />
          )}
        </div>

        <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-500">
          Saved to ~/.mywant/parameters.yaml · JSON values are parsed automatically
        </p>
      </div>
    </div>
  );
};

// --- GlobalStateSidebar component ---

const SECTION_CONTAINER_CLASS = 'border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 overflow-hidden p-2 sm:p-4';

const TABS = [
  { id: 'results', label: 'Global', icon: Globe },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Params', icon: SlidersHorizontal },
];

/**
 * Global state drawn with the very same field cards a want's own state uses —
 * same type icon and colour, same live value bounce, same action overlay
 * (right-click / Shift+Enter), and so the same Aura naming: a global value can
 * be named into its catalog exactly like a want's field. Expose/Import are
 * absent here because there is no want behind these values to expose from.
 */
const GlobalStateFieldGrid: React.FC<{
  state: Record<string, unknown>;
  isActive?: boolean;
}> = ({ state, isActive = true }) => {
  const entries = Object.entries(state);
  const [navFocused, setNavFocused] = useState(-1);
  const [activatedIndex, setActivatedIndex] = useState<number | null>(null);
  // The same two presses the want panel's field cards answer — X names the
  // value, Y goes to what it turned out to be. Routed through the grid because
  // that is what holds the input while a card is focused.
  const [nameIndex, setNameIndex] = useState<number | null>(null);
  const [followIndex, setFollowIndex] = useState<number | null>(null);

  const { gridProps } = useCardGridNavigation({
    count: entries.length,
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    onContextMenu: (i) => setActivatedIndex(i),
    onButtonX: (i) => setNameIndex(i),
    onYButton: (i) => setFollowIndex(i),
  });

  useEffect(() => {
    if (!isActive) setNavFocused(-1);
  }, [isActive]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 sm:gap-3 outline-none" {...gridProps}>
      {entries.map(([k, v], i) => {
        const shared = {
          name: k,
          isFocused: navFocused === i,
          activated: activatedIndex === i,
          onActivationConsumed: () => setActivatedIndex(null),
          nameRequest: nameIndex === i,
          onNameRequestConsumed: () => setNameIndex(null),
          followRequest: followIndex === i,
          onFollowRequestConsumed: () => setFollowIndex(null),
          onFocusRequest: () => setNavFocused(i),
        };
        return isPlainObject(v)
          ? <JsonFieldCard key={k} {...shared} value={v as Record<string, unknown>} />
          : <StateFieldCard key={k} {...shared} value={v} />;
      })}
    </div>
  );
};

interface GlobalStateSidebarProps {
  summaryProps?: SummarySidebarContentProps;
  radarMode?: boolean;
  onRadarModeToggle?: () => void;
  /** When set, switch to the Params tab and scroll to this param key's card */
  focusParamKey?: string | null;
}

export const GlobalStateSidebar: React.FC<GlobalStateSidebarProps> = ({ summaryProps, radarMode, onRadarModeToggle, focusParamKey }) => {
  const pollingIntervalMs = useDebugStore(state => state.pollingIntervalMs);

  const [activeTab, setActiveTab] = useState('results');

  // When focusParamKey is set from outside, switch to the Params tab
  useEffect(() => {
    if (focusParamKey) setActiveTab('settings');
    // note: scroll is handled in SettingsTab via its own focusParamKey effect
  }, [focusParamKey]);

  const [globalState, setGlobalState] = useState<Record<string, unknown>>({});
  const [globalParams, setGlobalParams] = useState<Record<string, unknown>>({});
  const [globalParamDefs, setGlobalParamDefs] = useState<ParameterDef[]>([]);
  const [timestamp, setTimestamp] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [paramsLoading, setParamsLoading] = useState(true);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const stateETagRef = useRef<string | undefined>(undefined);
  const paramsETagRef = useRef<string | undefined>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const [stateResult, paramsResult] = await Promise.all([
        apiClient.getGlobalStateConditional(stateETagRef.current),
        apiClient.getGlobalParametersConditional(paramsETagRef.current),
      ]);
      if (stateResult.data !== null) {
        setGlobalState(stateResult.data.state || {});
        setTimestamp(stateResult.data.timestamp);
        stateETagRef.current = stateResult.etag;
      }
      if (paramsResult.data !== null) {
        setGlobalParams(paramsResult.data.parameters || {});
        setGlobalParamDefs(paramsResult.data.definitions || []);
        paramsETagRef.current = paramsResult.etag;
      }
    } catch (e) {
      console.error('Failed to fetch global data:', e);
    } finally {
      setLoading(false);
      setParamsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, pollingIntervalMs]);

  const handleUpdateParameters = async (parameters: Record<string, unknown>, definitions: ParameterDef[]) => {
    const result = await apiClient.updateGlobalParameters(parameters, definitions);
    setGlobalParams(parameters); // Optimistic update
    if (result.definitions) setGlobalParamDefs(result.definitions);
  };

  const handleClearGlobalState = async () => {
    try {
      await apiClient.deleteGlobalState();
      setGlobalState({});
    } catch (e) {
      console.error('Failed to clear global state:', e);
    } finally {
      setShowClearConfirmation(false);
    }
  };

  const hasState = Object.keys(globalState).length > 0;
  const subtitleText = timestamp
    ? `Updated: ${new Date(timestamp).toLocaleTimeString()}`
    : undefined;

  return (
    <DetailsSidebar
        title="Global"
        headerOverlay={
          <ConfirmationBubble
            isVisible={showClearConfirmation}
            onConfirm={handleClearGlobalState}
            onCancel={() => setShowClearConfirmation(false)}
            onDismiss={() => setShowClearConfirmation(false)}
            title="Clear Global"
            layout="header-overlay"
          />
        }
        tabs={TABS}
        defaultTab="results"
        onTabChange={setActiveTab}
      >
        <div className="flex flex-col h-full">
          {/* Action Bar / Status Info */}
          <div className="flex-shrink-0 px-3 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30">
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium italic">
              {subtitleText || 'Loading...'}
            </span>
            {activeTab === 'results' && hasState && (
              <button
                onClick={() => setShowClearConfirmation(true)}
                className="p-1 sm:p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-1.5 group"
                title="Clear all global data"
              >
                <Eraser className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="text-[10px] font-bold uppercase tracking-tighter hidden sm:block">Clear</span>
              </button>
            )}
          </div>

          <div className="flex-1 px-3 sm:px-4 pt-0 pb-3 sm:py-4 h-full overflow-y-auto">
            {activeTab === 'results' && (
              loading ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  Loading global state...
                </div>
              ) : hasState ? (
                <div className="space-y-2">
                  <div className={SECTION_CONTAINER_CLASS}>
                    <h4 className="text-xs sm:text-base font-medium text-gray-900 dark:text-white mb-1 sm:mb-3">Global State</h4>
                    <GlobalStateFieldGrid state={globalState} isActive={activeTab === 'results'} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No global state data</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-6">
                    Global state will appear here once wants store values via StoreGlobalState
                  </p>
                </div>
              )
            )}

            {activeTab === 'stats' && summaryProps && (
              <SummarySidebarContent {...summaryProps} />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                {/* Radar toggle */}
                {onRadarModeToggle && (
                  <div className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 bg-opacity-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Radar className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Correlation Radar</span>
                    </div>
                    <button
                      onClick={onRadarModeToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${radarMode ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${radarMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
                <SettingsTab
                  parameters={globalParams}
                  definitions={globalParamDefs}
                  onUpdate={handleUpdateParameters}
                  loading={paramsLoading}
                  isActive={activeTab === 'settings'}
                  focusParamKey={activeTab === 'settings' ? focusParamKey : null}
                  onTabForward={() => {
                    const idx = TABS.findIndex(t => t.id === activeTab);
                    setActiveTab(TABS[(idx + 1) % TABS.length].id);
                  }}
                  onTabBackward={() => {
                    const idx = TABS.findIndex(t => t.id === activeTab);
                    setActiveTab(TABS[(idx - 1 + TABS.length) % TABS.length].id);
                  }}
                />
              </div>
            )}
          </div>
        </div>
    </DetailsSidebar>
  );
};
