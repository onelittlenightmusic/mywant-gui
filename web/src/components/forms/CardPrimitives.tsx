/**
 * Shared card UI primitives used by ParameterGridSection, LabelsSection,
 * DependenciesSection, ExposeSection, SchedulingSection.
 */
import React from 'react';
import { Plus, X, Check, LucideIcon } from 'lucide-react';
import { classNames } from '@/utils/helpers';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { cardInkVars } from '@/components/dashboard/WantCardFace';
import { CARD_HOVER_RING, hoverRingVars } from '@/components/dashboard/WantCard/hooks/cardStyles';

// ── Color scheme ──────────────────────────────────────────────────────────────

export interface CardScheme {
  cardBg: string;
  cardHover: string;
  bgIconColor: string;
  /** Hex color for circle-badge BgIcon rendering */
  color: string;
  iconColor: string;
  formBorder: string;
  formBg: string;
  saveColor: string;
  addBorder: string;
  addIcon: string;
}

export const BLUE_SCHEME: CardScheme = {
  cardBg:      'bg-blue-100/70 dark:bg-blue-900/25',
  cardHover:   'hover:shadow hover:bg-blue-100/90 dark:hover:bg-blue-900/40',
  bgIconColor: 'text-blue-400 dark:text-blue-300',
  color:       '#60a5fa',
  iconColor:   'text-blue-500 dark:text-blue-400',
  formBorder:  'border-blue-300 dark:border-blue-600',
  formBg:      'bg-blue-50/30 dark:bg-blue-900/10',
  saveColor:   'bg-blue-600/80 text-white hover:bg-blue-700/90',
  addBorder:   'border-blue-200 dark:border-blue-800/50 hover:border-blue-400 dark:hover:border-blue-600',
  addIcon:     'text-blue-300 dark:text-blue-700 group-hover:text-blue-500 dark:group-hover:text-blue-400',
};

export const GREEN_SCHEME: CardScheme = {
  cardBg:      'bg-green-100/70 dark:bg-green-900/25',
  cardHover:   'hover:shadow hover:bg-green-100/90 dark:hover:bg-green-900/40',
  bgIconColor: 'text-green-400 dark:text-green-300',
  color:       '#4ade80',
  iconColor:   'text-green-500 dark:text-green-400',
  formBorder:  'border-green-300 dark:border-green-600',
  formBg:      'bg-green-50/30 dark:bg-green-900/10',
  saveColor:   'bg-green-600/80 text-white hover:bg-green-700/90',
  addBorder:   'border-green-200 dark:border-green-800/50 hover:border-green-400 dark:hover:border-green-600',
  addIcon:     'text-green-300 dark:text-green-700 group-hover:text-green-500 dark:group-hover:text-green-400',
};

export const TEAL_SCHEME: CardScheme = {
  cardBg:      'bg-teal-100/70 dark:bg-teal-900/25',
  cardHover:   'hover:shadow hover:bg-teal-100/90 dark:hover:bg-teal-900/40',
  bgIconColor: 'text-teal-400 dark:text-teal-300',
  color:       '#2dd4bf',
  iconColor:   'text-teal-500 dark:text-teal-400',
  formBorder:  'border-teal-300 dark:border-teal-600',
  formBg:      'bg-teal-50/30 dark:bg-teal-900/10',
  saveColor:   'bg-teal-600/80 text-white hover:bg-teal-700/90',
  addBorder:   'border-teal-200 dark:border-teal-800/50 hover:border-teal-400 dark:hover:border-teal-600',
  addIcon:     'text-teal-300 dark:text-teal-700 group-hover:text-teal-500 dark:group-hover:text-teal-400',
};

export const PURPLE_SCHEME: CardScheme = {
  cardBg:      'bg-purple-100/70 dark:bg-purple-900/25',
  cardHover:   'hover:shadow hover:bg-purple-100/90 dark:hover:bg-purple-900/40',
  bgIconColor: 'text-purple-400 dark:text-purple-300',
  color:       '#c084fc',
  iconColor:   'text-purple-500 dark:text-purple-400',
  formBorder:  'border-purple-300 dark:border-purple-600',
  formBg:      'bg-purple-50/30 dark:bg-purple-900/10',
  saveColor:   'bg-purple-600/80 text-white hover:bg-purple-700/90',
  addBorder:   'border-purple-200 dark:border-purple-800/50 hover:border-purple-400 dark:hover:border-purple-600',
  addIcon:     'text-purple-300 dark:text-purple-700 group-hover:text-purple-500 dark:group-hover:text-purple-400',
};

