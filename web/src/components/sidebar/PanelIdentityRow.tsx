import React, { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelAtBottom } from '@/hooks/useDisplaySettings';
import { PanelCloseButton } from './PanelCloseButton';

/**
 * What this panel is about, and the way out of it.
 *
 * Both detail panels open with a card — the want's own tile, the thing's own
 * badge — and the frame used to repeat the name underneath in a bar of its own.
 * Taking that bar away (RightSidebar's `chromeless`) left each panel to say who
 * it was itself, and they promptly said it differently: one grew a line on its
 * card, the other kept the frame's header, and the two closes were a 44px
 * button in one and a 32px one in the other.
 *
 * So it is one component. A panel that opens on a card puts this above it and
 * gets the same name in the same place with the same way out, and there is no
 * second implementation to drift from the first.
 */
export const PanelIdentityRow: React.FC<{
  /** The name of the thing this panel is about. Empty for a panel that says it
   *  itself — a form's own first line is a better caption than a repeated one. */
  title: string;
  /** Dismiss the panel. Absent means the frame still draws its own close. */
  onClose?: () => void;
  /**
   * Controls that belong beside the way out — a form's submit.
   *
   * Here rather than in the frame's header bar because that bar is what a
   * panel gives up to be chromeless, and a form has to give it up for the same
   * reason a detail panel did: otherwise its close sits somewhere different
   * from every other panel's (at the BOTTOM of the sidebar, in this layout),
   * and the one row this file exists to enforce is enforced for all but two
   * screens.
   */
  actions?: React.ReactNode;
}> = ({ title, onClose, actions }) => (
  // 50px is what the close button (min-h-[44px]) plus this row's own padding
  // comes to. Without a floor, a panel that cannot be closed — the Web Want
  // detail follows the focused card and has no way out — drew a shorter row,
  // and its name sat 13px above every other panel's name. The row is the same
  // row whether or not there is a button in it.
  <div className="flex items-center gap-2 pb-1.5 min-h-[50px] min-w-0">
    <h2 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate min-w-0 flex-1">
      {title}
    </h2>
    {actions && <div className="flex items-stretch gap-0 flex-shrink-0">{actions}</div>}
    {onClose && <PanelCloseButton onClick={onClose} />}
  </div>
);

/**
 * A detail panel with the identity row above it, and nothing else between it
 * and the frame.
 *
 * The row above is the whole of a detail panel's chrome now (RightSidebar's
 * `chromeless`), and every page that opens one wants exactly the same thing:
 * the name, the way out, then the panel. Doing that here rather than inside
 * each of nine sidebars is what keeps the close in one place across all of
 * them — the drift this file exists to prevent was two panels, and there is no
 * reason to wait for nine.
 *
 * The panels that already carry their own row — the want's and the thing's,
 * where it is glued to a card that moves with the layout — are not wrapped.
 * They render the same component in the same geometry.
 */
/**
 * Where a panel's primary action is drawn, for whatever is inside it.
 *
 * A form's submit belongs on the same side as the header — the frame's own bar
 * already moves there (RightSidebar's order-last), and a board whose chrome
 * gathers at the bottom should not have one panel's Add button sitting at the
 * top of the screen on its own. The close is the exception and stays in the
 * identity row: a way out that moves is a way out you have to look for.
 *
 * A panel that owns its PanelShell passes `actions` and never touches this. A
 * panel that is CONTENT inside somebody else's shell — the thing form, which
 * the sidebar host wraps — cannot pass a prop up, and lifting its submit to
 * the host would take the form's own state with it. So the shell publishes the
 * slot and the content fills it from where it is (see PanelActions).
 */
const PanelActionsSlot = createContext<{ el: HTMLElement | null; placement: PanelActionsPlacement }>({
  el: null,
  placement: 'row',
});

/** Where the shell is drawing its actions: beside the close, or in a bar of
 *  their own along the bottom. The two have different room in them, and
 *  content that fills the slot needs to know which it is in. */
export type PanelActionsPlacement = 'row' | 'bar';

/**
 * The shape of a panel's primary action — the Add on both forms.
 *
 * Here rather than in either form, because the two are meant to be one button
 * and were written out twice; the second copy had already drifted into a
 * rounded pill before they were brought back together, and a shape kept in two
 * files is a shape that will drift again.
 *
 * The width is a floor, not a size. Labels differ — ADD, UPDATE, REMEMBER —
 * and a button that is only as wide as its own word makes the same action look
 * like a different one in each panel, and the shorter ones too small to aim
 * at. Everything past the floor is the word's own.
 */
export const PANEL_ACTION_BUTTON =
  'sidebar-focus-ring flex flex-col items-center justify-center gap-0.5 '
  + 'px-5 min-w-[7rem] h-full transition-all duration-150 flex-shrink-0';

export const usePanelActionsPlacement = (): PanelActionsPlacement =>
  useContext(PanelActionsSlot).placement;

/** Put these controls wherever this panel's shell draws its actions. Renders
 *  them in place when there is no shell, so a panel used bare still works. */
export const PanelActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { el } = useContext(PanelActionsSlot);
  return el ? createPortal(children, el) : <>{children}</>;
};

export const PanelShell: React.FC<{
  title: string;
  onClose?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, onClose, actions, children }) => {
  const isBottom = usePanelAtBottom();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <PanelActionsSlot.Provider value={{ el: slot, placement: isBottom ? 'bar' : 'row' }}>
      <div className="h-full flex flex-col">
        {/* px-3 pt-3, matching the block the want panel builds by hand, so the
            name and the close land on the same pixel whichever panel is open.
            That is the whole point of there being one row; putting it a few
            pixels lower here would have undone it. */}
        <div className="flex-shrink-0 px-3 pt-3">
          <PanelIdentityRow
            title={title}
            onClose={onClose}
            actions={
              <>
                {!isBottom && actions}
                {/* The slot, empty and zero-width until something fills it. */}
                {!isBottom && <div ref={setSlot} className="flex items-stretch" />}
              </>
            }
          />
        </div>
        {/* The shell owns the scrolling, so the row above it cannot be scrolled
            away — a way out that leaves the screen is not one. min-h-0 because
            a flex child's floor is its content: without it the body grows past
            the frame instead of scrolling, and takes the row off the top with
            it. Panels that scroll inside themselves (most of them do) simply
            never fill this, and the two never fight: only the inner one has
            anything to move. */}
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {isBottom && (
          <div
            // min-h matching the identity row's, so a button that fills its
            // bar (h-full, as the want form's submit is) is the same size
            // whichever side it landed on.
            className="flex-shrink-0 flex items-stretch gap-0 min-h-[50px] border-t border-gray-200 dark:border-gray-700"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* The slot first and greedy, so a panel that fills it spans the
                bar and a panel that does not still has its own actions pushed
                to the right — where they sit in the top row, and where the
                close they used to sit beside is. */}
            <div ref={setSlot} className="flex items-stretch flex-1 min-w-0" />
            {actions}
          </div>
        )}
      </div>
    </PanelActionsSlot.Provider>
  );
};
