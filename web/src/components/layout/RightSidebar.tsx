import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useHeaderAtBottom } from '@/hooks/useDisplaySettings';
import { nativeHost, HOST_PANEL_BAR, HostFramedPanel, useHostPanelStore, iconName } from '@/lib/nativeHost';
import { useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { PanelCloseButton } from '@/components/sidebar/PanelCloseButton';
import type { AnyIconComponent } from '@/components/dashboard/WantTypeVisuals';
import { classNames } from '@/utils/helpers';
import { useConfigStore } from '@/stores/configStore';
import { useAppBackgroundStyle } from '@/hooks/useAppBackgroundStyle';
import { useSheetSwipeDismiss } from '@/hooks/useSheetSwipeDismiss';
import { MENU_COLORS } from '@/utils/menuColors';
import { useSidebarFocusStore } from '@/stores/sidebarFocusStore';
import { useCardInnerFocusStore } from '@/stores/cardInnerFocusStore';
import { useInputHandedOver, handBackToGrid, handOverToSidebar, handOverToSidebarWhenReady } from '@/stores/focusOwner';
import { giveStickToBoard, giveStickToPanel } from '@/stores/stickOwner';
import { useInputActions, isInputCaptured } from '@/hooks/useInputActions';
import { useCharacterStore } from '@/stores/characterStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { characterFrameColor } from '@/design/characterColor';
import { setCanvasActor, runCanvasAction, CANVAS_ACTIONS } from '@/stores/canvasActorStack';

/** Menu accent colour per route, so a page's detail sidebar is tinted to match
 *  its hamburger-menu section. */
const ROUTE_MENU_COLOR: Record<string, string> = {
  '/dashboard': MENU_COLORS.wants,
  '/thing': MENU_COLORS.thing,
  '/want-types': MENU_COLORS.wantTypes,
  '/worlds': MENU_COLORS.worlds,
  '/agents': MENU_COLORS.agents,
  '/web-wants': MENU_COLORS.webWants,
  '/recipes': MENU_COLORS.recipes,
  '/achievements': MENU_COLORS.achievements,
  '/devices': MENU_COLORS.devices,
  '/extension': MENU_COLORS.extension,
  '/characters': MENU_COLORS.characters,
};

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  titleIcon?: LucideIcon | AnyIconComponent;
  titleIconClassName?: string;
  /** Inline style for the title icon — pass wantTypeIconStyle() to tint it with
   *  the want type's own colour. */
  titleIconStyle?: React.CSSProperties;
  children: React.ReactNode;
  className?: string;
  backgroundStyle?: React.CSSProperties;
  headerActions?: React.ReactNode;
  /** Draw no header row — see AppSidebarDescriptor.chromeless. */
  chromeless?: boolean;
  overflowHidden?: boolean;
  disableBackdropClick?: boolean;
  /** When true and on mobile, force the sheet to appear at the bottom regardless of header position. */
  mobileForceBottom?: boolean;
  /**
   * This panel takes the left stick as soon as it opens.
   *
   * For panels the user went and opened — a form, a picker — where being in
   * there is the whole point of the press that opened it. Off by default,
   * because the detail panel opens by itself as the character walks around and
   * must not take the stick with it. See stores/stickOwner.
   */
  claimsInputOnOpen?: boolean;
}

/**
 * The wide-screen panel's own travel and time — the pace every variant of this
 * panel is measured against. 480px is its width (`sm:w-[480px]` below) and
 * 280ms is --motion-base, the token it transitions with.
 */
const PANEL_TRAVEL_PX = 480;
const PANEL_MS = 280;
/** How long a closed panel keeps its contents — past the slowest close. */
const CLOSED_CONTENTS_GRACE_MS = 600;