export const AMBER_SCHEME: CardScheme = {
  cardBg:      'bg-amber-100/70 dark:bg-amber-900/25',
  cardHover:   'hover:shadow hover:bg-amber-100/90 dark:hover:bg-amber-900/40',
  bgIconColor: 'text-amber-400 dark:text-amber-300',
  color:       '#fbbf24',
  iconColor:   'text-amber-500 dark:text-amber-400',
  formBorder:  'border-amber-300 dark:border-amber-600',
  formBg:      'bg-amber-50/30 dark:bg-amber-900/10',
  saveColor:   'bg-amber-500/80 text-white hover:bg-amber-600/90',
  addBorder:   'border-amber-200 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600',
  addIcon:     'text-amber-300 dark:text-amber-700 group-hover:text-amber-500 dark:group-hover:text-amber-400',
};

export const CYAN_SCHEME: CardScheme = {
  cardBg:      'bg-cyan-50/70 dark:bg-cyan-900/15',
  cardHover:   'hover:shadow hover:bg-cyan-100/70 dark:hover:bg-cyan-900/25',
  bgIconColor: 'text-cyan-400 dark:text-cyan-600',
  color:       '#22d3ee',
  iconColor:   'text-cyan-500 dark:text-cyan-400',
  formBorder:  'border-cyan-300 dark:border-cyan-600',
  formBg:      'bg-cyan-50/30 dark:bg-cyan-900/10',
  saveColor:   'bg-cyan-600/80 text-white hover:bg-cyan-700/90',
  addBorder:   'border-cyan-200 dark:border-cyan-800/50 hover:border-cyan-400 dark:hover:border-cyan-600',
  addIcon:     'text-cyan-300 dark:text-cyan-700 group-hover:text-cyan-500 dark:group-hover:text-cyan-400',
};

export const INDIGO_SCHEME: CardScheme = {
  cardBg:      'bg-indigo-50/70 dark:bg-indigo-900/15',
  cardHover:   'hover:shadow hover:bg-indigo-100/70 dark:hover:bg-indigo-900/25',
  bgIconColor: 'text-indigo-400 dark:text-indigo-600',
  color:       '#818cf8',
  iconColor:   'text-indigo-500 dark:text-indigo-400',
  formBorder:  'border-indigo-300 dark:border-indigo-600',
  formBg:      'bg-indigo-50/30 dark:bg-indigo-900/10',
  saveColor:   'bg-indigo-600/80 text-white hover:bg-indigo-700/90',
  addBorder:   'border-indigo-200 dark:border-indigo-800/50 hover:border-indigo-400 dark:hover:border-indigo-600',
  addIcon:     'text-indigo-300 dark:text-indigo-700 group-hover:text-indigo-500 dark:group-hover:text-indigo-400',
};

export const ORANGE_SCHEME: CardScheme = {
  cardBg:      'bg-orange-50/70 dark:bg-orange-900/15',
  cardHover:   'hover:shadow hover:bg-orange-100/70 dark:hover:bg-orange-900/25',
  bgIconColor: 'text-orange-400 dark:text-orange-600',
  color:       '#fb923c',
  iconColor:   'text-orange-500 dark:text-orange-400',
  formBorder:  'border-orange-300 dark:border-orange-600',
  formBg:      'bg-orange-50/30 dark:bg-orange-900/10',
  saveColor:   'bg-orange-600/80 text-white hover:bg-orange-700/90',
  addBorder:   'border-orange-200 dark:border-orange-800/50 hover:border-orange-400 dark:hover:border-orange-600',
  addIcon:     'text-orange-300 dark:text-orange-700 group-hover:text-orange-500 dark:group-hover:text-orange-400',
};

// ── Confirm / Cancel icon buttons ────────────────────────────────────────

