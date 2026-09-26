import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useIconFont } from '@/hooks/useDisplaySettings';
import { Type, Hash, ToggleLeft, Link, Plus, X, Zap, List, LucideIcon, Globe, Rows3, Braces, Edit3, RotateCcw, Trash2, Star } from 'lucide-react';
import { OverlayActionGrid, OverlayItem } from '@/components/common/OverlayActionGrid';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { ParameterDef, StateDef } from '@/types/wantType';
import { SelectInput, SelectInputHandle } from '@/components/common/SelectInput';
import { CommitInput, CommitInputHandle } from '@/components/common/CommitInput';
import { EnumToggleGroup, EnumToggleGroupHandle } from '@/components/common/EnumToggleGroup';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { useAuraNaming } from '@/hooks/useAuraNaming';
import { MarkBadges, useMarkJump } from '@/components/common/MarkButton';
import { useThingNames } from '@/hooks/useThingNames';
import { WantIcon } from '@/components/dashboard/WantIcon';
import { wantTypeIconStyle } from '@/components/dashboard/WantCardFace';
import type { IconFamily } from '@/components/dashboard/WantTypeVisuals';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useWantTypeStore } from '@/stores/wantTypeStore';
import { useConfigStore } from '@/stores/configStore';
import { NotebookPen } from 'lucide-react';
import { apiClient, type ParamRecommendation } from '@/api/client';
import { useDataTypes, selfDescribedSubtype } from '@/hooks/useDataTypes';
import { classNames } from '@/utils/helpers';
import { DisplayCard, AddCard, FormCard, CardScheme, BLUE_SCHEME, GREEN_SCHEME, TEAL_SCHEME, PURPLE_SCHEME, AMBER_SCHEME, CYAN_SCHEME, INDIGO_SCHEME, ORANGE_SCHEME } from '@/components/forms/CardPrimitives';
import { NumberSliderInput } from '@/components/common/NumberSliderInput';
import { CharacterMultiSelect } from '@/components/characters/CharacterMultiSelect';
import { useCharacterStore } from '@/stores/characterStore';
import { useParamSpotlightStore } from '@/stores/paramSpotlightStore';
import { acceptedSubTypes } from '@/utils/wantSeed';

const COLS = typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 2;

/** Serialize an array item for display in a text input */
function serializeItem(item: any): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') return JSON.stringify(item);
  return String(item);
}

/** Parse a text input back to an array item value */
function parseItem(text: string): any {
  const t = text.trim();
  if (t === '') return '';
  try { return JSON.parse(t); } catch { return t; }
}

/** Returns the fromGlobalParam key if the value is a ParamRef with a non-empty key, otherwise null */
function getParamRef(value: any): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.fromGlobalParam === 'string') {
    return value.fromGlobalParam || null; // empty string → not a valid ref
  }
  return null;
}

export interface ParameterGridSectionProps {
  parameters: Record<string, any>;
  parameterDefinitions?: ParameterDef[];
  stateDefs?: StateDef[];
  originalParameters?: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  /** Whether this tab is currently active — enables grid keyboard/gamepad navigation */
  isActive: boolean;
  /**
   * True when the user has explicitly entered "detail-focus mode" for this sidebar.
   * Used to reset focusedIndex when the sidebar exits detail-focus mode (want change).
   */
  sidebarDetailFocused?: boolean;
  /**
   * Increments on every L1/R1 / B+L1/R1 press to auto-focus the first card (or AddCard
   * if no params exist). Handled by useCardGridNavigation — common across all sections.
   */
  focusRequest?: number;
  /** Called when user clicks a parameter card — parent uses this to enter detail-focus mode */
  onDetailFocusEnter?: () => void;
  /** Values the server suggests per parameter, best first. Offered on empty
   *  cards so a want can be filled by tapping rather than typing. */
  recommendations?: Record<string, ParamRecommendation[]>;
  /** Takes one. The form owns this because a want-sourced suggestion is wired
   *  (expose + import), not copied, and imports live on the form. */
  onApplyRecommendation?: (rec: ParamRecommendation) => void;
}

export interface TypeStyle {
  scheme: CardScheme;
  BgIcon: LucideIcon;
}

export function getTypeStyle(type: string, hasEnum: boolean, subTypeIcon?: LucideIcon | null): TypeStyle {
  const SubIcon = subTypeIcon ?? null;
  if (hasEnum) return { scheme: CYAN_SCHEME, BgIcon: SubIcon ?? List };
  switch (type) {
    case 'array':    return { scheme: INDIGO_SCHEME, BgIcon: SubIcon ?? Rows3 };
    case 'percent':
    case 'int':
    case 'float64':  return { scheme: ORANGE_SCHEME, BgIcon: SubIcon ?? Hash };
    case 'bool':     return { scheme: GREEN_SCHEME,  BgIcon: SubIcon ?? ToggleLeft };
    case 'want_type':return { scheme: PURPLE_SCHEME, BgIcon: SubIcon ?? Zap };
    case 'json':
    case 'object':   return { scheme: AMBER_SCHEME,  BgIcon: SubIcon ?? Braces };
    default:         return { scheme: BLUE_SCHEME,   BgIcon: SubIcon ?? Type };
  }
}

export function TypeIcon({ type, hasEnum, colorClass, subTypeIcon }: { type: string; hasEnum: boolean; colorClass: string; subTypeIcon?: LucideIcon | null }) {
  const cls = `w-2.5 h-2.5 ${colorClass}`;
  if (subTypeIcon) { const SubIcon = subTypeIcon; return <SubIcon className={cls} />; }
  if (hasEnum) return <List className={cls} />;
  switch (type) {
    case 'array':
      return <Rows3 className={cls} />;
    case 'percent':
    case 'int':
    case 'float64':
      return <Hash className={cls} />;
    case 'bool':
      return <ToggleLeft className={cls} />;
    case 'want_type':
      return <Zap className={cls} />;
    case 'json':
    case 'object':
      return <Braces className={cls} />;
    default:
      return <Type className={cls} />;
  }
}

/**
 * A parameter card's corner marks — what its value turned out to be.
 *
 * A component rather than a call in the map above: the answer comes from a hook
 * (useThingNames) and there is one card per parameter, so each card has to ask
 * for itself.
 */
const ParamMarks: React.FC<{ value: unknown; subType?: string | null }> = ({ value, subType }) => {
  const { marks } = useThingNames(value, subType);
  return <MarkBadges marks={marks} />;
};

