import React, { useState, useCallback, useEffect, useId } from 'react';
import { useCardGridNavigation } from '@/hooks/useCardGridNavigation';
import { Radio, ArrowRight } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { CardGridShell, CYAN_SCHEME } from '@/components/forms/CardPrimitives';

/** One subscription: another want, by name, and the fields of it read. */
export interface SubscriptionEntry { wantName: string; stateKeys?: string[] }

interface SubscriptionSectionProps {
  subscriptions: SubscriptionEntry[];
  onSubscriptionsChange: (subs: SubscriptionEntry[]) => void;
  /** Names of the other wants, offered when adding one. */
  wantNames?: string[];
  isActive?: boolean;
  focusRequest?: number;
  /** Arrow-key ways out of this grid — see useCardGridNavigation. */
  onExitTop?: () => void;
  onExitBottom?: () => void;
}

const inputCls = classNames(
  'w-full text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 mb-1.5',
  'text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600',
  'border-cyan-200 dark:border-cyan-700',
  'focus:outline-none focus:ring-1 focus:ring-cyan-400',
);

/** A subscription's keys as written in its card and its form: "*" for all of them. */
const keysText = (keys?: string[]) => (keys && keys.length > 0 ? keys.join(', ') : '*');

/**
 * What this want reads straight off other wants (spec.stateSubscriptions):
 * another want, by name, and which of its fields — the cards Import and
 * Expose are drawn as, beside them on the Wiring tab.
 *
 * Where Import reads a key of the global state, whoever writes it, this
 * names the want it reads. It is how a battle's wants are joined — an enemy
 * to what it goes for, a turret to the enemy it is aimed at, a heal to what
 * it mends — and the battle rewrites those as it goes, so a card here can
 * change under you while one is being fought.
 */
export const SubscriptionSection: React.FC<SubscriptionSectionProps> = ({
  subscriptions,
  onSubscriptionsChange,
  wantNames = [],
  isActive = true,
  focusRequest,
  onExitTop,
  onExitBottom,
}) => {
  const datalistId = `subscription-wants-${useId()}`;
  // Which card the form is open on: an index, `subscriptions.length` for a
  // new one, or null.
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [keys, setKeys] = useState('');
  const [navFocused, setNavFocused] = useState(-1);

  const open = useCallback((i: number) => {
    const s = subscriptions[i];
    setName(s?.wantName ?? '');
    setKeys(s ? keysText(s.stateKeys) : '');
    setEditing(i);
  }, [subscriptions]);

  const { gridProps: navGridProps } = useCardGridNavigation({
    count: subscriptions.length + (editing === null ? 1 : 0),
    cols: 2,
    isActive,
    focusedIndex: navFocused,
    setFocusedIndex: setNavFocused,
    onConfirm: (i) => open(i),
    focusRequest,
    onExitTop,
    onExitBottom,
  });

  useEffect(() => {
    if (!isActive) setNavFocused(-1);
  }, [isActive]);

  const handleCancel = useCallback(() => {
    setEditing(null);
    setName('');
    setKeys('');
  }, []);

  const handleSave = useCallback(() => {
    const wantName = name.trim();
    if (!wantName || editing === null) return;
    const stateKeys = keys.split(',').map(k => k.trim()).filter(k => k && k !== '*');
    const entry: SubscriptionEntry = stateKeys.length > 0 ? { wantName, stateKeys } : { wantName };
    const next = [...subscriptions];
    if (editing < subscriptions.length) next[editing] = entry;
    else next.push(entry);
    onSubscriptionsChange(next);
    handleCancel();
  }, [name, keys, editing, subscriptions, onSubscriptionsChange, handleCancel]);

  const handleDelete = useCallback((i: number) => {
    onSubscriptionsChange(subscriptions.filter((_, j) => j !== i));
  }, [subscriptions, onSubscriptionsChange]);

  const suggestions = wantNames.filter(n => !subscriptions.some(s => s.wantName === n) || n === name);

  return (
    <CardGridShell
      scheme={CYAN_SCHEME}
      BgIcon={Radio}
      count={subscriptions.length}
      editingIndex={editing}
      navFocusedIndex={navFocused}
      navGridProps={navGridProps}
      addLabel="Add subscription"
      onAdd={() => open(subscriptions.length)}
      onClickItem={open}
      onDeleteItem={handleDelete}
      onSave={handleSave}
      onCancel={handleCancel}
      saveDisabled={!name.trim()}
      renderItemHeaderLeft={(i) => (
        <span className="text-[11px] font-semibold card-ink truncate leading-none">
          {subscriptions[i].wantName}
        </span>
      )}
      renderItemBody={(i) => (
        <div className="flex items-center gap-1 min-w-0">
          <ArrowRight className="w-2.5 h-2.5 text-cyan-400 dark:text-cyan-500 flex-shrink-0 opacity-40" />
          <span className="font-mono text-xs text-cyan-700 dark:text-cyan-300 truncate">
            {keysText(subscriptions[i].stateKeys)}
          </span>
        </div>
      )}
      renderFormHeader={(isNew) => (
        <>
          <Radio className="w-2.5 h-2.5 text-cyan-400" />
          <span className="text-[10px] text-cyan-500 dark:text-cyan-400 font-medium">
            {isNew ? 'New subscription' : 'Edit subscription'}
          </span>
        </>
      )}
      renderFormContent={() => (
        <>
          <input
            type="text"
            list={suggestions.length > 0 ? datalistId : undefined}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            }}
            placeholder="want name"
            className={inputCls}
            autoComplete="off"
            autoFocus
          />
          {suggestions.length > 0 && (
            <datalist id={datalistId}>
              {suggestions.map(n => <option key={n} value={n} />)}
            </datalist>
          )}
          <input
            type="text"
            value={keys}
            onChange={e => setKeys(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
              if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
            }}
            placeholder="fields (comma-separated, * for all)"
            className={inputCls}
            autoComplete="off"
          />
        </>
      )}
    />
  );
};
