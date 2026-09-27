import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useInputActions } from '@/hooks/useInputActions';
import { Play, Square, Trash2, X, FolderPlus, Check, Pin, PinOff, Eraser, Plus } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { overlayDesign } from '@/components/overlay';

interface ActionCellProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  colorClass: string;
  disabled?: boolean;
  delay?: number;
  focused?: boolean;
}

const ActionCell: React.FC<ActionCellProps> = ({ icon, label, onClick, colorClass, disabled = false, delay = 0, focused = false }) => (
  <button
    onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
    disabled={disabled}
    className={classNames(
      'flex flex-col items-center justify-center gap-0.5 h-full px-4 sm:px-6 transition-all duration-150 relative',
      disabled
        ? 'bg-gray-400/30 cursor-not-allowed grayscale opacity-50'
        : `hover:brightness-110 active:opacity-80 ${colorClass}`,
      focused && !disabled && 'ring-4 ring-inset ring-white/60'
    )}
    style={{
      animation: overlayDesign().cellEnterAnimation,
      animationDelay: `${delay}ms`,
    }}
  >
    <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-white dark:text-black">{icon}</div>
    <span className="text-white dark:text-black text-[9px] sm:text-[10px] font-bold leading-none uppercase tracking-tighter hidden sm:block">{label}</span>
  </button>
);

const Divider = () => <div className="w-px bg-white/15 dark:bg-black/15 self-stretch" />;

