import React, { useMemo, useRef, useState } from 'react';
import { Check, Plus, X, GripVertical } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { classNames } from '@/utils/helpers';
import { writeWantState } from '@/api/wantState';
import { reorderIds } from '@/utils/thingOrder';
import { useReorderableGroup } from '@/components/reorderable/useReorderableGroup';
import { ReorderableGhost } from '@/components/reorderable/ReorderableGhost';
import { useCharacterStore, getDefaultCursorColor } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';

interface Item { id: string; text: string; done: boolean }

const uid = () => Math.random().toString(36).slice(2, 9);

/** Server stores [{id,text,done}]; a fresh want (or the deploy form) may hand
 *  plain strings instead. Read both, always hand the card whole items. */
function normalize(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => {
    if (typeof it === 'string') return { id: uid(), text: it, done: false };
    const o = (it ?? {}) as Record<string, unknown>;
    return { id: String(o.id ?? uid()), text: String(o.text ?? ''), done: !!o.done };
  });
}

const ROW = 'group relative flex items-center gap-2 rounded-lg p-2 shadow-sm bg-gray-50/80 dark:bg-gray-800/50';

/**
 * A checklist: a set of tasks to work through, each on its own card in the
 * same field-card idiom as a LogCard — a checkbox, its text, and (while the
 * card is being operated) a grip to drag it and an × to drop it. The whole
 * list lives in `state.current.items`; every edit rewrites the array through
 * writeWantState, so it shows at once and the outbox owes it to the server.
 */