export const CardFormButtons: React.FC<{
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  saveColorClass?: string;
}> = ({ onSave, onCancel, saveDisabled, saveColorClass = BLUE_SCHEME.saveColor }) => (
  <div className="grid grid-cols-2 border-t border-gray-200/60 dark:border-gray-700/40">
    <button
      type="button"
      onClick={onCancel}
      title="Cancel"
      className="flex items-center justify-center gap-1 py-1.5 rounded-bl-xl bg-gray-600/70 dark:bg-gray-700/80 text-white hover:bg-gray-700/90 transition-colors"
    >
      <X className="w-3 h-3" />
      <span className="text-[9px] font-bold uppercase tracking-tight">Cancel</span>
    </button>
    <button
      type="button"
      onClick={onSave}
      disabled={saveDisabled}
      title="Save"
      className={classNames(
        'flex items-center justify-center gap-1 py-1.5 rounded-br-xl transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        saveColorClass,
      )}
    >
      <Check className="w-3 h-3" />
      <span className="text-[9px] font-bold uppercase tracking-tight">Save</span>
    </button>
  </div>
);

// ── Display Card ──────────────────────────────────────────────────────────────

interface DisplayCardProps {
  /** Full outer className — caller computes state-based classes (focused, modified, etc.) */
  className: string;
  BgIcon?: LucideIcon;
  bgIconColor?: string;
  /** Inline style for BgIcon — use to apply hex color from data type catalog */
  bgIconStyle?: React.CSSProperties;
  /** Set false to suppress the bg icon (e.g. when focused) */
  showBgIcon?: boolean;
  /** Renders a thin glow bar at the bottom */
  showFocusBar?: boolean;
  onClick?: () => void;
  /** Right-click on the card. Parameter cards use it to open their action
   *  overlay, the way the state field cards do. */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Left slot: type icon + name */
  headerLeft: React.ReactNode;
  /** Right slot: badges, toggles, copy/delete buttons */
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Action overlay covering the whole card (header included) — rendered as a
   * direct child of the root so `absolute inset-0` spans the full card rather
   * than just the children area. Used for Shift+Enter action grids.
   */
  overlay?: React.ReactNode;
  /** Extra data-* attributes forwarded to the root div (e.g. data-robot-target) */
  dataAttrs?: Record<string, string>;
  /** The card's base colour (hex). Sets --card-ink so `.card-ink` labels inside
   *  take the card's own colour instead of a flat grey. */
  inkColor?: string;
  /** A picture of what the card stands for (a parameter's backgroundImage),
   *  drawn under its header, whole and never enlarged past itself. */
  backgroundImage?: string;
}

export const DisplayCard: React.FC<DisplayCardProps> = ({
  className,
  BgIcon,
  bgIconColor = '',
  bgIconStyle,
  showBgIcon = true,
  showFocusBar,
  onClick,
  onContextMenu,
  headerLeft,
  headerRight,
  children,
  overlay,
  dataAttrs,
  inkColor,
  backgroundImage,
}) => {
  // Parameter / field cards get the same hover frame the want and entity cards
  // carry, so pointing at any card in the app reads the same way.
  const hoverRingColor = useMyCursorColor();
  const isDark = useDarkMode();
  return (
  <div
    onClick={onClick}
    onContextMenu={onContextMenu}
    className={classNames('flex flex-col', CARD_HOVER_RING, className)}
    style={{ ...hoverRingVars(hoverRingColor, isDark), ...cardInkVars(inkColor, isDark) }}
    data-free-cursor-item
    {...dataAttrs}
  >
    {BgIcon && showBgIcon && (
      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
        {/* One presentation only: the card's background glyph. A value with a
            data subtype swaps the glyph for the subtype's icon and repaints it
            in the subtype's colour — it is never boxed into a badge. */}
        <BgIcon
          className={classNames('absolute bottom-1 left-1.5 w-7 h-7 sm:w-10 sm:h-10 opacity-[0.22] dark:opacity-[0.18]', bgIconColor)}
          style={bgIconStyle}
        />
      </div>
    )}
    {/* Only a path, a web URL or an image data: URL — the value goes into a
        CSS url(), and nothing else belongs there. */}
    {backgroundImage && /^(\/|https?:\/\/|data:image\/)/.test(backgroundImage) && (
      <div
        className="absolute left-1.5 right-1.5 top-5 bottom-1 bg-contain bg-no-repeat bg-center pointer-events-none"
        style={{ backgroundImage: `url(${JSON.stringify(backgroundImage)})` }}
      />
    )}
    <div className={classNames('flex items-center justify-between mb-1 shrink-0', backgroundImage && 'relative')}>
      <div className="flex items-center gap-1 min-w-0 flex-1">{headerLeft}</div>
      {headerRight && (
        <div className="flex items-center gap-0.5 ml-1 shrink-0">{headerRight}</div>
      )}
    </div>
    {children && <div className={classNames('flex-1 min-h-0', backgroundImage && 'relative')}>{children}</div>}
    {showFocusBar && (
      <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-blue-400 dark:bg-blue-500" />
    )}
    {overlay}
  </div>
  );
};

