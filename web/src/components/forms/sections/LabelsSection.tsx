import React, { useState, useCallback, useEffect, forwardRef, useRef } from 'react';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { Tag } from 'lucide-react';
import { SectionNavigationCallbacks } from '@/types/formSection';
import { CommitInputHandle } from '@/components/common/CommitInput';
import { LabelAutocomplete } from '@/components/forms/LabelAutocomplete';
import { CardGridShell, GREEN_SCHEME } from '@/components/forms/CardPrimitives';
import { classNames } from '@/utils/helpers';

interface LabelsSectionProps {
  labels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  navigationCallbacks: SectionNavigationCallbacks;
  hideHeader?: boolean;
  isActive?: boolean;
}

interface EditState {
  /** null = not editing; '__new__' = adding; key string = editing existing */
  key: string | null;
  draftKey: string;
  draftValue: string;
}

export const LabelsSection = forwardRef<HTMLButtonElement, LabelsSectionProps>(({
  labels,
  onChange,
  isActive = true,
}, ref) => {
  const [edit, setEdit] = useState<EditState>({ key: null, draftKey: '', draftValue: '' });
  const [navFocused, setNavFocused] = useState(-1);
  const autocompleteRef = useRef<CommitInputHandle>(null);

  const entries = Object.entries(labels);

  const editingIndex: number | null = (() => {
    if (edit.key === null) return null;
    if (edit.key === '__new__') return entries.length;
    const i = entries.findIndex(([k]) => k === edit.key);
    return i >= 0 ? i : null;
  })();

  const startAdd = useCallback(() =>
    setEdit({ key: '__new__', draftKey: '', draftValue: '' }), []);

  const startEdit = useCallback((i: number) => {
    const [key, value] = entries[i];
    setEdit({ key, draftKey: key, draftValue: value ?? '' });
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const navCount = entries.length + (editingIndex !== null ? 0 : 1);

  const { gridProps: navGridProps } = useCardGridNavigation({
    count: navCount,
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    onConfirm: (i) => { if (i === entries.length) startAdd(); else startEdit(i); },
  });

  useEffect(() => {
    if (isActive && navFocused < 0 && navCount > 0) setNavFocused(0);
    if (!isActive) setNavFocused(-1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const handleSave = useCallback(() => {
    const latest = (autocompleteRef.current as any)?.getValues?.() ?? { key: edit.draftKey, value: edit.draftValue };
    const k = (latest.key ?? '').trim();
    if (!k) return;
    const next = { ...labels };
    if (edit.key && edit.key !== '__new__' && edit.key !== k) delete next[edit.key];
    next[k] = latest.value ?? '';
    onChange(next);
    setEdit({ key: null, draftKey: '', draftValue: '' });
  }, [edit, labels, onChange]);

  const handleCancel = useCallback(() =>
    setEdit({ key: null, draftKey: '', draftValue: '' }), []);

  const handleDelete = useCallback((i: number) => {
    const [key] = entries[i];
    const next = { ...labels };
    delete next[key];
    onChange(next);
    if (edit.key === key) setEdit({ key: null, draftKey: '', draftValue: '' });
  }, [entries, labels, onChange, edit.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={ref as any}>
      <CardGridShell
        scheme={GREEN_SCHEME}
        BgIcon={Tag}
        count={entries.length}
        editingIndex={editingIndex}
        navFocusedIndex={navFocused}
        navGridProps={navGridProps}
        addLabel="Add label"
        onAdd={startAdd}
        onClickItem={startEdit}
        onDeleteItem={handleDelete}
        onSave={handleSave}
        onCancel={handleCancel}
        renderItemHeaderLeft={(i) => {
          const [key] = entries[i];
          return (
            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate leading-none font-mono">{key}</span>
          );
        }}
        renderItemBody={(i) => {
          const [, value] = entries[i];
          const shownText = value || '—';
          const bigFont = shownText.length <= 8;
          return (
            <div className={classNames(
              'italic text-right font-mono leading-tight',
              bigFont
                ? 'text-2xl font-medium text-green-700 dark:text-green-300'
                : 'text-[10px] text-green-700 dark:text-green-300 truncate',
            )}>
              {shownText}
            </div>
          );
        }}
        renderFormHeader={(isNew) => (
          <>
            <Tag className="w-2.5 h-2.5 text-green-400" />
            <span className="text-[10px] text-green-500 dark:text-green-400 font-medium">
              {isNew ? 'New label' : 'Edit label'}
            </span>
          </>
        )}
        renderFormContent={() => (
          <LabelAutocomplete
            ref={autocompleteRef}
            keyValue={edit.draftKey}
            valueValue={edit.draftValue}
            onKeyChange={k => setEdit(s => ({ ...s, draftKey: k }))}
            onValueChange={v => setEdit(s => ({ ...s, draftValue: v }))}
            onRemove={handleCancel}
            onLeftKey={handleCancel}
          />
        )}
        footerNote="Click a card to edit · hover to delete"
      />
    </div>
  );
});

LabelsSection.displayName = 'LabelsSection';