const ChecklistContentSection: React.FC<WantCardPluginProps> = ({
  want, isFocused, isExpanded, isInnerFocused,
}) => {
  const id = want.metadata?.id;
  const items = useMemo(
    () => normalize((want.state?.current?.items as unknown) ?? (want.spec?.params?.items as unknown)),
    [want.state?.current?.items, want.spec?.params?.items],
  );
  const editing = isFocused || isExpanded || isInnerFocused;

  const isDark = useDarkMode();
  const getMyCharacter = useCharacterStore((s) => s.getMyCharacter);
  const myDefaultCursorColor = useCharacterStore((s) => s.myDefaultCursorColor);
  const cursorColor = getMyCharacter()?.color ?? myDefaultCursorColor ?? getDefaultCursorColor(isDark);

  // The row whose text is being typed — a local buffer so an arriving poll
  // does not type over an unfinished line. Everything else (tick, add, drop,
  // reorder) writes straight through.
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);

  const write = (next: Item[]) => { if (id) writeWantState(id, { items: next }); };

  const toggle = (itemId: string) =>
    write(items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)));
  const remove = (itemId: string) => {
    if (draft?.id === itemId) setDraft(null);
    write(items.filter((i) => i.id !== itemId));
  };
  const commitDraft = () => {
    if (!draft) return;
    write(items.map((i) => (i.id === draft.id ? { ...i, text: draft.text } : i)));
    setDraft(null);
  };
  const add = () => {
    const it: Item = { id: uid(), text: '', done: false };
    write([...items, it]);
    setDraft({ id: it.id, text: '' });
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const reorderGroup = useReorderableGroup<Item>({
    items,
    getId: (i) => i.id,
    containerRef: gridRef,
    selectedId: null,
    enabled: editing && !draft,
    onCommit: (dragId, previousId, nextId) => {
      const order = reorderIds(items.map((i) => i.id), dragId, previousId, nextId);
      const byId = new Map(items.map((i) => [i.id, i]));
      write(order.map((x) => byId.get(x)!).filter(Boolean));
    },
  });
  const ghostItem = reorderGroup.ghost ? items.find((i) => i.id === reorderGroup.ghost?.id) : undefined;

  const doneCount = items.filter((i) => i.done).length;

  const checkbox = (it: Item) => (
    <button
      data-inner-focus
      type="button"
      role="checkbox"
      aria-checked={it.done}
      onClick={(e) => { e.stopPropagation(); toggle(it.id); }}
      onMouseDown={(e) => e.stopPropagation()}
      className={classNames(
        'w-5 h-5 rounded-[6px] border flex items-center justify-center flex-shrink-0 transition-colors',
        it.done
          ? 'bg-emerald-500 border-emerald-500 text-white'
          : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400',
      )}
      title={it.done ? '未完了に戻す' : '完了にする'}
    >
      {it.done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
    </button>
  );

  // ── Compact: a glance at how far through it is, then the lines ──────────
  if (!editing) {
    return (
      <WantCardLayout content={
        <div
          className="h-full flex flex-col gap-1.5 p-2 overflow-hidden cursor-pointer"
          onClick={() => { /* selection/expansion handled by the card */ }}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
            <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
            {doneCount} / {items.length}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {items.length === 0 ? (
              <span className="text-xs italic text-gray-400">空のチェックリスト</span>
            ) : items.slice(0, 5).map((it) => (
              <div key={it.id} className="flex items-center gap-1.5 text-xs">
                <span className={classNames(
                  'w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center flex-shrink-0',
                  it.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600',
                )}>
                  {it.done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                </span>
                <span className={classNames('truncate', it.done && 'line-through text-gray-400')}>
                  {it.text || '(空の項目)'}
                </span>
              </div>
            ))}
            {items.length > 5 && (
              <span className="text-[10px] text-gray-400">＋{items.length - 5}件</span>
            )}
          </div>
        </div>
      } />
    );
  }

  // ── Operated: the full editor ─────────────────────────────────────────
  return (
    <WantCardLayout content={
      <div className="h-full flex flex-col min-h-0 p-2 gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
          <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
          {doneCount} / {items.length}
        </div>

        <div
          ref={gridRef}
          className="relative flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5"
          onDragOver={reorderGroup.containerProps.onDragOver}
          onDragLeave={reorderGroup.containerProps.onDragLeave}
        >
          {reorderGroup.indicator && (
            <div
              className="absolute left-0 right-0 h-0.5 rounded-full pointer-events-none z-40"
              style={{ top: reorderGroup.indicator.top, backgroundColor: `${reorderGroup.indicator.color}99` }}
            />
          )}

          {items.length === 0 && (
            <p className="text-xs italic text-gray-400 px-1 py-2">まだ項目がありません。下の「追加」から。</p>
          )}

          {items.map((it, i) => {
            const dragProps = editing && !draft ? reorderGroup.getItemProps(it, i) : null;
            const isDragSrc = !!dragProps?.isDragSource || reorderGroup.isKbDragSource(it.id);
            return (
              <div
                key={it.id}
                data-reorder-id={it.id}
                className={classNames(ROW, isDragSrc && 'opacity-40')}
                draggable={dragProps?.draggable ?? false}
                onDragStart={dragProps?.onDragStart}
                onDragOver={dragProps?.onDragOver}
                onDrop={dragProps?.onDrop}
                onDragEnd={dragProps?.onDragEnd}
              >
                {checkbox(it)}
                <input
                  data-inner-focus
                  value={draft?.id === it.id ? draft.text : it.text}
                  onChange={(e) => setDraft({ id: it.id, text: e.target.value })}
                  onFocus={() => setDraft({ id: it.id, text: it.text })}
                  onBlur={commitDraft}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); commitDraft(); (e.target as HTMLInputElement).blur(); }
                    if (e.key === 'Escape') { e.preventDefault(); setDraft(null); (e.target as HTMLInputElement).blur(); }
                  }}
                  placeholder="項目…"
                  className={classNames(
                    'flex-1 min-w-0 bg-transparent outline-none text-sm border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600',
                    it.done && 'line-through text-gray-400',
                  )}
                />
                <span
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing text-gray-400 flex-shrink-0"
                  title="ドラッグで入れ替え"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(it.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-rose-500 flex-shrink-0"
                  title="削除"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {ghostItem && (
            <ReorderableGhost
              state={reorderGroup.ghost}
              color={cursorColor}
              renderContent={() => (
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ghostItem.text || '(空の項目)'}</span>
              )}
            />
          )}
        </div>

        <button
          data-inner-focus
          type="button"
          onClick={(e) => { e.stopPropagation(); add(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1 flex-shrink-0 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> 追加
        </button>
      </div>
    } />
  );
};

registerWantCardPlugin({
  types: ['checklist'],
  ContentSection: ChecklistContentSection,
  hideFinalResult: true,
});