// ── Add Card (dashed placeholder button) ─────────────────────────────────────

export const AddCard: React.FC<{
  borderClass: string;
  iconClass: string;
  label: string;
  onClick: () => void;
  isFocused?: boolean;
}> = ({ borderClass, iconClass, label, onClick, isFocused }) => (
  <button
    type="button"
    onClick={onClick}
    data-free-cursor-item
    className={classNames(
      'flex flex-col items-center justify-center gap-0.5 sm:gap-1 rounded-lg sm:rounded-xl border-2 border-dashed',
      'transition-colors group min-h-[3rem] sm:min-h-[5rem] bg-transparent',
      borderClass,
      isFocused ? 'mw-card-focus bg-white/60 dark:bg-gray-800/60' : '',
    )}
  >
    <Plus className={classNames('w-4 h-4 transition-colors', iconClass)} />
    <span className={classNames('text-[9px] transition-colors', iconClass)}>{label}</span>
  </button>
);

// ── Form Card (dashed, inline add / edit form) ────────────────────────────────

export const FormCard: React.FC<{
  borderClass: string;
  bgClass: string;
  header: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  saveColorClass?: string;
  colSpan2?: boolean;
  children: React.ReactNode;
  BgIcon?: LucideIcon;
  bgIconColor?: string;
  bgIconStyle?: React.CSSProperties;
}> = ({ borderClass, bgClass, header, onSave, onCancel, saveDisabled, saveColorClass, colSpan2, children, BgIcon, bgIconColor = '', bgIconStyle }) => (
  <div className={classNames('relative rounded-lg sm:rounded-xl border-2 border-dashed overflow-hidden', borderClass, bgClass, colSpan2 ? 'col-span-2' : '')}>
    {BgIcon && (
      <div className="absolute inset-0 pointer-events-none">
        <BgIcon
          className={classNames('absolute bottom-1 right-1.5 w-7 h-7 sm:w-10 sm:h-10 opacity-[0.22] dark:opacity-[0.18]', bgIconColor)}
          style={bgIconStyle}
        />
      </div>
    )}
    <div className="p-1.5 sm:p-2.5">
      <div className="flex items-center gap-1 mb-1 sm:mb-1.5">{header}</div>
      {children}
    </div>
    <CardFormButtons
      onSave={onSave}
      onCancel={onCancel}
      saveDisabled={saveDisabled}
      saveColorClass={saveColorClass}
    />
  </div>
);

// ── Card Grid Shell ───────────────────────────────────────────────────────────
// Shared outer shell for label / dep / expose / schedule card grids.
// Handles: 2-col grid, display cards with hover-delete, add card, inline form card.

export interface CardGridShellProps {
  scheme: CardScheme;
  BgIcon: LucideIcon;
  /** Total number of existing items */
  count: number;
  /**
   * Which item is being edited.
   * - null  → not editing
   * - 0..count-1 → editing existing item at that index
   * - count → adding a new item
   */
  editingIndex: number | null;
  addLabel: string;
  onAdd: () => void;
  /** Called when the user clicks an existing item card (optional — if absent, cards are not clickable) */
  onClickItem?: (i: number) => void;
  onDeleteItem: (i: number) => void;
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
  /** Keyboard/gamepad nav: index of the currently focused card (-1 = none) */
  navFocusedIndex?: number;
  /** Keyboard/gamepad nav: props to spread onto the grid div */
  navGridProps?: { ref: React.RefObject<HTMLDivElement>; tabIndex: number; onKeyDown: (e: React.KeyboardEvent) => void };
  /** Header left content for each display card (icon + name) */
  renderItemHeaderLeft: (i: number) => React.ReactNode;
  /** Body content for each display card */
  renderItemBody?: (i: number) => React.ReactNode;
  /** Icon + title text inside the FormCard header */
  renderFormHeader: (isNew: boolean) => React.ReactNode;
  /** The actual form inputs */
  renderFormContent: () => React.ReactNode;
  /** Optional extra element shown when list is empty and not editing */
  emptyState?: React.ReactNode;
  /** Footer note below the grid */
  footerNote?: string;
  /** When true, all items without a getItemBgIcon override render BgIcon as a circle badge using scheme.color */
  /** Per-item background icon override — returns { BgIcon, bgIconStyle } or null to use scheme default */
  getItemBgIcon?: (i: number) => { BgIcon: LucideIcon; bgIconStyle?: React.CSSProperties } | null;
  /** Per-item colour scheme — return null to keep the section's own `scheme`.
   *  Expose/import cards use it so each card is tinted by the type of the field
   *  it points at, the way the parameter and state field cards are. */
  getItemScheme?: (i: number) => CardScheme | null;
}

