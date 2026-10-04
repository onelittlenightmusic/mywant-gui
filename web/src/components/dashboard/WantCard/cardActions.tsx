import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { nativeHost, useHostCardActions } from '@/lib/nativeHost';
import { Slot } from '@/extensions/Slot';

/**
 * A want card's own actions — a web want's 開く — offered by the card's
 * content, shown as buttons on the card's top-right corner.
 *
 * This is the framework only: a plugin says what its actions are
 * (useCardActions), and whoever draws cards draws them. Framed by an app, the
 * app does, natively, on the card's frame beside its maximize (lib/nativeHost);
 * in a browser, an extension does, through the wantCardActions slot (the
 * canvas edition's round corner buttons). The public edition draws none.
 */
export interface CardAction {
  id: string;
  label: string;
  /** Lucide icon name — what the app and the extension draw it with. */
  icon: string;
  run: () => void;
}

/** Where a card's content hands its actions up to the card (see WantCard). */
const CardActionsContext = createContext<((actions: CardAction[] | null) => void) | null>(null);

/**
 * Offer the card's actions while `actions` is not null. `owner` keeps one
 * card's offer apart from another's in the app's list.
 *
 * Returns whether a card around this content takes them (or an app does).
 * False on a want's own page (/w/:id), where there is no card: the content
 * puts out CardActionsOutlet itself there.
 */
export function useCardActions(owner: string, actions: CardAction[] | null): boolean {
  useHostCardActions(owner, actions);
  const hand = useContext(CardActionsContext);
  const latest = useRef(actions);
  latest.current = actions;
  const shape = actions ? JSON.stringify(actions.map(a => [a.id, a.label, a.icon])) : '';
  useEffect(() => {
    if (nativeHost || !hand) return;
    hand(shape ? (latest.current ?? []).map(a => ({ ...a, run: () => latest.current?.find(x => x.id === a.id)?.run() })) : null);
    return () => hand(null);
  }, [hand, shape]);
  return nativeHost || !!hand;
}

/** The state a card keeps its content's actions in, and the provider handing them up. */
export function useCardActionSlot(): [CardAction[] | null, React.FC<{ children: React.ReactNode }>] {
  const [actions, setActions] = useState<CardAction[] | null>(null);
  const Provider = useRef<React.FC<{ children: React.ReactNode }>>(
    ({ children }) => <CardActionsContext.Provider value={setActions}>{children}</CardActionsContext.Provider>,
  ).current;
  return [actions, Provider];
}

/** Where the actions are shown in a browser: the wantCardActions slot. */
export const CardActionsOutlet: React.FC<{ actions: CardAction[] | null; ownPage?: boolean }> = ({ actions, ownPage = false }) => {
  if (nativeHost || !actions || actions.length === 0) return null;
  return <Slot name="wantCardActions" actions={actions} ownPage={ownPage} />;
};