export const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  onClose,
  title,
  titleIcon: TitleIcon,
  titleIconClassName,
  titleIconStyle,
  children,
  className,
  backgroundStyle,
  headerActions,
  chromeless = false,
  overflowHidden = false,
  disableBackdropClick = false,
  mobileForceBottom = false,
  claimsInputOnOpen = false,
}) => {
  const config = useConfigStore(state => state.config);
  const isBottom = useHeaderAtBottom();
  // When the caller doesn't supply its own background (the list pages —
  // agents / want-types / recipe), fall back to the app background so every
  // detail sidebar is the same frosted, semi-transparent surface as the want
  // dashboard's, instead of a flat opaque panel.
  const appBg = useAppBackgroundStyle();
  const effectiveBg = backgroundStyle ?? appBg;
  void effectiveBg; // kept for API compatibility; the panel is now solid-coloured
  const location = useLocation();
  const menuColor = ROUTE_MENU_COLOR[location.pathname];
  const [isAnyDragging, setIsAnyDragging] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(() => window.innerWidth < 640);
  const containerRef = useRef<HTMLDivElement>(null);

  // The contents are drawn only while the panel is open, and for as long as
  // it takes to slide away after — not the whole time it is shut.
  //
  // A closed panel used to go on rendering everything in it, off screen: the
  // Add Want form's full type picker (a card face and an icon per type), the
  // detail panel's card and tabs. Every render of the page redrew them, and on
  // a phone, where the sheet stays shut while the character walks, that was
  // most of the cost of stepping onto a want. What a form remembers lives in
  // the form's own component, above this one, so none of it is lost.
  const [contentsMounted, setContentsMounted] = useState(isOpen);
  useEffect(() => {
    if (isOpen) { setContentsMounted(true); return; }
    const t = window.setTimeout(() => setContentsMounted(false), CLOSED_CONTENTS_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  // Input has been handed to the sidebar — draw the frame that says so, in the
  // character's own colour, the one their CursorMan and its hover ring already
  // use. Without it the handover is invisible: the arrow keys simply stop
  // moving the board, with nothing on screen saying where they went instead.
  const sidebarFocused = useSidebarFocusStore(s => s.focused);
  /** A card in here has the keys — its slider, its message box (see cardInnerFocusStore). */
  const cardBeingOperated = useCardInnerFocusStore(s => s.activeWantId !== null);
  const inputHandedOver = useInputHandedOver();
  const focusRequest = useSidebarFocusStore(s => s.request);
  const myCharacter = useCharacterStore(s => s.getMyCharacter());
  const focusColor = myCharacter?.color ?? '#38bdf8';
  const isDark = useDarkMode();
  const frameColor = characterFrameColor(focusColor, isDark);

  // Closing the sidebar hands input back — the frame must not outlive the panel
  // it was drawn around, and the canvas has to start offering "open details"
  // again.

  /**
   * Hand input back, and actually let go of it.
   *
   * Clearing the flag is not enough: the guards that redirect input here key
   * off DOM focus (_isInSidebar reads the event target), so leaving focus
   * inside the panel would keep the board deaf while the frame said it was
   * listening again.
   */
  const releaseSidebarFocus = React.useCallback(() => {
    // The whole way out: the flag (and with it the stick), the roaming cursor
    // back onto the card, and the sound that says it happened. This is the only
    // caller that is a deliberate press, which is why the last two live in
    // handBackToGrid rather than in the store's plain exit.
    handBackToGrid();
    const el = containerRef.current;
    if (el && el.contains(document.activeElement)) {
      (document.activeElement as HTMLElement)?.blur();
    }
    // Whether it also closes depends on what kind of panel this is, and the
    // question is the same one claimsInputOnOpen already answers.
    //
    // A panel the user went and opened — a form — is one B cancels out of
    // outright; there is no state behind it worth going back to. A panel that
    // is simply showing the selected card is different: the state behind it is
    // the grid with that card still selected, which is exactly where B is
    // meant to land. Closing it would throw away the selection as well as the
    // focus, and the user would have to find the card again to look at it.
    //
    // It also used to have to close, because the board refused input while any
    // panel was on screen — so an open-but-unfocused panel was a dead state
    // where nothing answered. Ownership is handed over now rather than derived
    // from what is on screen (see stores/stickOwner), and that dead state no
    // longer exists.
    if (claimsInputOnOpen) onClose();
  }, [onClose, claimsInputOnOpen]);

  /**
   * The way out. This has to live here, and it has to opt out of the sidebar
   * guard, because everything else that handles Escape/B opts *in* to it:
   * once focus is inside an open sidebar, _isInSidebar() makes every
   * default-guarded handler skip the press — including the page's own Escape.
   * On a thing there is no selected want, so the page's Escape handler is not
   * even enabled. Between them that left no key that did anything: the frame
   * was on screen and the app was inert.
   *
   * Not captureInput: an overlay opened inside the sidebar owns the exclusive
   * slot and stops propagation before this, so Escape still closes the overlay
   * first, which is the right order.
   *
   * ignoreWhenInputFocused stays on (the default) — Escape in a text field
   * belongs to the field.
   */
  useInputActions({
    // Not while a card inside this panel is being operated. The innermost thing
    // on screen answers first (see focusOwner's own ordering), and a card's
    // inner focus is one rung deeper than the panel: B there means "leave the
    // card's controls", and the card binds exactly that. This instance is not
    // the capture owner, so without standing down BOTH handlers ran for the one
    // press — the card let go of its controls and the panel handed the keys out
    // to the board in the same beat, which is how B inside the embedded card
    // ended up on the canvas.
    enabled: isOpen && sidebarFocused && !cardBeingOperated,
    ignoreWhenInSidebar: false,
    onCancel: () => {
      // Not when something inside the panel owns the keys. This instance opts
      // out of the sidebar guard on purpose — it is the panel's own way out and
      // would never hear Escape otherwise — and that opt-out is exactly what
      // made it answer presses meant for a card grid's editor: leaving an enum
      // or a slider stepped back out of the editor AND handed the keys to the
      // board, two rungs in one press.
      //
      // Asked at press time rather than through `enabled`: the slot is a module
      // fact, not React state, and this is the moment the question matters.
      if (isInputCaptured()) return;
      releaseSidebarFocus();
    },
    onConfirm: () => {
      // Enter/A when nothing INSIDE the panel has claimed focus: the press has
      // no target here, so it reverses the press that opened this instead of
      // being swallowed.
      //
      // "Nothing inside" has to include focus being nowhere at all
      // (activeElement === <body>), not just the container itself. That is the
      // common case — a blur, or a panel that was never focused — and testing
      // only for the container is why Enter did nothing precisely when the app
      // was stuck.
      const ae = document.activeElement as HTMLElement | null;
      const el = containerRef.current;
      const claimedInside = !!ae && !!el && el.contains(ae) && ae !== el;
      if (!claimedInside) releaseSidebarFocus();
    },
    /**
     * Shift+Enter / gamepad Start on the panel's embedded card — its action
     * overlay, the same one a right-click or a long-press opens.
     *
     * Reached by dispatching a real contextmenu event at the card rather than
     * by reaching into whichever store holds that card's overlay. The two kinds
     * of embedded card keep their overlay state in different places (want cards
     * in wantStore, everything else in cardOverlayStore) and each already binds
     * onContextMenu for the mouse — so asking the card, instead of telling it,
     * works for both and for whatever kind comes next. It is the same trick the
     * roaming cursor uses to land on things (see clickTarget).
     *
     * Only fires when nothing deeper has claimed the press: a field card inside
     * the panel binds Shift+Enter for its own overlay with captureInput, which
     * takes the exclusive slot ahead of this. So this is the embedded card's
     * because it is what is left.
     */
    // Dispatched rather than done here — see showPanelActions and the actor it
    // is registered as. The press means the same thing whoever heard it, and
    // the ranking that decides who answers belongs in one table.
    onContextMenu: () => { runCanvasAction(CANVAS_ACTIONS.CONTEXT_MENU); },
  });

  /**
   * The panel's answer to Shift+Enter / Start: its embedded card's own action
   * overlay, the same one a right-click or a long-press opens.
   *
   * Registered as an actor rather than bound to the key here, and while the
   * panel is merely OPEN rather than only while it holds the keys. That is the
   * whole fix: an open panel is what the question is about either way, and the
   * board's own reading of the press (useSelectionInput) now runs only when
   * this one says it has nothing — 'mode' outranks the tile underfoot for the
   * same reason a held ring does (see CANVAS_ACTOR_KIND_ORDER).
   *
   * Not while a card inside is being operated: that card owns the keys, and its
   * own grid answers Start with captureInput ahead of everything.
   *
   * Reached by dispatching a real contextmenu event at the card rather than by
   * reaching into whichever store holds that card's overlay. The two kinds of
   * embedded card keep their overlay state in different places (want cards in
   * wantStore, everything else in cardOverlayStore) and each already binds
   * onContextMenu for the mouse — so asking the card, instead of telling it,
   * works for both and for whatever kind comes next. It is the same trick the
   * roaming cursor uses to land on things (see clickTarget).
   *
   * No sound here: the overlay sounds itself from whichever store it lands in
   * (see stores/cardOverlaySounds), so this press sounds the same as the same
   * press on the same card out in the grid.
   */
  const showPanelActions = React.useCallback((): boolean => {
    const el = containerRef.current;
    // First card in the panel, in source order — the embedded one sits at the
    // top, above whatever grids follow it.
    const card = el?.querySelector<HTMLElement>('[data-keyboard-nav-id], [data-want-id]');
    if (!card) return false;
    card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, []);

  useEffect(() => {
    setCanvasActor('detailPanelActions', isOpen && !cardBeingOperated
      ? { kind: 'mode', actions: { [CANVAS_ACTIONS.CONTEXT_MENU]: () => showPanelActions() } }
      : null);
    return () => setCanvasActor('detailPanelActions', null);
  }, [isOpen, cardBeingOperated, showPanelActions]);

  // Someone asked for focus (the canvas's "open details", a tab switch). Give
  // it to the panel itself, but only if nothing inside claimed it first — the
  // want sidebar moves focus to a parameter card on the same request, and that
  // is the better landing spot. rAF so this runs after that has had its turn.
  //
  // Only a request made WHILE this panel is mounted counts — hence the ref
  // seeded with whatever the counter already stands at. `request` is global and
  // only ever climbs, and this effect also re-runs when `isOpen` flips, so
  // without the seed every reopen re-served a request from minutes ago: the
  // panel silently took focus with the flag false, which left no ring to
  // explain it and swallowed the arrow keys (their handler skips any event
  // whose target sits inside an open sidebar). That is the freeze.
  const handledRequestRef = useRef(focusRequest);
  // When focus was last deliberately asked for, so the self-heal below does not
  // race the rAF that is about to grant it.
  const lastFocusAskRef = useRef(0);
  useEffect(() => {
    if (!isOpen || focusRequest === handledRequestRef.current) return;
    handledRequestRef.current = focusRequest;
    lastFocusAskRef.current = Date.now();
    const id = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el && !el.contains(document.activeElement)) el.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focusRequest, isOpen]);

  // Handed input without being pointed at anything in particular (the canvas's
  // "open details"). Focus the panel itself: the frame has to correspond to
  // real DOM focus or the guards that redirect input here never engage, and
  // parking on the panel — rather than on whichever card grid happens to be
  // live — is what makes Enter behave the same way every time.
  useEffect(() => {
    if (!isOpen || !sidebarFocused) return;
    lastFocusAskRef.current = Date.now();
    const id = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el && !el.contains(document.activeElement)) el.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [sidebarFocused, isOpen]);

  // Focus trap: prevent Tab from leaving the sidebar
  useEffect(() => {
    if (!isOpen) return;
    const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])';
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      // If a component-level handler already called preventDefault and moved focus, don't interfere
      if (e.defaultPrevented) return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden');
      if (focusable.length === 0) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!container.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

  /**
   * How far the phone's sheet has to travel, so it can be given the TIME that
   * matches — see sheetMs, which divides it by the wide panel's own speed.
   *
   * Measured from the panel itself once it is laid out, because the two sheet
   * variants are very different heights (nearly the whole screen coming up from
   * the bottom, 40vh coming down from the top) and a phone's viewport moves
   * under you as the browser's own chrome slides in and out. Falls back to the
   * viewport height, which is what the bottom sheet is nearly all of.
   */
  const [sheetTravel, setSheetTravel] = useState(() => window.innerHeight);
  useLayoutEffect(() => {
    const h = containerRef.current?.offsetHeight;
    if (h) setSheetTravel(h);
  }, [isMobileSheet, isOpen, mobileForceBottom, isBottom]);

  useEffect(() => {
    const handler = () => {
      setIsMobileSheet(window.innerWidth < 640);
      setSheetTravel(window.innerHeight);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Synchronously mirror isOpen into a DOM attribute so that input guards
  // (_isInSidebar, WantInventoryPicker focus) can read the *intended* open
  // state rather than relying on CSS animation progress.
  // useLayoutEffect runs before the next RAF, so the attribute is correct
  // before any gamepad poll fires.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (isOpen) {
      container.setAttribute('data-sidebar-open', 'true');
      // A panel you asked for — a form, a picker — is one you meant to be in,
      // so it arrives holding the input. The detail panel does not set this:
      // it opens by itself when the character walks onto a want, and taking
      // the input on an arrival is the thing that used to strand the user
      // mid-walk (see stores/stickOwner).
      //
      // Through the state machine, not by poking one half of it. This used to
      // call giveStickToPanel() directly, which hands over the stick and
      // nothing else — so the machine's own owner stayed 'board', and the
      // panel's way OUT (the onCancel below, enabled only while the panel
      // holds focus) was never armed. A form you had opened could not be
      // closed with B: the press had no handler, because as far as the machine
      // was concerned you had never gone in. See stores/focusOwner, which is
      // where entering and leaving are defined for every surface — the board,
      // this panel, the minimap — precisely so that no surface has to
      // reimplement half of it.
      //
      // Tried synchronously first: the attribute this move looks for is set on
      // the line above, so it almost always lands at once, and the retrying
      // form is for the case that has to wait a frame (a phone's sheet
      // animating in).
      if (claimsInputOnOpen && !handOverToSidebar()) handOverToSidebarWhenReady();
    } else {
      container.removeAttribute('data-sidebar-open');
      // Gone means gone: whatever it was holding goes back to the board —
      // unless another panel is still up, in which case this is one of the two
      // instances that are always mounted (one open, one closed) reporting on
      // itself, and speaking for the other one would take the stick out of a
      // panel that is still on screen.
      if (!document.querySelector('[data-sidebar="true"][data-sidebar-open="true"]')) {
        giveStickToBoard();
      }
      // Also release focus so ignoreWhenInSidebar guards don't block card nav.
      if (container.contains(document.activeElement)) {
        (document.activeElement as HTMLElement)?.blur();
      }
    }
  }, [isOpen, claimsInputOnOpen]);

  // Unmounting while open never runs the branch above — a route change takes
  // the panel and its data-sidebar-open attribute away in one go — so the stick
  // would be left with something that no longer exists. WantCanvas's poll also
  // heals that, but only once you are back on the board; releasing here means
  // there is nothing to heal.
  useLayoutEffect(() => () => { giveStickToBoard(); }, []);

  useEffect(() => {
    const handleDragStart = () => setIsAnyDragging(true);
    const handleDragEnd = () => setIsAnyDragging(false);
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('dragend', handleDragEnd);
    return () => {
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  const backdropStyle: React.CSSProperties = {
    top: isBottom
      ? 'env(safe-area-inset-top, 0px)'
      : 'calc(env(safe-area-inset-top, 0px) + var(--header-height, 0px))',
    left: 0,
    right: 0,
    bottom: 0,
  };

  // Framed by an app, a sheet always rises from the bottom, as the app's own
  // sheets do: its controls ride on its tab bar, at the bottom, whatever this
  // person's header setting.
  const mobileSheetBottom = isMobileSheet && (isBottom || mobileForceBottom || nativeHost);
  const swipe = useSheetSwipeDismiss({
    fromBottom: mobileSheetBottom,
    enabled: isMobileSheet && isOpen,
    onDismiss: onClose,
  });
  /**
   * The sheet's own duration: whatever THIS move needs at the wide panel's speed.
   *
   * PANEL_TRAVEL_PX / PANEL_MS is the velocity the wide-screen panel has always
   * moved at — 480px in --motion-base's 280ms — and the sheet is given the time
   * its own distance needs to travel at that same rate. A phone sheet is nearly
   * the whole screen tall, so covering it in the panel's 280ms was roughly twice
   * the velocity: it read as a snap rather than as the same panel arriving from
   * a different edge.
   *
   * The distance is measured between renders rather than assumed to be the
   * sheet's height, because it is not always: a swipe let go of short of the
   * dismiss threshold springs back a few dozen pixels, and that is the same
   * speed over a shorter way — a fixed height-sized duration would make the
   * spring-back a long, floating drift.
   *
   * Clamped at both ends: far enough below the panel's own time that a small
   * spring-back stays crisp, far enough above it that a tall sheet on a large
   * phone never becomes a curtain.
   */
  const sheetY = isOpen
    ? swipe.offset
    : (mobileSheetBottom ? sheetTravel : -sheetTravel);
  const prevSheetYRef = useRef(sheetY);
  const sheetMs = Math.round(Math.min(560, Math.max(160,
    Math.abs(sheetY - prevSheetYRef.current) / (PANEL_TRAVEL_PX / PANEL_MS),
  )));
  // After the style below has been applied, not before: this render's distance
  // is measured from the offset the previous one actually painted.
  useLayoutEffect(() => { prevSheetYRef.current = sheetY; }, [sheetY]);

  // Framed by an app, a phone sheet gives its frame — grabber, icon and
  // title, close — to the app, which draws it natively along the sheet's top
  // (lib/nativeHost, useHostPanelStore). The sheet keeps the content, leaves
  // HOST_PANEL_BAR empty at its top for the app's bar, and says where its top
  // is once it has arrived; the app's close comes back here.
  const hostFrame = nativeHost && isMobileSheet;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hostOwner = useRef(`panel-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    if (!hostFrame) return;
    const owner = hostOwner.current;
    if (!isOpen) { useHostPanelStore.getState().clear(owner); return; }
    const publish = () => {
      const el = containerRef.current;
      if (!el) return;
      useHostPanelStore.getState().set(owner, {
        title: title ?? '',
        icon: iconName(TitleIcon as { displayName?: string } | undefined, ''),
        // Where it rests, not where the slide has it at this moment: the
        // transform is left out (offsetTop), so a slide still settling cannot
        // put the bar below the sheet's edge.
        top: Math.round(el.offsetTop),
        bare: false,
      }, () => onCloseRef.current());
    };
    // Once it has slid in, where it stands; and again when the page resizes.
    const settled = setTimeout(publish, sheetMs + 40);
    window.addEventListener('resize', publish);
    return () => {
      clearTimeout(settled);
      window.removeEventListener('resize', publish);
      useHostPanelStore.getState().clear(owner);
    };
    // sheetMs is read once per opening, as it was when the slide began.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostFrame, isOpen, title, TitleIcon, chromeless]);

  // Where the phone's sheet stands off the edge it slides from. Shut, it has
  // to travel this far as well as its own height: moved by only 100% it stops
  // with its top this far short of the edge, and that strip — the grabber and
  // a band of empty sheet — shows. Barely, in Safari, where the inset is the
  // home indicator's 34px; plainly in an app whose tab bar the page runs
  // under, where the inset is the whole tab bar.
  //
  // A header at the bottom carries the safe area inside it (Header's spacer),
  // so --header-height already counts it and the inset is not added again.
  //
  // Framed by an app, a sheet from the bottom goes all the way down: the app
  // puts its tab bar aside and folds its pill while a panel is open, so there
  // is nothing to stand clear of (its content keeps clear of the home
  // indicator — see the content's padding below).
  const sheetEdgeOffset = mobileSheetBottom && nativeHost && isMobileSheet
    ? '0px'
    : mobileSheetBottom
    ? (isBottom
      ? 'var(--header-height, 0px)'
      // A framing app's bar along the bottom, when it has one there.
      : 'calc(env(safe-area-inset-bottom, 0px) + var(--host-inset-bottom, 0px))')
    : (isBottom
      ? 'env(safe-area-inset-top, 0px)'
      // Below a framing app's bar along the top, when it has one there.
      : 'calc(env(safe-area-inset-top, 0px) + var(--header-height, 0px) + var(--host-inset-top, 0px))');

  const sidebarStyle: React.CSSProperties = isMobileSheet
    ? {
        left: 0,
        right: 0,
        ...(mobileSheetBottom
          ? { bottom: sheetEdgeOffset, top: 'auto' }
          : { top: sheetEdgeOffset, bottom: 'auto' }),
        // Nearly full height on a phone. 40vh meant a detail sheet showed a
        // couple of rows and everything else was a scroll away, on the one form
        // factor with the least room to scroll in. The strip left at the top is
        // deliberate: it shows the sheet is a sheet, keeps the page visible
        // behind it, and gives the backdrop somewhere to be tapped.
        // dvh, not vh — vh on iOS is the height with the URL bar hidden, so a
        // 100vh sheet sits partly under the browser chrome.
        //
        // Less the edge it stands on, too: its bottom is lifted by that much
        // (sheetEdgeOffset), and a sheet as tall as the screen above a lifted
        // bottom ran off the top — its close button with it, under the status
        // bar, once the bottom header grew by an app's tab bar.
        height: mobileSheetBottom
          ? `calc(100dvh - env(safe-area-inset-top, 0px) - 56px - ${sheetEdgeOffset})`
          : '40vh',
        transform: isOpen
          ? `translateY(${swipe.offset}px)`
          : (mobileSheetBottom
            ? `translateY(calc(100% + ${sheetEdgeOffset}))`
            : `translateY(calc(-100% - ${sheetEdgeOffset}))`),
        // No animation while a finger is on it, or the sheet lags the drag.
        // Otherwise its own duration rather than the shared token — the panel
        // and the sheet move at one speed, which is not one time (see sheetMs).
        transition: swipe.dragging ? 'none' : `transform ${sheetMs}ms var(--ease-settle)`,
        touchAction: 'pan-y',
        borderRadius: mobileSheetBottom ? '12px 12px 0 0' : '0 0 12px 12px',
        boxShadow: mobileSheetBottom ? '0 -4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.15)',
      }
    : {
        right: 0,
        top: isBottom
          ? 'env(safe-area-inset-top, 0px)'
          : 'calc(env(safe-area-inset-top, 0px) + var(--header-height, 0px))',
        // The bottom header's height includes the safe area (see sheetEdgeOffset).
        bottom: isBottom
          ? 'var(--header-height, 0px)'
          : 'env(safe-area-inset-bottom, 0px)',
        height: 'auto',
        // The panel comes in off the right edge and leaves the same way, at the
        // mobile sheet's duration and curve so it has one feel on every form
        // factor (motion tokens in index.css).
        //
        // Every panel, with no opt-out. The board's own detail panel used to
        // ask for no animation and so appeared fully formed, which made the one
        // panel that opens by itself — walk onto a want, its card is there —
        // the one panel that never showed where it came from. Opening and
        // closing are the same motion reversed, and a transform transition
        // retargets mid-flight, so walking along a row of wants slides it back
        // out from wherever it had got to rather than jumping.
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform var(--motion-base) var(--ease-settle)',
        boxShadow: '-4px 0 12px rgba(0,0,0,0.06)',
      };

  return (
    <>
      {/* Backdrop - now non-blocking to keep background active */}
      {isOpen && (
        <div
          className={classNames(
            'fixed z-40 lg:hidden pointer-events-none opacity-0',
          )}
          style={backdropStyle}
        />
      )}

      {/* Sidebar */}
      <div
        ref={containerRef}
        data-sidebar="true"
        tabIndex={-1}
        // Touching the panel is asking to be in it — the mirror of a press on
        // the board taking the stick back (WantCanvas's own pointerdown).
        // Capture, and pointerdown rather than click, for the same reasons
        // given there.
        onPointerDownCapture={() => giveStickToPanel()}
        className={classNames(
          'fixed bg-white dark:bg-gray-900 z-40 flex flex-col overflow-hidden',
          isMobileSheet ? 'w-full' : 'w-full sm:w-[480px]',
          className || ''
        )}
        onKeyDown={isOpen ? (e) => {
          // When the sidebar is open (state-based, not CSS-based), contain arrow
          // keys so they never bubble out to Dashboard's card navigation handler.
          // Inner form handlers (handleArrowKeyNavigation etc.) still fire first
          // because they are deeper in the DOM (bubble order: inner → outer).
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.stopPropagation();
          }
        } : undefined}
        style={{ ...sidebarStyle, '--mw-focus-color': focusColor } as React.CSSProperties}
        // The app's bar closes a framed sheet with a drag of its own.
        {...(isMobileSheet && !hostFrame ? swipe.handlers : {})}
      >
        {/* Sidebar-focus frame — the twin of the canvas's frame in WantCanvas,
            same character colour and same inset glow, so the pair reads as one
            indicator that moves rather than two decorations. Exactly one of
            them is lit at a time: this one while input is in the sidebar, the
            canvas one otherwise.

            It has to be its own layer. Put on the panel as a box-shadow it was
            invisible — the opaque background div below paints over the panel's
            own shadow, since a descendant draws above its ancestor's
            decorations. That is why this frame never appeared before. */}
        <div
          className="absolute inset-0 z-50 pointer-events-none transition-opacity duration-150"
          style={{
            // The same predicate the board's frame reads from the other side,
            // so exactly one of the two is lit — including while a card in here
            // is being operated, which is focus being in this panel as much as
            // standing in it is.
            opacity: inputHandedOver ? 1 : 0,
            // A blur bleeding in from the edges, no hard inset line — the same
            // "all frames are glows" treatment as the board's twin.
            boxShadow: `inset 0 0 10px ${frameColor}, inset 0 0 34px ${frameColor}66, inset 0 0 70px ${frameColor}33`,
          }}
        />

        {/* Solid, opaque sidebar background tinted with the page's menu colour —
            no see-through to the app background. */}
        <div
          className="absolute inset-0 w-full pointer-events-none bg-white dark:bg-gray-900"
          style={{
            // A screenful, so that a frame which scrolls its own content cannot
            // scroll the page out from behind it. Only a frame that scrolls:
            // where the panel does its own scrolling under a row that stays put
            // (overflowHidden), a backdrop taller than the frame is a scroll
            // height the frame is not otherwise entitled to — and the browser
            // spends it, nudging the whole panel up to reveal a focused tab and
            // carrying the identity row and its close button off the top.
            minHeight: overflowHidden ? '100%' : '100vh',
            zIndex: 0,
            ...(menuColor ? { backgroundImage: `linear-gradient(${menuColor}2e, ${menuColor}2e)` } : {}),
          }}
        />

        {/* Grab handle — mobile sheet only. Tap closes; so does a swipe
            toward the docked edge, handled on the sheet itself.
            Now that the sheet covers most of the screen, this bar is the main
            thing saying "pull me down", so it is drawn large enough to read as
            a control rather than as trim: a wider, thicker bar with room around
            it, which is also the touch target. */}
        {/* The strip the app's bar is drawn over, when the app draws the frame. */}
        {hostFrame && <div aria-hidden className="flex-shrink-0" style={{ height: HOST_PANEL_BAR }} />}
        {/* What a panel adds to its header (a selected want's status and
            Reload) is the page's own, so it stays — a row of its own under the
            app's bar. */}
        {hostFrame && !chromeless && headerActions && (
          <div className="flex-shrink-0 flex items-stretch justify-end relative z-20 border-b border-gray-200 dark:border-gray-700" style={{ minHeight: 44 }}>
            {headerActions}
          </div>
        )}
        {isMobileSheet && mobileSheetBottom && !hostFrame && (
          <div
            className="flex-shrink-0 flex justify-center pt-2.5 pb-2 cursor-pointer relative z-20"
            onClick={onClose}
            role="button"
            aria-label="閉じる（下スワイプでも閉じます）"
          >
            <div className="w-12 h-1.5 bg-gray-400/80 dark:bg-gray-500 rounded-full" />
          </div>
        )}

        {/* Header. Absent for a panel that says what it is by itself — see
            `chromeless`. */}
        {!chromeless && !hostFrame && (
        <div
          className={classNames(
            'flex-shrink-0 bg-white dark:bg-gray-900 flex items-stretch justify-between z-20 relative',
            isBottom
              ? 'order-last border-t border-gray-200 dark:border-gray-700'
              : 'border-b border-gray-200 dark:border-gray-700'
          )}
          style={isBottom ? { paddingBottom: 'env(safe-area-inset-bottom)' } : {}}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 px-3 sm:px-4 py-1.5 sm:py-2">
            {title && (
              <h2 className="text-sm sm:text-base font-medium text-gray-800 dark:text-gray-100 truncate flex items-center gap-1.5">
                {TitleIcon && <TitleIcon className={classNames('h-4 w-4 flex-shrink-0', titleIconClassName || '')} style={titleIconStyle} />}
                {title}
              </h2>
            )}
          </div>
          <div className="flex items-stretch gap-0 flex-shrink-0">
            {headerActions && <div className="flex items-stretch gap-0">{headerActions}</div>}
            {/* The same button the card-topped panels put on their card — see
                PanelCloseButton. A panel decides where its close goes; what one
                looks like is not its to decide. */}
            <PanelCloseButton onClick={onClose} tabIndex={-1} className="self-center mr-1" />
          </div>
        </div>
        )}

        {/* Grab handle — mobile sheet only (bottom handle when the sheet is
            docked to the top) */}
        {isMobileSheet && !mobileSheetBottom && !hostFrame && (
          <div
            className="flex-shrink-0 flex justify-center pt-1 pb-2 cursor-pointer"
            onClick={onClose}
          >
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Content */}
        <div
          className={`flex-1 h-full px-0 py-0 relative z-10 ${overflowHidden ? 'overflow-hidden' : 'overflow-y-auto'}`}
          style={hostFrame && mobileSheetBottom ? { paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : undefined}
        >
          <div className="h-full sidebar-compact">
            <HostFramedPanel.Provider value={hostFrame}>
              {(isOpen || contentsMounted) && children}
            </HostFramedPanel.Provider>
          </div>
        </div>
      </div>
    </>
  );
};