interface BatchActionBarProps {
  selectedCount: number;
  /** Start/Stop/Delete are optional so a page can show only the actions it
   *  supports (thing shows Constellation + Delete only; wants show all). */
  onBatchStart?: () => void;
  onBatchStop?: () => void;
  onBatchDelete?: () => void;
  /** Put the whole selection on the canvas, or take it all off. Two buttons and
   *  not one toggle: a mixed selection has no state to toggle away from, and
   *  "pin these" is what the user means either way. */
  onBatchPin?: () => void;
  onBatchUnpin?: () => void;
  /** Constellation the selection under a name typed into the inline input (create), or
   *  save the edited group when `editingConstellationName` is set. */
  onBatchConstellation?: (name: string) => void;
  /** When set, the bar is editing an existing group: the name input is
   *  pre-filled and always open, the primary button says "Save", and a
   *  "Delete group" button is shown (onDeleteConstellation). */
  editingConstellationName?: string;
  onDeleteConstellation?: () => void;
  /**
   * Untick everything, without leaving select mode.
   *
   * Distinct from Exit, which leaves. Having picked the wrong dozen tiles the
   * way out was to exit and come back, which also loses the mode you meant to
   * stay in; and unticking them one at a time is the thing a selection tool
   * exists to avoid.
   */
  onClearSelection?: () => void;
  /**
   * Start an Add Want from the ticked things — the multi-thing counterpart of
   * the Add Want on a single thing's card.
   *
   * Offered only when there are things in the selection, because things are
   * what a want takes as parameters; a selection of wants has nothing to seed
   * a form with.
   */
  onBatchAddWant?: () => void;
  /**
   * What is ticked, as something to look at.
   *
   * A number says how many and nothing about which, and a selection built by
   * clicking around a board is exactly the thing you lose track of — the count
   * going from 3 to 4 does not say what the fourth was. Small icons in the
   * order they were picked answer that at a glance and cost the bar no height.
   */
  selectedItems?: Array<{ id: string; icon?: React.ReactNode; label: string; color?: string }>;
  onExit: () => void;
  loading?: boolean;
  /** Index of keyboard-focused action button: 0=Start, 1=Stop, 2=Delete. undefined = no focus */
  focusedIdx?: number;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  onBatchStart,
  onBatchStop,
  onBatchDelete,
  onBatchPin,
  onBatchUnpin,
  onBatchConstellation,
  editingConstellationName,
  onDeleteConstellation,
  onClearSelection,
  onBatchAddWant,
  selectedItems,
  onExit,
  loading = false,
  focusedIdx,
}) => {
  const isEditing = editingConstellationName !== undefined;
  const hasSelection = selectedCount > 0;
  // In edit mode the name input is always open, pre-filled with the group name.
  const [groupingOpen, setGroupingOpen] = useState(isEditing);
  const [groupName, setGroupName] = useState(editingConstellationName ?? '');
  const groupInputRef = useRef<HTMLInputElement>(null);

  // Sync when switching into / between edited constellations.
  useEffect(() => {
    if (isEditing) { setGroupingOpen(true); setGroupName(editingConstellationName ?? ''); }
  }, [isEditing, editingConstellationName]);

  useEffect(() => {
    if (groupingOpen) setTimeout(() => groupInputRef.current?.focus(), 30);
  }, [groupingOpen]);

  const submitGroup = () => {
    const name = groupName.trim();
    if (!name || !onBatchConstellation) return;
    onBatchConstellation(name);
    if (!isEditing) { setGroupName(''); setGroupingOpen(false); }
  };

  /**
   * r=run, x=stop, d=delete, g=group, p=pin, u=unpin — only while something
   * is selected, and never while the group-name input has the keys.
   *
   * These used to be a bubble-phase window listener that settled arguments with
   * stopImmediatePropagation(). Two of them are arguments: `x` is also the
   * radar toggle and `g` is also the global panel, both bound by
   * useWorkspaceShortcuts, and which one answered a press came down to which
   * component mounted first. Now useWorkspaceShortcuts simply stops offering
   * those two in select mode, which is when this bar exists — the letters
   * change hands rather than being fought over.
   *
   * Start is `r` and not the `s` it reads like, because `s` is now what turns
   * select mode on and off. Borrowing it here would mean a press meaning "I am
   * done picking" started everything that had been picked, which is the one
   * misfire in this bar nobody would forgive.
   */
  const shortcuts = useMemo(() => {
    if (!hasSelection || loading) return undefined;
    const map: Record<string, () => void> = {};
    if (onBatchStart)         map.r = onBatchStart;
    if (onBatchStop)          map.x = onBatchStop;
    if (onBatchDelete)        map.d = onBatchDelete;
    if (onBatchConstellation) map.g = () => setGroupingOpen(true);
    if (onBatchPin)           map.p = onBatchPin;
    if (onBatchUnpin)         map.u = onBatchUnpin;
    // `e` for empty, not `c` for clear: `c` already switches to canvas mode
    // (useWorkspaceShortcuts), and this bar exists precisely while the board
    // is showing — two handlers for one press is the collision the note above
    // is about, not something to add another of.
    if (onClearSelection)     map.e = onClearSelection;
    // `n` for new: `a` is the canvas's own select-all, and `w` reads as a mode
    // letter rather than an action.
    if (onBatchAddWant)       map.n = onBatchAddWant;
    return map;
  }, [hasSelection, loading, onBatchStart, onBatchStop, onBatchDelete, onBatchConstellation, onBatchPin, onBatchUnpin, onClearSelection, onBatchAddWant]);

  // Deliberately NOT captureInput: that pushes a mode-wide exclusive claim, and
  // a bar that is mounted for as long as a selection exists would then own every
  // key in the app, arrows included. The channel alone is what was wanted here —
  // ownership routing and the text-field guard, without the claim.
  useInputActions({ enabled: !!shortcuts, shortcuts });

  return (
    <div className="h-full flex items-stretch">
      {/* Left: selection count + hint, and the button that empties it.
          Beside the count rather than over by Exit: it is about the number,
          it undoes the number, and putting it at the far end of the bar filed
          it with "leave" when it is the opposite — a way to stay and start
          again. */}
      <div className="flex items-center gap-1 pl-3 sm:pl-6 pr-1 sm:pr-2">
      <div className="flex flex-col items-start justify-center min-w-[52px] sm:min-w-[72px] gap-0.5">
        <span className="text-white dark:text-black text-sm font-semibold tabular-nums">
          {selectedCount}
          <span className="text-white/60 dark:text-black/60 text-xs ml-1 hidden sm:inline">selected</span>
        </span>
        {/* Which ones, in the order they were picked. Capped: past a handful the
            row would push the actions off a narrow bar, and the count already
            says how many there are. */}
        {selectedItems && selectedItems.length > 0 && (
          <div className="flex items-center gap-0.5 max-w-[7rem] sm:max-w-[13rem] overflow-hidden">
            {selectedItems.slice(0, 8).map(it => (
              <span
                key={it.id}
                title={it.label}
                className="flex items-center justify-center w-4 h-4 rounded-[3px] bg-white/20 dark:bg-black/20 flex-shrink-0"
                style={it.color ? { color: it.color } : undefined}
              >
                {it.icon}
              </span>
            ))}
            {selectedItems.length > 8 && (
              <span className="text-white/60 dark:text-black/60 text-[9px] leading-none flex-shrink-0">
                +{selectedItems.length - 8}
              </span>
            )}
          </div>
        )}
        {focusedIdx === undefined ? (
          <span className="text-white/50 dark:text-black/50 text-[9px] leading-none hidden sm:block">
            ⊕ action select
          </span>
        ) : (
          <span className="text-white/50 dark:text-black/50 text-[9px] leading-none hidden sm:block">
            ⊖ item select
          </span>
        )}
      </div>
        {onClearSelection && (
          <button
            onClick={onClearSelection}
            disabled={!hasSelection}
            title="Clear the selection (stay in select mode)"
            className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 dark:text-black/70 dark:hover:text-black dark:hover:bg-black/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Eraser className="w-4 h-4" />
            <span className="text-[9px] font-bold uppercase tracking-tighter hidden sm:block">Clear</span>
          </button>
        )}
      </div>

      {/* Center: action buttons (or the inline group-name input) */}
      <div className="flex flex-1 items-stretch justify-center">
        {groupingOpen ? (
          <div className="flex items-center gap-2 px-3 sm:px-6 w-full max-w-md mx-auto">
            <FolderPlus className="w-5 h-5 text-white dark:text-black flex-shrink-0" />
            <input
              ref={groupInputRef}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                // isComposing off the native event: without it the Enter that
                // confirms an IME conversion submits the half-typed name and
                // closes the field, the same bug ConstellationNamePrompt had.
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submitGroup(); }
                else if (e.key === 'Escape' && !isEditing) { e.preventDefault(); setGroupingOpen(false); setGroupName(''); }
              }}
              placeholder="Constellation name…"
              className="flex-1 min-w-0 bg-white/90 dark:bg-black/40 text-gray-900 dark:text-white text-sm rounded px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-white/70"
            />
            <button
              onClick={submitGroup}
              disabled={!groupName.trim()}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-white/90 dark:bg-black/50 text-gray-900 dark:text-white text-xs font-bold disabled:opacity-40"
            >
              <Check className="w-4 h-4" /> <span className="hidden sm:inline">{isEditing ? 'Save' : 'Create'}</span>
            </button>
            {isEditing && onDeleteConstellation && (
              <button
                onClick={onDeleteConstellation}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-rose-600/90 text-white text-xs font-bold hover:brightness-110"
                title="Delete this group"
              >
                <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete group</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-full">
            {onBatchAddWant && (
              <>
                <ActionCell
                  icon={<Plus className="w-5 h-5" />}
                  label="Add Want"
                  onClick={onBatchAddWant}
                  colorClass="bg-sky-600/90"
                  disabled={!hasSelection || loading}
                  delay={0}
                />
                <Divider />
              </>
            )}
            {onBatchConstellation && (
              <>
                <ActionCell
                  icon={<FolderPlus className="w-5 h-5" />}
                  label="Constellation"
                  onClick={() => setGroupingOpen(true)}
                  colorClass="bg-indigo-600/90"
                  disabled={!hasSelection || loading}
                  delay={0}
                />
                {(onBatchPin || onBatchUnpin || onBatchStart || onBatchStop || onBatchDelete) && <Divider />}
              </>
            )}
            {onBatchPin && (
              <>
                <ActionCell
                  icon={<Pin className="w-5 h-5" />}
                  label="Pin"
                  onClick={onBatchPin}
                  colorClass="bg-slate-600/90"
                  disabled={!hasSelection || loading}
                  delay={15}
                />
                <Divider />
              </>
            )}
            {onBatchUnpin && (
              <>
                <ActionCell
                  icon={<PinOff className="w-5 h-5" />}
                  label="Unpin"
                  onClick={onBatchUnpin}
                  colorClass="bg-amber-600/90"
                  disabled={!hasSelection || loading}
                  delay={30}
                />
                {(onBatchStart || onBatchStop || onBatchDelete) && <Divider />}
              </>
            )}
            {onBatchStart && (
              <>
                <ActionCell
                  icon={<Play className="w-5 h-5" fill="currentColor" />}
                  label="Start"
                  onClick={onBatchStart}
                  colorClass="bg-green-600/90"
                  disabled={!hasSelection || loading}
                  delay={0}
                  focused={focusedIdx === 0}
                />
                <Divider />
              </>
            )}
            {onBatchStop && (
              <>
                <ActionCell
                  icon={<Square className="w-5 h-5" fill="currentColor" />}
                  label="Stop"
                  onClick={onBatchStop}
                  colorClass="bg-red-600/90"
                  disabled={!hasSelection || loading}
                  delay={30}
                  focused={focusedIdx === 1}
                />
                {onBatchDelete && <Divider />}
              </>
            )}
            {onBatchDelete && (
              <ActionCell
                icon={<Trash2 className="w-5 h-5" />}
                label="Delete"
                onClick={onBatchDelete}
                colorClass="bg-rose-700/90"
                disabled={!hasSelection || loading}
                delay={60}
                focused={focusedIdx === 2}
              />
            )}
          </div>
        )}
      </div>

      {/* Right: exit. */}
      <div className="flex items-center px-3 sm:px-6 min-w-[72px] sm:min-w-[96px] justify-end">
        <button
          onClick={onExit}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 dark:text-black/70 dark:hover:text-black dark:hover:bg-black/10 transition-colors"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-tighter hidden sm:block">Exit</span>
        </button>
      </div>
    </div>
  );
};