export const CardGridShell: React.FC<CardGridShellProps> = ({
  scheme,
  BgIcon,
  count,
  editingIndex,
  addLabel,
  onAdd,
  onClickItem,
  onDeleteItem,
  onSave,
  onCancel,
  saveDisabled,
  renderItemHeaderLeft,
  renderItemBody,
  renderFormHeader,
  renderFormContent,
  emptyState,
  footerNote,
  getItemBgIcon,
  getItemScheme,
  navFocusedIndex,
  navGridProps,
}) => {
  const isAdding = editingIndex === count;

  return (
    <div className="space-y-2 sm:space-y-3">
      {emptyState && count === 0 && editingIndex === null && emptyState}

      <div className="grid grid-cols-3 sm:grid-cols-2 gap-1 sm:gap-2 outline-none" {...(navGridProps ?? {})}>
        {Array.from({ length: count }, (_, i) => {
          if (editingIndex === i) {
            return (
              <FormCard
                key={i}
                borderClass={scheme.formBorder}
                bgClass={scheme.formBg}
                saveColorClass={scheme.saveColor}
                header={renderFormHeader(false)}
                onSave={onSave}
                onCancel={onCancel}
                saveDisabled={saveDisabled}
              >
                {renderFormContent()}
              </FormCard>
            );
          }
          const bgOverride = getItemBgIcon?.(i) ?? null;
          const itemScheme = getItemScheme?.(i) ?? scheme;
          const isFocused = navFocusedIndex === i;
          return (
            <DisplayCard
              key={i}
              className={classNames(
                'relative rounded-lg sm:rounded-xl p-1.5 h-14 shadow-sm transition-all duration-150 group',
                itemScheme.cardBg, itemScheme.cardHover,
                onClickItem ? 'cursor-pointer' : '',
                isFocused ? 'mw-card-focus bg-white dark:bg-gray-800' : '',
              )}
              showFocusBar={isFocused}
              BgIcon={bgOverride?.BgIcon ?? BgIcon}
              bgIconColor={bgOverride ? '' : itemScheme.bgIconColor}
              bgIconStyle={bgOverride?.bgIconStyle}
              inkColor={itemScheme.color}
              onClick={onClickItem ? () => onClickItem(i) : undefined}
              headerLeft={renderItemHeaderLeft(i)}
              headerRight={
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDeleteItem(i); }}
                  className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-all"
                  title="Delete"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              }
            >
              {renderItemBody && (
                <div className="h-full flex items-end justify-end overflow-hidden">
                  {renderItemBody(i)}
                </div>
              )}
            </DisplayCard>
          );
        })}

        {isAdding ? (
          <FormCard
            borderClass={scheme.formBorder}
            bgClass={scheme.formBg}
            saveColorClass={scheme.saveColor}
            header={renderFormHeader(true)}
            onSave={onSave}
            onCancel={onCancel}
            saveDisabled={saveDisabled}
          >
            {renderFormContent()}
          </FormCard>
        ) : (
          <AddCard
            borderClass={scheme.addBorder}
            iconClass={scheme.addIcon}
            label={addLabel}
            onClick={onAdd}
            isFocused={navFocusedIndex === count}
          />
        )}
      </div>

      {footerNote && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">{footerNote}</p>
      )}
    </div>
  );
};
