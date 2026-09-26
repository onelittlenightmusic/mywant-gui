import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { EnumToggleGroup, EnumToggleGroupHandle } from '@/components/common/EnumToggleGroup';
import { DogEarBookmarks } from '@/components/common/DogEarBookmarks';
import { WantCardLayout } from '../../WantCardLayout';
import { useInputActions } from '@/hooks/useInputActions';
import { useCharacterStore } from '@/stores/characterStore';
import { auraMarkFor, AuraMark } from '@/types/character';

const getChoiceLabel = (choice: any): string => {
  if (typeof choice === 'object') {
    if (choice.room && choice.date && choice.time) return `${choice.room} (${choice.date} ${choice.time})`;
    return choice.label || choice.name || choice.room || JSON.stringify(choice);
  }
  return String(choice);
};

const getChoiceValue = (choice: any): string =>
  typeof choice === 'object' ? JSON.stringify(choice) : String(choice);

const ChoiceContentSection: React.FC<WantCardPluginProps> = ({
  want, isChild, isControl, isFocused, isInnerFocused, onExitInnerFocus, isExpanded,
}) => {
  const choiceSelected = want.state?.current?.selected;
  const choices = Array.isArray(want.state?.current?.choices) ? want.state.current.choices : [];
  // Derive label from spec.exposes (asGoal or as) rather than the removed target_param state field.
  const selectedExpose = want.spec?.exposes?.find((e: any) => e.currentState === 'selected');
  const choiceTargetParam = (selectedExpose?.asGoal ?? selectedExpose?.as ?? '') as string;

  const [localValue, setLocalValue] = useState(choiceSelected);
  const enumRef = useRef<EnumToggleGroupHandle>(null);

  useEffect(() => { setLocalValue(choiceSelected); }, [choiceSelected]);

  // Hand native focus to the trigger button when the want card enters inner-focus mode
  useEffect(() => {
    if (isInnerFocused) enumRef.current?.focus();
  }, [isInnerFocused]);

  // ── Aura-default marking: x/X marks whichever option is currently under the
  // cursor (pill nav cursor, or hover in the expanded list) as *my* character's
  // default pick for this choice want — shown as an aura-colored star badge
  // (DogEarBookmarks), not the dog-ear flag other want cards use. Persisted
  // server-side on the Character record (wantId → choice), not on the want
  // itself, since it's a per-character preference.
  const wantId = want.metadata?.id;
  const characters = useCharacterStore(s => s.characters);
  const myCharacterId = useCharacterStore(s => s.myCharacterId);
  const setAuraDefault = useCharacterStore(s => s.setAuraDefault);

  const wantType = want.metadata?.type;

  const getMarkColors = useCallback((value: string): string[] => {
    return characters
      .filter(c => auraMarkFor(c, wantType, 'current', 'selected')?.value === value)
      .map(c => c.color);
  }, [characters, wantType]);

  const handleMarkDefault = useCallback((value: string | undefined) => {
    if (!wantId || !wantType || !myCharacterId || !value) return;
    const mine = characters.find(c => c.id === myCharacterId);
    const marked = mine ? auraMarkFor(mine, wantType, 'current', 'selected') : undefined;
    const next = marked?.value === value ? '' : value;
    setAuraDefault(wantId, wantType, 'current', 'selected', next);
  }, [wantId, wantType, myCharacterId, characters, setAuraDefault]);

  // Pill nav cursor (compact card view) — kept in sync by EnumToggleGroup's onCursorChange.
  const [pillCursorValue, setPillCursorValue] = useState<string | undefined>(undefined);

  // While inner-focused: capture Arrow keys so they move the pill cursor instead
  // of triggering the grid's card navigation, capture Escape to exit, and x/X
  // marks the cursored pill as my aura-default.
  useInputActions({
    enabled: !!isInnerFocused,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onNavigate: (dir) => {
      if (dir === 'left')  enumRef.current?.moveCursor('left');
      if (dir === 'right') enumRef.current?.moveCursor('right');
    },
    onConfirm: () => enumRef.current?.confirm(),
    onCancel: () => onExitInnerFocus?.(),
    onButtonX: () => handleMarkDefault(pillCursorValue),
  });

  const options = choices.map((c: any) => ({ value: getChoiceValue(c), label: getChoiceLabel(c) }));

  const currentValueStr = localValue !== undefined && localValue !== null
    ? getChoiceValue(localValue) : '';

  const handleChange = async (val: string) => {
    const choice = choices.find((c: any) => getChoiceValue(c) === val);
    const newValue = choice ?? (val || null);
    setLocalValue(newValue);
    onExitInnerFocus?.();
    const id = want.metadata?.id;
    if (!id) return;
    try {
      await fetch(`/api/v1/webhooks/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', value: newValue }),
      });
    } catch (err) {
      console.error('[ChoiceCard] webhook failed:', err);
    }
  };

  // ── Expanded view: full-height scrollable list ──────────────────────────────
  const listRef = useRef<HTMLUListElement>(null);
  const selectedItemRef = useRef<HTMLLIElement>(null);

  // Hovered row (mouse) — the expanded list has no keyboard/gamepad cursor of its
  // own, so hover is the "current target" for x/X aura-default marking here.
  const [hoveredValue, setHoveredValue] = useState<string | undefined>(undefined);
  useInputActions({
    enabled: !!isExpanded,
    captureInput: true,
    ignoreWhenInputFocused: false,
    ignoreWhenInSidebar: false,
    onButtonX: () => handleMarkDefault(hoveredValue),
  });

  // Scroll selected item into the center of the list when expanded opens
  useEffect(() => {
    if (!isExpanded) return;
    // Wait for layout to settle (animation + render)
    const t = setTimeout(() => {
      const item = selectedItemRef.current;
      const list = listRef.current;
      if (!item || !list) return;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      // Scroll so the item center aligns with the list center
      const targetScrollTop =
        list.scrollTop + (itemRect.top - listRect.top) - listRect.height / 2 + itemRect.height / 2;
      list.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
    }, 120);
    return () => clearTimeout(t);
  }, [isExpanded, currentValueStr]);

  if (isExpanded) {
    return (
      <div className="flex flex-col h-full w-full min-h-0 px-4 py-3 gap-2" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 font-semibold text-gray-500 dark:text-gray-400 pb-1 border-b border-gray-200 dark:border-gray-700">
          {choiceTargetParam || 'Selection'}
          <span className="ml-2 font-normal text-gray-400 dark:text-gray-500 tabular-nums">
            {choices.length} options
          </span>
        </div>
        {/* Scrollable option list */}
        <ul ref={listRef} className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
          {choices.map((c: any, i: number) => {
            const val = getChoiceValue(c);
            const label = getChoiceLabel(c);
            const isSelected = val === currentValueStr;
            return (
              <li key={i} ref={isSelected ? selectedItemRef : undefined}>
                <button
                  type="button"
                  onClick={() => handleChange(val)}
                  onMouseEnter={() => setHoveredValue(val)}
                  className={[
                    'relative w-full text-left px-3 py-2 rounded-lg transition-colors',
                    isSelected
                      ? 'bg-blue-500 text-white font-medium shadow-sm'
                      : 'text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300',
                  ].join(' ')}
                >
                  {label}
                  <DogEarBookmarks colors={getMarkColors(val)} size={12} />
                </button>
              </li>
            );
          })}
          {choices.length === 0 && (
            <li className="text-gray-400 dark:text-gray-500 italic px-3 py-4 text-center">
              No options available
            </li>
          )}
        </ul>
      </div>
    );
  }

  // ── Normal (card) view: pill toggle ─────────────────────────────────────────
  return (
    <WantCardLayout
      centerContent
      content={
        <div className="w-full px-2" onMouseDown={(e) => e.stopPropagation()}>
          {options.length > 0 ? (
            <EnumToggleGroup
              ref={enumRef}
              value={currentValueStr}
              onChange={handleChange}
              options={options}
              wrap
              showCursor={!!isInnerFocused}
              onBlur={() => onExitInnerFocus?.()}
              onCursorChange={setPillCursorValue}
              getMarkColors={getMarkColors}
              markStyle="star"
              onButtonX={() => handleMarkDefault(pillCursorValue)}
            />
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-center italic">
              No options
            </p>
          )}
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['choice'],
  ContentSection: ChoiceContentSection,
  hideFinalResult: true, // Selection is already visible in the dropdown / expanded list
});