export const ParameterGridSection: React.FC<ParameterGridSectionProps> = ({
  parameters,
  parameterDefinitions,
  originalParameters = {},
  onChange,
  isActive,
  sidebarDetailFocused = false,
  focusRequest,
  onDetailFocusEnter,
  recommendations = {},
  onApplyRecommendation,
}) => {
  const characters = useCharacterStore(s => s.characters);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  // editingIndex: which card is in "edit mode" (actual input shown).
  // -1 = all cards in display mode; set via Enter/A or card click.
  const [editingIndex, setEditingIndex] = useState(-1);
  const [showOptional, setShowOptional] = useState(false);
  const [globalParams, setGlobalParams] = useState<Record<string, unknown>>({});
  const [globalOverrides, setGlobalOverrides] = useState<Record<string, boolean>>({});
  const [wantTypeOptions, setWantTypeOptions] = useState<{ value: string }[]>([]);
  // Cache for both modes per param — survives toggling back and forth
  const [paramCache, setParamCache] = useState<Record<string, { literal: any; ref: string }>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  // Index of the card showing its action overlay (Shift+Enter / gamepad Start).
  // null = no overlay. Plain Enter still goes straight to edit mode.
  const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
  // Params currently in "ref mode UI" but key not yet committed — prevents saving {fromGlobalParam: ''} prematurely
  const [pendingRefMode, setPendingRefMode] = useState<Set<string>>(new Set());
  // Thing suggestions: subtype → cached suggestion list
  const [thingSuggestions, setMemoSuggestions] = useState<Record<string, string[]>>({});
  const { getTypeInfo: getDataTypeInfo } = useDataTypes();

  const focusedIndexRef = useRef(-1);
  focusedIndexRef.current = focusedIndex;

  // Stable refs so onConfirm closures always see the latest values
  const parametersRef = useRef(parameters);
  parametersRef.current = parameters;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const inputRefs = useRef<Array<CommitInputHandle | SelectInputHandle | EnumToggleGroupHandle | null>>([]);

  /**
   * iOS Safari keyboard proxy.
   *
   * iOS only opens the software keyboard when focus() is called synchronously
   * inside a user-gesture handler (click/touchend). Calls inside useEffect or
   * requestAnimationFrame are rejected.  We keep this tiny hidden input always
   * in the DOM so onClick can focus it synchronously, which opens the keyboard.
   * The subsequent RAF then moves focus to the real CommitInput; iOS keeps the
   * keyboard open when focus moves between <input> elements.
   *
   * font-size ≥ 16px is required to prevent iOS auto-zoom on focus.
   */
  // Fetch thing suggestions when a parameter that takes one enters edit mode.
  // Every subtype it ACCEPTS, not only the one it records as: a route's `from`
  // records stations and also takes named places, and offering only stations
  // would hide the very values the widening was for.
  useEffect(() => {
    if (editingIndex < 0 || !parameterDefinitions) return;
    const filtered = parameterDefinitions.filter(pd => !pd.validation?.enum);
    const pd = filtered[editingIndex];
    if (!pd) return;
    for (const st of acceptedSubTypes(pd)) {
      if (thingSuggestions[st] !== undefined) continue;
      apiClient.getThingSuggestions(st, 10).then(suggestions => {
        setMemoSuggestions(prev => ({ ...prev, [st]: suggestions }));
      }).catch(() => {});
    }
  }, [editingIndex, parameterDefinitions]);

  const iosProxyRef = useRef<HTMLInputElement>(null);

  /**
   * When a card is clicked to enter edit mode directly (not via keyboard navigation),
   * the focusedIndex change would normally trigger `setEditingIndex(-1)` and reset edit
   * mode before it can take effect.  This ref lets onClick signal "skip that reset".
   */
  const skipEditResetRef = useRef(false);

  const filteredParams = (parameterDefinitions ?? []).filter(
    p => p.required || showOptional || parameters[p.name] !== undefined
  );
  const filteredParamsRef = useRef(filteredParams);
  filteredParamsRef.current = filteredParams;

  const extraParamKeysRef = useRef<string[]>([]);

  // Compute early so useCardGridNavigation sees the correct count (including AddCard).
  const definedParamNames = new Set((parameterDefinitions ?? []).map(p => p.name));
  const extraParamKeys = Object.keys(parameters).filter(k => !definedParamNames.has(k));
  extraParamKeysRef.current = extraParamKeys;

  // AddCard is always the last navigable position (+1 when visible, 0 when FormCard shown).
  const addCardIndex = filteredParams.length + extraParamKeys.length;
  const navCount = addCardIndex + (pendingKey === null ? 1 : 0);

  useEffect(() => {
    apiClient.getGlobalParameters()
      .then(res => setGlobalParams(res.parameters ?? {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const hasWantType = parameterDefinitions?.some(p => p.type === 'want_type');
    if (!hasWantType) return;
    apiClient.listWantTypes()
      .then(res => setWantTypeOptions((res.wantTypes ?? []).map(wt => ({ value: wt.name }))))
      .catch(() => {});
  }, [parameterDefinitions]);

  useEffect(() => {
    if (!parameterDefinitions) return;
    setGlobalOverrides(prev => {
      const next = { ...prev };
      for (const p of parameterDefinitions) {
        if (p.defaultGlobalParameter && !(p.name in next)) {
          next[p.name] = p.name in parameters;
        }
      }
      return next;
    });
  }, [parameterDefinitions]); // intentionally excludes parameters to avoid loop

  // Reset focusedIndex when section becomes inactive or sidebar exits detail-focus mode.
  // Auto-focus on tab switch is handled by useCardGridNavigation's focusRequest mechanism.
  useEffect(() => {
    if (!isActive) setFocusedIndex(-1);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sidebarDetailFocused) setFocusedIndex(-1);
  }, [sidebarDetailFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the focused card changes, exit edit mode on the previous card.
  // Exception: onClick sets skipEditResetRef=true when directly entering edit mode,
  // so we don't undo the editingIndex it just set.
  useEffect(() => {
    if (skipEditResetRef.current) {
      skipEditResetRef.current = false;
      return;
    }
    setEditingIndex(-1);
  }, [focusedIndex]);

  // Auto-focus the real input when entering edit mode.
  // On iOS the keyboard is already open (proxy was focused in onClick);
  // transferring focus between <input> elements keeps it open.
  // setCursorToEnd places the caret at the end of existing text.
  useEffect(() => {
    if (editingIndex >= 0) {
      requestAnimationFrame(() => {
        const t = inputRefs.current[editingIndex];
        if (!t) return;
        if ('focus' in t) (t as { focus: () => void }).focus();
        if ('setCursorToEnd' in t) (t as { setCursorToEnd: () => void }).setCursorToEnd();
      });
    }
  }, [editingIndex]);

  // Everybody there is, as pills — the options for a `character` parameter.
  // Their avatar comes along, because a person is recognised by their face
  // before their name.
  const characterOptions = characters.map(c => ({
    value: c.id,
    label: `${c.avatar ?? ''} ${c.name}`.trim(),
  }));

  const { gridRef, gridProps } = useCardGridNavigation({
    count: navCount,
    cols: COLS,
    isActive,
    focusedIndex,
    setFocusedIndex,
    // X names the focused value, Y goes to what it is. Bound on the grid
    // because the grid is what input is handed to while one of its cards is
    // focused (see useCardGridNavigation).
    // `editingIndex` is -1 when nothing is being edited, never null — the same
    // slip silently disabled the aura's own X here for as long as it has
    // existed, because `editingIndex === null` is a comparison that is never
    // true.
    onButtonX: () => { if (editingIndex < 0) aura.open(); },
    onYButton: () => { if (editingIndex < 0 && focusedMarks[0]) jumpToMark(focusedMarks[0]); },
    onConfirm: (i) => {
      const fp = filteredParamsRef.current;
      const extra = extraParamKeysRef.current;
      // AddCard: open FormCard
      if (i === fp.length + extra.length) { setPendingKey(''); return; }
      // bool: toggle directly — no separate edit mode needed
      if (i < fp.length && fp[i].type === 'bool') {
        const name = fp[i].name;
        const cur = parametersRef.current[name];
        const def = fp[i].default;
        onChangeRef.current({ ...parametersRef.current, [name]: !Boolean(cur ?? def ?? false) });
        return;
      }
      // all other types: enter edit mode
      setEditingIndex(i);
    },
    // Shift+Enter / gamepad Start — the action overlay. Only defined params
    // have one; the trailing AddCard has nothing to offer beyond its own click.
    onContextMenu: (i) => {
      if (i >= filteredParamsRef.current.length + extraParamKeysRef.current.length) return;
      setEditingIndex(-1);
      setOverlayIndex(i);
    },
    focusRequest,
  });

  // An overlay belongs to one focused card; moving focus or leaving the tab
  // must not leave it stranded on a card the user is no longer on.
  useEffect(() => {
    if (overlayIndex !== null && overlayIndex !== focusedIndex) setOverlayIndex(null);
  }, [focusedIndex, overlayIndex]);
  useEffect(() => {
    if (!isActive) setOverlayIndex(null);
  }, [isActive]);

  // Exit edit mode and return keyboard focus to the grid container.
  const exitEditMode = useCallback(() => {
    setEditingIndex(-1);
    requestAnimationFrame(() => gridRef.current?.focus());
  }, [gridRef]);

  const handleUpdateParam = useCallback((key: string, value: string, paramType: string) => {
    let typedValue: any = value;
    if (value === '') {
      typedValue = undefined;
    } else {
      switch (paramType) {
        case 'float64':
        case 'int':
          typedValue = parseFloat(value);
          if (isNaN(typedValue)) typedValue = undefined;
          break;
        case 'bool':
          typedValue = value.toLowerCase() === 'true';
          break;
      }
    }
    if (typedValue !== undefined) {
      setParamCache(c => ({ ...c, [key]: { ...c[key], literal: typedValue } }));
    }
    const next = { ...parameters };
    if (typedValue === undefined) delete next[key];
    else next[key] = typedValue;
    onChange(next);
  }, [parameters, onChange]);

  const handleToggleGlobal = useCallback((paramName: string) => {
    setGlobalOverrides(prev => {
      const nowOverride = !prev[paramName];
      const next = { ...prev, [paramName]: nowOverride };
      if (!nowOverride) {
        const newParams = { ...parameters };
        delete newParams[paramName];
        onChange(newParams);
      }
      return next;
    });
  }, [parameters, onChange]);

  const handleToggleParamRef = useCallback((paramName: string, currentRef: string | null) => {
    if (currentRef !== null) {
      // ref → literal: save current ref key, restore cached literal
      setParamCache(c => ({ ...c, [paramName]: { ...c[paramName], ref: currentRef } }));
      setPendingRefMode(s => { const n = new Set(s); n.delete(paramName); return n; });
      const next = { ...parameters };
      const cached = paramCache[paramName]?.literal;
      if (cached !== undefined) next[paramName] = cached;
      else next[paramName] = '';
      onChange(next);
    } else {
      // literal → ref: enter pending ref mode — do NOT call onChange yet (prevents saving {fromGlobalParam: ''})
      const literalNow = parameters[paramName];
      setParamCache(c => ({ ...c, [paramName]: { ...c[paramName], literal: literalNow } }));
      setPendingRefMode(s => new Set([...s, paramName]));
    }
  }, [parameters, paramCache, onChange]);

  const handleUpdateParamRef = useCallback((paramName: string, globalKey: string) => {
    setParamCache(c => ({ ...c, [paramName]: { ...c[paramName], ref: globalKey } }));
    if (globalKey) {
      // Valid key selected — commit to onChange and leave pending mode
      setPendingRefMode(s => { const n = new Set(s); n.delete(paramName); return n; });
      const next = { ...parameters, [paramName]: { fromGlobalParam: globalKey } };
      onChange(next);
    }
    // Empty key: stay in pending mode, don't commit {fromGlobalParam: ''} to onChange
  }, [parameters, onChange]);

  /**
   * Action grid shown over a parameter card on Shift+Enter / gamepad Start.
   * Mirrors the field cards' overlay (WantDetailsSidebar) so both grids in the
   * sidebar behave identically: Edit is the same thing plain Enter does, the
   * rest are actions that previously had no keyboard route at all.
   */
  // Aura naming for the focused parameter card — the same flow the state field
  // cards use, so a parameter value can be named into its catalog too. One hook
  // call for whichever card holds the focus: the overlay only ever opens on
  // that card, and X only ever acts on it.
  // Which parameter the canvas is pointing at, if any. Read here rather than
  // passed down: the dot doing the pointing is on the board, and nothing on the
  // way from there to this card knows about either end.
  const spotlitParam = useParamSpotlightStore(s => s.spotlight?.param ?? null);

  const focusedParam = filteredParams[focusedIndex];
  const focusedParamValue = focusedParam ? parameters[focusedParam.name] : undefined;
  const isDarkMode = useDarkMode();
  const iconFont = useIconFont() as IconFamily;
  const allWantTypes = useWantTypeStore((st) => st.wantTypes);
  /** The provider's category, needed to resolve its icon. */
  const recCategory = useCallback(
    (typeName: string) => allWantTypes.find((t) => t.name === typeName)?.category ?? '',
    [allWantTypes],
  );

  const aura = useAuraNaming({
    value: focusedParamValue,
    subType: focusedParam ? (selfDescribedSubtype(focusedParamValue) || focusedParam.subType) : undefined,
  });
  // What the focused parameter turned out to be, for Y. Asked once, for the
  // focused card, the same way its aura is — the marks each card DRAWS are
  // asked for by the card itself (see ParamMarks).
  const { marks: focusedMarks } = useThingNames(
    focusedParamValue,
    focusedParam ? (selfDescribedSubtype(focusedParamValue) || focusedParam.subType) : undefined,
  );
  const jumpToMark = useMarkJump();

  const buildParamOverlayItems = useCallback((
    param: ParameterDef,
    index: number,
    ctx: { isParamRef: boolean; paramRef: string | null; isModified: boolean; origVal: unknown },
  ): OverlayItem[] => {
    const close = () => setOverlayIndex(null);
    return [
      // Same first slot, colour and semantics as the field cards' Aura action:
      // name this value, or rename / delete the name it already carries.
      ...(index === focusedIndex && aura.nameable ? [{
        icon: <Star className="w-4 h-4 text-white" />,
        label: 'Aura',
        title: aura.myNamedDef
          ? `Rename or delete the name "${aura.myNamedDef.name}"`
          : `Name this ${aura.catalogKind}`,
        onClick: () => { close(); aura.open(); },
        colorClass: aura.myNamedDef ? 'bg-amber-600/90' : 'bg-amber-500/75',
        delay: 0,
      }] : []),
      {
        icon: <Edit3 className="w-4 h-4 text-white" />,
        label: 'Edit',
        title: 'Edit this parameter',
        onClick: () => { close(); setFocusedIndex(index); setEditingIndex(index); onDetailFocusEnter?.(); },
        colorClass: 'bg-blue-600/80',
        delay: 0,
      },
      {
        icon: <Globe className="w-4 h-4 text-white" />,
        label: ctx.isParamRef ? 'Literal' : 'Ref',
        title: ctx.isParamRef ? 'Global param 参照をやめてリテラル値に戻す' : 'Global param を参照する',
        onClick: () => { close(); handleToggleParamRef(param.name, ctx.isParamRef ? (ctx.paramRef ?? '') : null); },
        colorClass: ctx.isParamRef ? 'bg-teal-600/90' : 'bg-teal-500/75',
        delay: 30,
      },
      {
        icon: <RotateCcw className="w-4 h-4 text-white" />,
        label: 'Reset',
        title: ctx.isModified ? '既定値に戻す' : '変更されていません',
        onClick: () => { close(); handleUpdateParam(param.name, String(ctx.origVal ?? ''), param.type); },
        colorClass: 'bg-amber-500/80',
        delay: 60,
        disabled: !ctx.isModified,
      },
      {
        icon: <Trash2 className="w-4 h-4 text-white" />,
        label: 'Clear',
        title: param.required ? '必須パラメータは削除できません' : 'この値を未設定に戻す',
        onClick: () => {
          close();
          const next = { ...parametersRef.current };
          delete next[param.name];
          onChangeRef.current(next);
        },
        colorClass: 'bg-red-600/80',
        delay: 90,
        disabled: param.required,
      },
      {
        icon: <X className="w-4 h-4 text-white" />,
        label: 'Close',
        title: 'Close',
        onClick: close,
        colorClass: 'bg-gray-600/75',
        delay: 120,
      },
    ];
  // aura/focusedIndex belong here: the builder runs during render, so without
  // them the Aura entry would describe whichever card was focused when this
  // callback was last created.
  }, [handleToggleParamRef, handleUpdateParam, onDetailFocusEnter, aura, focusedIndex]);

  const hiddenOptionalCount = (parameterDefinitions ?? []).filter(
    p => !p.required && parameters[p.name] === undefined
  ).length;

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* iOS keyboard proxy — see iosProxyRef declaration for explanation */}
      <input
        ref={iosProxyRef}
        aria-hidden="true"
        tabIndex={-1}
        readOnly={false}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 1,
          height: 1,
          fontSize: 16, // ≥16px prevents iOS auto-zoom
          pointerEvents: 'none',
          border: 'none',
          outline: 'none',
          padding: 0,
          margin: 0,
          zIndex: -1,
        }}
      />
      <div {...gridProps} className="grid grid-cols-3 sm:grid-cols-2 gap-1 sm:gap-2 outline-none">
        {filteredParams.map((param, index) => {
            const hasEnum = !!(param.validation?.enum?.length);
            const isArray = param.type === 'array';
            const isCheckbox = param.type === 'bool';
            const isNumber = param.type === 'int' || param.type === 'float64';
            const isWantType = param.type === 'want_type';
            // A parameter that names a person.
            //
            // Characters are not a catalogue of remembered values the way a
            // subType is — they exist, they are few, and they are known — so
            // the field offers the ones there are rather than a box to type an
            // id into. Declared as a type rather than a subType for the same
            // reason want_type is: the set comes from the app, not from what
            // anybody has typed before.
            const isCharacter = param.type === 'character';
            const sliderMin = param.validation?.min ?? 0;
            const sliderMax = param.validation?.max ?? 100;
            const isSlider = isNumber && param.validation?.min !== undefined && param.validation?.max !== undefined;
            const sliderStep = param.type === 'int' ? 1 : Math.max(0.001, (sliderMax - sliderMin) / 100);
            const hasGlobal = !!param.defaultGlobalParameter;
            const isOverride = globalOverrides[param.name] ?? false;
            const globalValue = hasGlobal ? globalParams[param.defaultGlobalParameter!] : undefined;
            const currentValue = parameters[param.name];
            const isFocused = focusedIndex === index;
            // The board is pointing at this parameter — CursorMan is standing on
            // the dot that stands for it. A ring of its own, not the focus ring:
            // the two say different things and can be true at once.
            const isSpotlit = spotlitParam === param.name;
            const isEditing = editingIndex === index;

            // Want-level fromGlobalParam reference (also true when in pending-ref-mode UI)
            const paramRef = getParamRef(currentValue);
            const isParamRef = paramRef !== null || pendingRefMode.has(param.name);

            const origVal = originalParameters[param.name] ?? param.default ?? param.example;
            const isModified = currentValue !== undefined &&
              !isParamRef &&
              String(currentValue) !== String(origVal ?? '');

            const isEmpty = !isParamRef && (!hasGlobal || isOverride) &&
              (currentValue === undefined || currentValue === '');

            let displayValue = '';
            const isScalar = typeof currentValue === 'string' || typeof currentValue === 'number' || typeof currentValue === 'boolean';
            if (currentValue !== undefined && !isParamRef && isScalar) displayValue = String(currentValue);
            else if (!isParamRef) {
              if (param.example !== undefined) displayValue = String(param.example);
              else if (param.default !== undefined) displayValue = String(param.default);
            }

            // Self-descriptive object subtype (see datatypes.yaml): a JSON param value
            // like { lat, lng, type: "location_coordinate" } names its own subtype,
            // taking precedence over the declared param.subType.
            const effectiveParamSubType = selfDescribedSubtype(currentValue) || param.subType;
            const subTypeDataType = effectiveParamSubType ? getDataTypeInfo(effectiveParamSubType) : null;
            const subTypeIcon = resolveLucideIcon(subTypeDataType?.icon);
            const subTypeColor = subTypeDataType?.color;
            const typeStyle = getTypeStyle(param.type, hasEnum, subTypeIcon);
            const { scheme: ts, BgIcon } = typeStyle;

            // ── Character multi-select card (full width) ────────────────────
            if (isArray && param.subType === 'character_ids') {
              const selectedIds: string[] = Array.isArray(currentValue) ? currentValue : [];
              return (
                <DisplayCard
                  key={param.name}
                  className={classNames(
                    'col-span-full relative rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 transition-all duration-150 cursor-pointer shadow-sm',
                    isFocused
                      ? 'shadow-md mw-card-focus bg-white dark:bg-gray-800'
                      : `${ts.cardBg} ${ts.cardHover}`,
                    isSpotlit && 'outline outline-2 outline-offset-2 outline-sky-400',
                  )}
                  BgIcon={BgIcon}
                  bgIconColor={subTypeColor ? '' : ts.bgIconColor}
                inkColor={subTypeColor || ts.color}
                  bgIconStyle={subTypeColor ? { color: subTypeColor } : undefined}
                  showBgIcon={true}
                  showFocusBar={isFocused}
                  onClick={() => { setFocusedIndex(index); onDetailFocusEnter?.(); }}
                  dataAttrs={{ 'data-robot-target': 'param_field', 'data-robot-param': param.name, 'data-param-key': param.name }}
                backgroundImage={isEditing ? undefined : param.backgroundImage}
                  headerLeft={
                    <>
                      <span className="text-[11px] font-semibold card-ink truncate leading-none">
                        {param.title || param.name}{param.required && <span className="text-red-500 ml-0.5">★</span>}
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-1">{selectedIds.length} selected</span>
                    </>
                  }
                >
                  <CharacterMultiSelect
                    characters={characters}
                    selectedIds={selectedIds}
                    onChange={ids => onChange({ ...parameters, [param.name]: ids })}
                  />
                </DisplayCard>
              );
            }

            // ── Array card (full width) ──────────────────────────────────────
            if (isArray) {
              const items: any[] = Array.isArray(currentValue) ? currentValue : [];
              const handleItemChange = (i: number, text: string) => {
                const next = [...items];
                next[i] = parseItem(text);
                onChange({ ...parameters, [param.name]: next });
              };
              const handleItemRemove = (i: number) => {
                const next = items.filter((_, idx) => idx !== i);
                onChange({ ...parameters, [param.name]: next });
              };
              const handleItemAdd = () => {
                // If existing items are objects, add an empty object; otherwise add empty string
                const template = items.length > 0 && typeof items[0] === 'object' && !Array.isArray(items[0])
                  ? {} : '';
                onChange({ ...parameters, [param.name]: [...items, template] });
              };
              return (
                <DisplayCard
                  key={param.name}
                  className={classNames(
                    'col-span-full relative rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 transition-all duration-150 cursor-pointer shadow-sm',
                    isFocused
                      ? 'shadow-md mw-card-focus bg-white dark:bg-gray-800'
                      : `${ts.cardBg} ${ts.cardHover}`,
                    isSpotlit && 'outline outline-2 outline-offset-2 outline-sky-400',
                  )}
                  BgIcon={BgIcon}
                  bgIconColor={subTypeColor ? '' : ts.bgIconColor}
                inkColor={subTypeColor || ts.color}
                  bgIconStyle={subTypeColor ? { color: subTypeColor } : undefined}
                  showBgIcon={true}
                  showFocusBar={isFocused}
                  onClick={() => { setFocusedIndex(index); onDetailFocusEnter?.(); }}
                  dataAttrs={{ 'data-robot-target': 'param_field', 'data-robot-param': param.name, 'data-param-key': param.name }}
                backgroundImage={isEditing ? undefined : param.backgroundImage}
                  headerLeft={
                    <>
                      <span className="text-[11px] font-semibold card-ink truncate leading-none">
                        {param.title || param.name}{param.required && <span className="text-red-500 ml-0.5">★</span>}
                      </span>
                      <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-1">{items.length} items</span>
                    </>
                  }
                >
                  {/* Item sub-cards */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((item, i) => {
                      const isObj = item !== null && typeof item === 'object' && !Array.isArray(item);
                      return (
                        <div
                          key={i}
                          onClick={e => e.stopPropagation()}
                          className="relative rounded-lg border border-indigo-200 dark:border-indigo-700/60 bg-white/70 dark:bg-gray-800/70 p-2 flex flex-col gap-1"
                        >
                          {/* Sub-card header */}
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[9px] font-semibold text-indigo-400 dark:text-indigo-500">#{i + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleItemRemove(i)}
                              className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          {/* Sub-card body: key-value pairs for objects, single input for primitives */}
                          {isObj ? (
                            <div className="space-y-1">
                              {Object.entries(item as Record<string, any>).map(([k, v]) => (
                                <div key={k} className="flex items-center gap-1">
                                  <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate w-16 flex-shrink-0">{k}</span>
                                  <CommitInput
                                    type="text"
                                    value={String(v ?? '')}
                                    onChange={val => {
                                      const updated = { ...(item as Record<string, any>), [k]: parseItem(val) };
                                      handleItemChange(i, JSON.stringify(updated));
                                    }}
                                    className="flex-1"
                                    multiline={false}
                                  />
                                </div>
                              ))}
                              {/* Add key button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const key = prompt('Key name:');
                                  if (!key) return;
                                  const updated = { ...(item as Record<string, any>), [key]: '' };
                                  handleItemChange(i, JSON.stringify(updated));
                                }}
                                className="text-[9px] text-indigo-400 hover:text-indigo-600 dark:text-indigo-500 flex items-center gap-0.5"
                              >
                                <Plus className="w-2.5 h-2.5" /> key
                              </button>
                            </div>
                          ) : (
                            <CommitInput
                              type="text"
                              value={serializeItem(item)}
                              onChange={text => handleItemChange(i, text)}
                              placeholder="value"
                              className="w-full"
                              multiline={false}
                            />
                          )}
                        </div>
                      );
                    })}
                    {/* Add item placeholder card */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleItemAdd(); }}
                      className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-indigo-200 dark:border-indigo-700/60 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group min-h-[4rem] bg-transparent"
                    >
                      <Plus className="w-4 h-4 text-indigo-300 dark:text-indigo-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                      <span className="text-[9px] text-indigo-300 dark:text-indigo-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">Add item</span>
                    </button>
                  </div>
                </DisplayCard>
              );
            }

            // ── Normal card ──────────────────────────────────────────────────
            return (
              <DisplayCard
                key={param.name}
                dataAttrs={{ 'data-robot-target': 'param_field', 'data-robot-param': param.name, 'data-param-key': param.name }}
                backgroundImage={isEditing ? undefined : param.backgroundImage}
                className={classNames(
                  'relative rounded-lg sm:rounded-xl p-1.5 transition-all duration-150 cursor-pointer shadow-sm',
                  !isEditing && 'h-14',
                  isFocused
                    ? 'shadow-md mw-card-focus bg-white dark:bg-gray-800'
                    : isModified
                      ? 'bg-amber-50/60 dark:bg-amber-900/20 shadow hover:shadow-md hover:bg-amber-100/60 dark:hover:bg-amber-900/30'
                      : param.required && isEmpty
                        ? 'bg-red-50/40 dark:bg-red-900/15 shadow-sm hover:shadow hover:bg-red-100/40 dark:hover:bg-red-900/25'
                        : `${ts.cardBg} ${ts.cardHover}`
                )}
                BgIcon={BgIcon}
                bgIconColor={subTypeColor ? '' : ts.bgIconColor}
                inkColor={subTypeColor || ts.color}
                bgIconStyle={subTypeColor ? { color: subTypeColor } : undefined}
                showBgIcon={true}
                showFocusBar={isFocused}
                // Right-click opens the action overlay, matching the state
                // field cards. Focus moves here first so the overlay's Aura
                // entry describes THIS card's value.
                onContextMenu={(e) => {
                  e.preventDefault();
                  setFocusedIndex(index);
                  setOverlayIndex(index);
                }}
                overlay={overlayIndex === index ? (
                  <OverlayActionGrid
                    items={buildParamOverlayItems(param, index, { isParamRef, paramRef, isModified, origVal })}
                    cols={3}
                    onClose={() => setOverlayIndex(null)}
                    showLabel={true}
                    className="absolute inset-0 z-20 rounded-lg overflow-hidden"
                    onMouseDown={e => e.stopPropagation()}
                  />
                ) : undefined}
                onClick={() => {
                  if (overlayIndex === index) return;   // overlay owns the clicks
                  // iOS: focus a real <input> synchronously so the keyboard opens.
                  iosProxyRef.current?.focus();
                  // Prevent focusedIndex effect from resetting editingIndex.
                  skipEditResetRef.current = true;
                  setFocusedIndex(index); setEditingIndex(index); onDetailFocusEnter?.();
                }}
                headerLeft={
                  <span className="text-[11px] font-semibold card-ink truncate leading-none">
                    {param.title || param.name}{param.required && <span className="text-red-500 ml-0.5">★</span>}
                  </span>
                }
                headerRight={
                  <>
                    {hasGlobal && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleToggleGlobal(param.name); }}
                        title={isOverride ? `Custom (click → global: ${param.defaultGlobalParameter})` : `Global: ${param.defaultGlobalParameter} (click → override)`}
                        className={classNames(
                          'flex items-center px-1 py-0.5 rounded-full text-[8px] transition-colors',
                          isOverride
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                        )}
                      >
                        <Link className="w-2 h-2" />
                      </button>
                    )}
                    {isModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Modified" />
                    )}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleToggleParamRef(param.name, isParamRef ? (paramRef ?? '') : null); }}
                      title={isParamRef ? 'Global paramを参照中 — クリックでリテラル値に戻す' : 'Global paramを参照する'}
                      className={classNames(
                        'w-4 h-4 flex items-center justify-center rounded transition-colors',
                        isParamRef
                          ? 'text-teal-500 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40'
                          : 'text-teal-700/30 dark:text-teal-500/30 hover:text-teal-500 dark:hover:text-teal-400 hover:bg-teal-100/50 dark:hover:bg-teal-900/30'
                      )}
                    >
                      <Globe className="w-2.5 h-2.5" />
                    </button>
                  </>
                }
              >
                {/* Input area — display box when not editing, actual control when editing */}
                {isEditing ? (
                  /* ── Edit mode: real input, Escape/blur → exit ── */
                  <div
                    className="min-w-0"
                    onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); exitEditMode(); } }}
                    onBlur={e => { const rt = e.relatedTarget as Node | null; if (!rt || !e.currentTarget.contains(rt)) exitEditMode(); }}
                  >
                    {isSlider && !isParamRef && (!hasGlobal || isOverride) ? (
                      <NumberSliderInput
                        value={typeof currentValue === 'number' ? currentValue : (typeof param.default === 'number' ? param.default : sliderMin)}
                        min={sliderMin}
                        max={sliderMax}
                        step={sliderStep}
                        onChange={v => handleUpdateParam(param.name, String(v), param.type)}
                      />
                    ) : isParamRef ? (
                      <SelectInput
                        ref={el => { inputRefs.current[index] = el; }}
                        value={paramRef ?? ''}
                        onChange={val => handleUpdateParamRef(param.name, val)}
                        options={[
                          { value: '', label: '— select global param —' },
                          ...Object.keys(globalParams).map(k => ({ value: k })),
                        ]}
                        className="w-full"
                        transparent
                      />
                    ) : hasGlobal && !isOverride && !hasEnum ? (
                      <span className="block text-sm text-purple-500 dark:text-purple-400 italic truncate">
                        {globalValue !== undefined
                          ? String(globalValue)
                          : <span className="text-gray-300 dark:text-gray-600 not-italic text-xs">global</span>}
                      </span>
                    ) : isWantType ? (
                      <SelectInput
                        ref={el => { inputRefs.current[index] = el; }}
                        value={displayValue}
                        onChange={val => handleUpdateParam(param.name, val, param.type)}
                        options={[{ value: '', label: '— select type —' }, ...wantTypeOptions]}
                        className="w-full"
                        transparent
                      />
                    ) : isCharacter ? (
                      <EnumToggleGroup
                        ref={el => { inputRefs.current[index] = el; }}
                        value={String(displayValue ?? '')}
                        onChange={val => handleUpdateParam(param.name, val, param.type)}
                        options={characterOptions}
                        className="w-full"
                        wrap
                      />
                    ) : hasEnum ? (
                      <EnumToggleGroup
                        ref={el => { inputRefs.current[index] = el; }}
                        value={String(hasGlobal && !isOverride && globalValue !== undefined ? globalValue : displayValue)}
                        onChange={val => {
                          if (hasGlobal && !isOverride) setGlobalOverrides(prev => ({ ...prev, [param.name]: true }));
                          handleUpdateParam(param.name, val, param.type);
                        }}
                        options={(param.validation!.enum! as string[]).map(v => ({ value: String(v) }))}
                        className="w-full"
                      />
                    ) : isCheckbox ? (
                      <input
                        type="checkbox"
                        checked={Boolean(currentValue ?? param.default ?? false)}
                        onChange={e => handleUpdateParam(param.name, String(e.target.checked), 'bool')}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded mt-0.5"
                      />
                    ) : (
                      <>
                        <CommitInput
                          ref={el => { inputRefs.current[index] = el as CommitInputHandle | null; }}
                          type={isNumber ? 'number' : 'text'}
                          value={displayValue}
                          onChange={val => handleUpdateParam(param.name, val, param.type)}
                          placeholder={param.description || '—'}
                          className="w-full"
                          multiline={false}
                          transparent
                        />
                        {/* Things this parameter takes (skip when recordThing=false).
                            Drawn across every accepted subtype, deduped: two
                            catalogs can hold the same name and it is one
                            suggestion either way. */}
                        {param.subType && (param.recordThing ?? param.recordMemo) !== false && (() => {
                          const offered = [...new Set(acceptedSubTypes(param).flatMap(st => thingSuggestions[st] ?? []))];
                          return offered.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {offered.map(s => (
                              <button
                                key={s}
                                type="button"
                                onMouseDown={e => { e.preventDefault(); handleUpdateParam(param.name, s, param.type); }}
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/60 transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ) : (
                  /* ── Display mode: bottom-right aligned within fixed card height ── */
                  isEmpty && (recommendations[param.name]?.length ?? 0) > 0 ? (
                    /* Nothing here yet, but the system knows values that fit —
                       offer them where the value would go, so filling a want is
                       a tap. Each chip pops in as it arrives. */
                    <div className="h-full flex flex-col items-end justify-end gap-0.5 overflow-hidden">
                      {/* Says out loud that nothing has been chosen. Without it
                          the candidates sit where a value sits and read as an
                          answer already given. */}
                      <span className={classNames(
                        'text-[9px] font-bold uppercase tracking-wide leading-none',
                        param.required ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500',
                      )}>
                        {param.required ? 'Choose one' : 'Suggestions'}
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {recommendations[param.name]!
                          // A value already sitting in another parameter is not
                          // a candidate here — offering the destination back as
                          // a possible origin is noise.
                          .filter((rec) => !Object.entries(parameters).some(
                            ([k, v]) => k !== param.name && v != null && v !== '' && String(v) === String(rec.value),
                          ))
                          .map((rec, ri) => (
                          <button
                            key={`${rec.sourceId ?? 'thing'}-${rec.paramName}-${String(rec.value)}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onApplyRecommendation) onApplyRecommendation(rec);
                              else handleUpdateParam(param.name, String(rec.value), param.type);
                            }}
                            className="animate-card-enter inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-gray-400/70 dark:border-gray-500/70 bg-transparent text-gray-500 dark:text-gray-400 hover:border-solid hover:bg-white dark:hover:bg-gray-900 hover:text-gray-800 dark:hover:text-gray-100 transition-colors max-w-[8.5rem]"
                            style={{ animationDelay: `${ri * 45}ms` }}
                            title={rec.sourceName === 'thing'
                              ? 'Remembered value'
                              : `${rec.sourceName} — follows this want when it changes`}
                          >
                            {/* Whose value this is. Several wants can offer the
                                same field, so the type icon is what tells them
                                apart; the thing gets its own mark. */}
                            {rec.sourceType ? (
                              <WantIcon
                                typeName={rec.sourceType}
                                category={recCategory(rec.sourceType)}
                                iconFont={iconFont}
                                size={11}
                                iconStyle={wantTypeIconStyle(rec.sourceType, recCategory(rec.sourceType), isDarkMode)}
                                className="flex-shrink-0"
                              />
                            ) : (
                              <NotebookPen className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                            )}
                            <span className="truncate">{String(rec.value)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                  <div className="h-full flex items-end justify-end overflow-hidden relative">
                    {isEmpty && param.required && (
                      <span className="absolute top-0 right-0 text-[9px] font-bold uppercase tracking-wide leading-none text-amber-600 dark:text-amber-400">
                        Required
                      </span>
                    )}
                    {isSlider && !isParamRef && (!hasGlobal || isOverride) ? (
                      <div className="w-full flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300 min-w-[2.5rem] text-right tabular-nums">
                          {displayValue || String(sliderMin)}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={classNames('h-full rounded-full transition-all', ts.bgIconColor.replace('text-', 'bg-'))}
                            style={{ width: `${Math.max(0, Math.min(100, ((Number(displayValue || sliderMin) - sliderMin) / (sliderMax - sliderMin)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    ) : isParamRef ? (
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-2.5 h-2.5 text-teal-500 dark:text-teal-400 flex-shrink-0" />
                        <span className="text-xs text-teal-600 dark:text-teal-400 truncate">
                          {paramRef || <span className="italic text-[10px] text-gray-400 dark:text-gray-600">— select —</span>}
                        </span>
                      </div>
                    ) : hasGlobal && !isOverride && !hasEnum ? (
                      (() => {
                        const shownText = globalValue !== undefined ? String(globalValue) : '—';
                        const bigFont = shownText.length <= 8;
                        return (
                          <span className={classNames(
                            'italic text-right leading-none',
                            bigFont ? 'text-2xl font-medium text-purple-500 dark:text-purple-400' : 'text-xs text-purple-500 dark:text-purple-400 truncate',
                          )}>
                            {shownText}
                          </span>
                        );
                      })()
                    ) : isCheckbox ? (
                      <span className={classNames(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors',
                        Boolean(currentValue ?? param.default ?? false)
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        {Boolean(currentValue ?? param.default ?? false) ? 'ON' : 'OFF'}
                      </span>
                    ) : isCharacter ? (
                      // The person, not their id. Picking somebody by their
                      // face and then being shown chr-2c52fa0b undoes the point
                      // of picking by face; the id is what gets stored, and
                      // nobody needs to read it.
                      <span className={classNames(
                        'text-[10px] font-medium px-2 py-0.5 rounded border truncate',
                        ts.cardBg, ts.iconColor, ts.formBorder,
                      )}>
                        {characterOptions.find(o => o.value === displayValue)?.label
                          || (displayValue ? `? ${displayValue}` : '—')}
                      </span>
                    ) : hasEnum ? (
                      <span className={classNames(
                        'text-[10px] font-medium px-2 py-0.5 rounded border truncate',
                        ts.cardBg, ts.iconColor, ts.formBorder,
                      )}>
                        {String(hasGlobal && !isOverride && globalValue !== undefined ? globalValue : displayValue) || '—'}
                      </span>
                    ) : (() => {
                      const shownText = displayValue || param.description || '—';
                      const bigFont = shownText.length <= 8;
                      const paramValueColor = (() => {
                        if (param.type === 'percent' && displayValue) {
                          const n = parseFloat(displayValue);
                          if (!isNaN(n)) {
                            if (n >= 80) return 'text-red-600 dark:text-red-400';
                            if (n >= 70) return 'text-orange-500 dark:text-orange-400';
                          }
                        }
                        // An example standing in for an unanswered parameter is
                        // shown faintly, so it reads as "a value like this" and
                        // never as an answer already given.
                        if (isEmpty) return 'text-gray-400/60 dark:text-gray-500/60 italic';
                        return displayValue ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600';
                      })();
                      return (
                        <span className={classNames(
                          'italic text-right leading-none',
                          bigFont ? 'text-2xl font-medium' : 'text-xs truncate',
                          paramValueColor,
                        )}>
                          {shownText}
                        </span>
                      );
                    })()}
                  </div>
                  )
                )}

                {isFocused && aura.editorNode}
                {/* What this value is, on every card that is something — not
                    only the focused one. The naming flow runs once, for the
                    focused card (see `aura` above), and hanging the mark off it
                    meant a parameter holding a thing looked like a plain value
                    until you happened to land on it. The mark is a property of
                    the value, so it is asked for per card. Out of the way while
                    the card is being edited: the editor owns the whole card. */}
                {!isEditing && <ParamMarks value={currentValue} subType={effectiveParamSubType} />}
              </DisplayCard>
            );
          })}
        {/* Extra custom params not in parameterDefinitions */}
        {extraParamKeys.map((key, ei) => {
          const extraIndex = filteredParams.length + ei;
          const isExtraFocused = focusedIndex === extraIndex;
          const isExtraEditing = editingIndex === extraIndex;
          const extraValue = String(parameters[key] ?? '');
          return (
            <DisplayCard
              key={`extra-${key}`}
              dataAttrs={{ 'data-robot-target': 'param_field', 'data-robot-param': key, 'data-param-key': key }}
              className={classNames(
                'relative rounded-lg sm:rounded-xl p-1.5 transition-all duration-150 cursor-pointer shadow-sm',
                !isExtraEditing && 'h-14',
                isExtraFocused
                  ? 'shadow-md mw-card-focus bg-white dark:bg-gray-800'
                  : `${BLUE_SCHEME.cardBg} ${BLUE_SCHEME.cardHover}`
              )}
              BgIcon={Type}
              bgIconColor={BLUE_SCHEME.bgIconColor}
              showBgIcon={true}
              showFocusBar={isExtraFocused}
              onClick={() => {
                iosProxyRef.current?.focus();
                skipEditResetRef.current = true;
                setFocusedIndex(extraIndex); setEditingIndex(extraIndex); onDetailFocusEnter?.();
              }}
              headerLeft={
                <span className="text-[11px] font-semibold card-ink truncate leading-none">{key}</span>
              }
              headerRight={
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); const next = { ...parameters }; delete next[key]; onChange(next); }}
                  className="w-4 h-4 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              }
            >
              {isExtraEditing ? (
                <div
                  className="min-w-0"
                  onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); exitEditMode(); } }}
                  onBlur={e => { const rt = e.relatedTarget as Node | null; if (!rt || !e.currentTarget.contains(rt)) exitEditMode(); }}
                >
                  <CommitInput
                    ref={el => { inputRefs.current[extraIndex] = el as CommitInputHandle | null; }}
                    type="text"
                    value={extraValue}
                    onChange={val => onChange({ ...parameters, [key]: val })}
                    placeholder="value"
                    className="w-full"
                    multiline={false}
                    transparent
                  />
                </div>
              ) : (() => {
                const shownExtra = extraValue || '—';
                const bigFont = shownExtra.length <= 8;
                return (
                  <div className="h-full flex items-end justify-end overflow-hidden">
                    <span className={classNames(
                      'italic text-right leading-none',
                      bigFont ? 'text-2xl font-medium' : 'text-xs truncate',
                      extraValue ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600',
                    )}>
                      {shownExtra}
                    </span>
                  </div>
                );
              })()}
              {/* A custom parameter carries a value like any other, so it wears
                  the same mark. It has no declared subtype — whatever the value
                  describes itself as is all there is to go on. */}
              {!isExtraEditing && <ParamMarks value={parameters[key]} />}
            </DisplayCard>
          );
        })}
        {/* Add param dashed card */}
        {pendingKey === null ? (
          <AddCard
            borderClass={BLUE_SCHEME.addBorder}
            iconClass={BLUE_SCHEME.addIcon}
            label="Add param"
            onClick={() => setPendingKey('')}
            isFocused={focusedIndex === addCardIndex}
          />
        ) : (
          <FormCard
            borderClass={BLUE_SCHEME.formBorder}
            bgClass={BLUE_SCHEME.formBg}
            saveColorClass={BLUE_SCHEME.saveColor}
            header={<><Type className="w-2.5 h-2.5 text-blue-400" /><span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">New parameter</span></>}
            onSave={() => { if (pendingKey.trim() && !definedParamNames.has(pendingKey.trim())) { onChange({ ...parameters, [pendingKey.trim()]: '' }); setPendingKey(null); } }}
            onCancel={() => setPendingKey(null)}
            saveDisabled={!pendingKey.trim() || definedParamNames.has(pendingKey.trim())}
          >
            <input
              autoFocus
              value={pendingKey}
              onChange={e => setPendingKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && pendingKey.trim() && !definedParamNames.has(pendingKey.trim())) {
                  onChange({ ...parameters, [pendingKey.trim()]: '' });
                  setPendingKey(null);
                }
                if (e.key === 'Escape') setPendingKey(null);
              }}
              placeholder="key name"
              className="w-full text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </FormCard>
        )}
      </div>

      {/* Optional params toggle — only shown when there are actually hidden optional params */}
      {hiddenOptionalCount > 0 && (
        <button
          type="button"
          onClick={() => setShowOptional(v => !v)}
          className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          {showOptional ? '▼ Hide' : '▶ Show'} optional ({hiddenOptionalCount})
        </button>
      )}

    </div>
  );
};

ParameterGridSection.displayName = 'ParameterGridSection';
