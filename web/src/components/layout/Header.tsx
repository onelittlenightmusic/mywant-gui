import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useHeaderAtBottom, useDisplaySettings } from '@/hooks/useDisplaySettings';
import { Plus, Heart, ListChecks, Map, Bot, Globe, Menu, X, Zap, BookOpen, Activity, Settings, Trophy, HelpCircle, Smartphone, Circle, Layers, Upload, Gamepad2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { classNames } from '@/utils/helpers';
import { InteractBubble } from '@/components/interact/InteractBubble';
import { useConfigStore } from '@/stores/configStore';
import { NAV_CARD_FIT, SYSTEM_FONT_SIZE_DEFAULT } from '@/hooks/useSystemFontSize';
import { NavCard } from './NavCard';
import { GlobalControlPill, goToAttention } from './GlobalControlPill';
import { useSystemPauseStore } from '@/stores/systemPauseStore';
import { useAttentionStore } from '@/stores/attentionStore';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { HelpModal } from '@/components/modals/HelpModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { Slot } from '@/extensions/Slot';
import { extensionMenu } from '@/extensions/registry';
import { useOriginReveal, anchoredRevealStyle } from '@/components/ui/originReveal';
import { nativeHost, postToHost, onHostPress, iconName, useHostCardStore, useHostPanelStore, useHostSheetStore, type HostButton } from '@/lib/nativeHost';
import { useInputActions } from '@/hooks/useInputActions';
import { useMyCursorColor } from '@/hooks/useMyCursorColor';
import { useDarkMode } from '@/hooks/useDarkMode';
import { characterBadgeColor } from '@/design/characterColor';
import { useCharacterStore } from '@/stores/characterStore';
import { CursorManIcon } from '@/components/dashboard/CursorManIcon';
import { useNavBadgeStore, hasAnyNavBadge } from '@/stores/navBadgeStore';
import { playSound } from '@/utils/sounds';
import { playHapticClick } from '@/utils/haptic';

export interface HeaderProps {
  onCreateWant: () => void;
  /** Opens the Add Thing form. Same act as the Thing page's own header button —
   *  a page that shows things should be able to make one. */
  onCreateThing?: () => void;
  isAddWantActive?: boolean;
  /** The Add Thing panel is open, so the button closes it — see isAddWantActive. */
  isAddThingActive?: boolean;
  title?: string;
  /** Tooltip/label for the create button. Pages that create something other
   *  than a want (Worlds, ...) override this and createButtonIcon together. */
  createButtonLabel?: string;
  createButtonIcon?: LucideIcon;
  itemCount?: number;
  itemLabel?: string;
  sidebarMinimized?: boolean;
  hideCreateButton?: boolean;
  showSelectMode?: boolean;
  onToggleSelectMode?: () => void;
  onInteractSubmit?: (message: string) => void;
  isInteractThinking?: boolean;
  hasUnreadReply?: boolean;
  onViewReply?: () => void;
  showMinimap?: boolean;
  onMinimapToggle?: () => void;
  showGlobalState?: boolean;
  onGlobalStateToggle?: () => void;
  /** Upload a YAML file — shown as an Import button when provided. */
  onImport?: () => void;
  isImporting?: boolean;
  /**
   * Show and hide the on-screen pad. Provided only where there is a board to
   * drive, so the button is absent everywhere else rather than present and
   * inert — the same way Global and Import earn their place.
   */
  onPadToggle?: () => void;
  /** Whether the pad is currently out, so the button can show it. */
  showPad?: boolean;
  /**
   * Show the Y-jump-mode lamp — a live, non-clickable indicator of what
   * CursorMan's drag currently means: lit while Y is held ("Y-jump" — aim
   * the jump cluster), dim the rest of the time ("near jump" — drag steps
   * like a D-pad). Provided only where there is a board to drive, same as
   * onPadToggle.
   */
  showZModeLamp?: boolean;
  /**
   * One more button that belongs to the page rather than to every page — the
   * Extension page's Install / Installed, say. Drawn like Import and Select,
   * after them, and walked by the header cursor the same way.
   */
  pageAction?: HeaderPageAction;
}

export interface HeaderPageAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Its panel is open: lit, the way Add Want is while its form is. */
  active?: boolean;
  /** Classes for the button's resting colour, when it has something to say
   *  even before it is pressed (Installed is green). */
  toneClass?: string;
  tooltip?: string;
}

/**
 * True where the header has no room for one cell per action.
 *
 * Nine cells at 48px plus a hamburger and a title need about 540px, which a
 * phone does not have: on a 390px screen the row ran off both ends. Below this
 * the three create buttons share one cell — see the create menu — and every
 * cell is drawn tighter.
 *
 * Matches Tailwind's `sm`, so what JavaScript decides here and what the classes
 * decide agree rather than disagreeing by a few pixels.
 */
function useCompactHeader(): boolean {
  const [compact, setCompact] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return compact;
}

/**
 * Wide enough for the interact bubble to sit in the control pill as a field.
 * Below this the pill carries the character instead, which opens the bubble
 * as an overlay — the same breakpoint (Tailwind's `lg`) the bubble always
 * switched at.
 */
function useWideHeader(): boolean {
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

// All navigable menu entries in display order.
// href: null means it triggers a modal (Settings).
interface NavEntry {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  href: string | null;
  /** Accent colour for this entry's icon in the menu. */
  color: string;
}

const BASE_NAV_ENTRIES: NavEntry[] = [
  { id: 'wants',        label: 'Wants',        icon: Heart,      href: '/dashboard',   color: '#ec4899' },
  { id: 'thing',        label: 'Thing',         icon: Circle,     href: '/thing',        color: '#f59e0b' },
  { id: 'wantTypes',    label: 'Want Types',    icon: Zap,        href: '/want-types',  color: '#a855f7' },
  { id: 'worlds',       label: 'Worlds',        icon: Layers,     href: '/worlds',      color: '#6366f1' },
  { id: 'agents',       label: 'Agents',        icon: Bot,        href: '/agents',      color: '#3b82f6' },
  { id: 'recipes',      label: 'Recipes',       icon: BookOpen,   href: '/recipes',     color: '#10b981' },
  { id: 'achievements', label: 'Achievements',  icon: Trophy,     href: '/achievements',color: '#eab308' },
  { id: 'logs',         label: 'Logs',          icon: Activity,   href: '/logs',        color: '#64748b' },
  { id: 'devices',      label: 'Devices',       icon: Smartphone, href: '/devices',     color: '#14b8a6' },
  { id: 'characters',   label: 'Characters',    icon: Users,      href: '/characters',  color: '#8b5cf6' },
  { id: 'help',         label: 'Help',          icon: HelpCircle, href: null,           color: '#6b7280' },
  { id: 'settings',     label: 'Settings',      icon: Settings,   href: null,           color: '#6b7280' },
];

/**
 * The menu: this app's own entries, with each extension's slotted in after the
 * one it names (see extensions/registry). Built on first use rather than at
 * load, because extensions register after this module has been evaluated.
 */
let navCache: NavEntry[] | null = null;
function navEntries(): NavEntry[] {
  if (navCache) return navCache;
  const out = [...BASE_NAV_ENTRIES];
  for (const item of extensionMenu()) {
    const at = item.after ? out.findIndex(e => e.id === item.after) : -1;
    const entry: NavEntry = { id: item.id, label: item.label, icon: item.icon, href: item.href, color: item.color };
    // Before Help and Settings when it names nothing — those two close the menu.
    if (at >= 0) out.splice(at + 1, 0, entry);
    else out.splice(Math.max(0, out.findIndex(e => e.id === 'help')), 0, entry);
  }
  return (navCache = out);
}

const MAIN_IDS  = new Set(['wants', 'canvas', 'thing']);

/**
 * How many menu cards sit in a row.
 *
 * Both grids are laid out from this and the keyboard steps down by it, so the
 * cursor moves the way the menu looks. The two sections are separate grids but
 * one continuous index space — with MAIN taking exactly one row, "down" from
 * the top row lands in Advanced, which is what it appears to do.
 */
const NAV_COLS = 3;
const navGridStyle = { gridTemplateColumns: `repeat(${NAV_COLS}, minmax(0, 1fr))` } as const;

/**
 * Unread marker for a menu entry. Sized to sit next to the entry's icon without
 * shifting the row, and coloured with the entry's own accent so a dot reads as
 * belonging to that section.
 */
const NavDot: React.FC<{ color?: string; className?: string }> = ({ color, className }) => (
  <span
    aria-hidden
    className={classNames('block w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-900', className)}
    style={{ background: color ?? '#ef4444' }}
  />
);

export const Header: React.FC<HeaderProps> = ({
  onCreateWant,
  onCreateThing,
  isAddWantActive = false,
  isAddThingActive = false,
  title = 'MyWant',
  createButtonLabel = 'Add Want',
  createButtonIcon: CreateIcon = Heart,
  itemCount,
  itemLabel,
  sidebarMinimized: _controlledMinimized,
  hideCreateButton = false,
  showSelectMode = false,
  onToggleSelectMode,
  onInteractSubmit,
  isInteractThinking = false,
  hasUnreadReply = false,
  onViewReply,
  showMinimap = false,
  onMinimapToggle,
  onImport,
  isImporting = false,
  showGlobalState = false,
  onGlobalStateToggle,
  onPadToggle,
  showPad = false,
  showZModeLamp = false,
  pageAction,
}) => {
  const config = useConfigStore(state => state.config);
  // The floor and ceiling the menu cards fit their labels between — handed to
  // CSS as variables because the size itself is computed per card, not picked.
  const navFit = NAV_CARD_FIT[config?.system_font_size ?? SYSTEM_FONT_SIZE_DEFAULT];
  const location = useLocation();
  const navigate = useNavigate();
  const myCharacter = useCharacterStore(s => s.getMyCharacter());
  const attentionColor = characterBadgeColor(useMyCursorColor(), useDarkMode());
  const navBadges = useNavBadgeStore(s => s.badges);
  const anyNavBadge = hasAnyNavBadge(navBadges);

  const isBottom = useHeaderAtBottom();
  // Framed by an app, the buttons are drawn natively, each in a cell of its
  // own — so the three creates never need to share one.
  const compact = useCompactHeader() && !nativeHost;
  const wide = useWideHeader();
  // Which of the three creates the one ＋ is currently offering.
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  // The menu leaves the ＋ it belongs to, the way the pad leaves the Pad cell.
  const createReveal = useOriginReveal(createMenuOpen, '[data-header-btn-id="create"]');
  const createMenuRef = useRef<HTMLDivElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  // Where the ＋ sits, in viewport pixels, at the moment the menu opened.
  //
  // The menu is drawn into the body rather than beside the button, because the
  // row of cells clips its overflow — it bleeds the cells past the header's own
  // padding with a negative margin, and hides what that spills. A menu is
  // exactly the thing meant to spill, so it goes outside the clip and is
  // positioned by measurement instead.
  const [createAt, setCreateAt] = useState<{ right: number; top: number; bottom: number } | null>(null);

  // Dismiss on a press elsewhere and on Escape, the two ways anybody expects to
  // back out of a menu they opened by accident.
  useEffect(() => {
    if (!createMenuOpen) { setCreateAt(null); return; }
    const r = createBtnRef.current?.getBoundingClientRect();
    if (r) {
      setCreateAt({
        right: Math.round(window.innerWidth - r.right),
        top: Math.round(r.bottom),
        bottom: Math.round(window.innerHeight - r.top),
      });
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The menu is portalled out of the button's own subtree, so both have to
      // be asked; "not inside the button" alone would close it on the way to
      // choosing something from it.
      if (createMenuRef.current?.contains(t) || createBtnRef.current?.contains(t)) return;
      setCreateMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCreateMenuOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [createMenuOpen]);

  // Widening the window puts the three cells back; a menu belonging to a cell
  // that no longer exists would hang there with nothing under it.
  useEffect(() => { if (!compact) setCreateMenuOpen(false); }, [compact]);
  const [menuOpen, setMenuOpen] = useState(false);
  // And the nav menu leaves the hamburger, for the same reason.
  const menuReveal = useOriginReveal(menuOpen, '[aria-label="Toggle menu"]');
  // Where the hamburger is, in viewport pixels, while its menu is open — the
  // menu is portalled to the body (see the dropdown) and placed from this.
  const [menuAt, setMenuAt] = useState<{ left: number; top: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const measure = () => {
      const r = document.querySelector('[aria-label="Toggle menu"]')?.getBoundingClientRect();
      if (r) setMenuAt({ left: Math.round(r.left), top: Math.round(r.bottom), bottom: Math.round(window.innerHeight - r.top) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [menuOpen]);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // The Select button's cursor over the header controls, as one ring:
  //   -1        — not in the header
  //    0        — the hamburger (its menu is open while the cursor rests here)
  //    1..N     — hBtns[headerNavIdx - 1]
  // Each Select press advances one slot and wraps past the last control back to
  // the hamburger; the derived headerFocusIdx below keeps the per-button ring
  // styling working unchanged.
  const [headerNavIdx, setHeaderNavIdx] = useState(-1);
  const [showProviderSelect, setShowProviderSelect] = useState(false);
  /** The create button makes a want here, rather than whatever a page reuses it for. */
  const createsWant = createButtonLabel === 'Add Want';
  const [showBubbleOnMobile, setShowBubbleOnMobile] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  /** The character cell — the toggle these panels belong to. See below. */
  const robotBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Reset focused item index whenever the menu closes.
  useEffect(() => {
    if (!menuOpen) setFocusedIdx(-1);
  }, [menuOpen]);

  // Set CSS variable for header height so sidebars can offset accordingly
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`);
    });
    observer.observe(el);
    document.documentElement.style.setProperty('--header-height', `${el.offsetHeight}px`);
    return () => observer.disconnect();
  }, []);

  // Hide provider select and mobile bubble when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // The button that opens these is not "outside" them.
      //
      // It lives in the header row, `selectRef` wraps only the panel, so a
      // press on it counted as a press elsewhere: mousedown closed, React
      // re-rendered in the gap before the click, and the click then found
      // everything shut and opened it again. One tap, closed and reopened, and
      // from the outside a button that will not close.
      //
      // Invisible to a synthetic test, too, which is how it survived two
      // attempts: dispatching mousedown and click in one go puts them in a
      // single React batch, so the re-render that makes the second handler
      // disagree with the first never happens.
      if (robotBtnRef.current?.contains(event.target as Node)) return;
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setShowProviderSelect(false);
        if (window.innerWidth < 1024) {
          setShowBubbleOnMobile(false);
        }
      }
    };

    if (showProviderSelect || showBubbleOnMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProviderSelect, showBubbleOnMobile]);

  /**
   * Opening and closing the menu, said out loud — the same pair the detail
   * panel uses, because it is the same move: input goes into a surface in front
   * of everything else, and then comes back out.
   *
   * Driven off the state rather than the six places that set it (the button,
   * Select/Alt+Enter, Escape, an outside click, and mouse enter/leave, which
   * fire on a timer). Sounding each of those would have meant six chances to
   * miss one, and the mouse-leave timer would have been the one to go wrong.
   */
  const prevMenuOpenRef = useRef(false);
  // Choosing an entry closes the menu as a side effect. The choice has already
  // been sounded, and letting the close sound follow it would end every
  // selection on "dismissed" — the two sounds mean opposite things and the last
  // one is the one you hear.
  const closedByChoiceRef = useRef(false);
  useEffect(() => {
    if (menuOpen === prevMenuOpenRef.current) return;
    prevMenuOpenRef.current = menuOpen;
    if (!menuOpen && closedByChoiceRef.current) {
      closedByChoiceRef.current = false;
      return;
    }
    playSound(menuOpen ? 'handoverIn' : 'handoverOut');
  }, [menuOpen]);

  const menuJustClosedRef = useRef(false);
  const menuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close hamburger menu when mouse leaves — with a short delay so the cursor
  // can travel from the button to the dropdown without the menu disappearing.
  const handleMenuMouseLeave = () => {
    menuCloseTimerRef.current = setTimeout(() => setMenuOpen(false), 120);
  };
  const handleMenuMouseEnter = () => {
    if (menuCloseTimerRef.current) {
      clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
    if (!menuJustClosedRef.current) setMenuOpen(true);
  };

  /**
   * The character cell, which opens and closes like every other cell in the
   * row.
   *
   * It used to have a branch in front of that: with a reply waiting, a tap
   * showed the reply and returned, so the button was not a toggle at all —
   * press it twice with an unread reply and it opened, then opened again.
   * Every other header button answers a second press by closing, and one that
   * sometimes does not is the kind of thing you learn not to trust rather than
   * learn the rule for.
   *
   * A waiting reply is a reason to show something when opening, not a reason
   * to stop being a switch. So the toggle happens either way, and the reply is
   * delivered on the way in.
   */
  /**
   * The tick a header cell makes when a finger lands on it.
   *
   * On pointerdown, not click: the sound is feedback for the press, and a press
   * is felt when the finger arrives, not when it leaves. The pad's buttons
   * already answer this way — this is the same call they make, so a control in
   * the header and a control on the board sound alike.
   */
  const cellTick = () => playHapticClick();

  const handleRobotClick = () => {
    // "Is anything of mine on screen?" — not "is the flag I happen to consult
    // set?".
    //
    // Two booleans stand for one visible state: the bubble on a narrow screen,
    // the provider list on a wide one. Asking only the one that matches the
    // current width meant that whenever the OTHER was the thing showing, a
    // press read the panel as closed and opened it again. It took two presses
    // to shut, or never shut, depending on which flag had drifted — and the
    // flags drift easily, because six places set them and the width can change
    // under a phone while they are set (a keyboard opening is a resize).
    //
    // Asking both removes the question of which one is authoritative. Anything
    // open closes; nothing open opens.
    const isOpen = showBubbleOnMobile || showProviderSelect;

    if (isOpen) {
      setShowBubbleOnMobile(false);
      setShowProviderSelect(false);
      return;
    }

    if (window.innerWidth < 1024) setShowBubbleOnMobile(true);
    setShowProviderSelect(true);
    if (hasUnreadReply) onViewReply?.();
  };

  const handleInteractSubmitInternal = (message: string) => {
    onInteractSubmit?.(message);
    if (window.innerWidth < 1024) {
      setShowBubbleOnMobile(false);
    }
  };

  const closeMenu = useCallback(() => {
    menuJustClosedRef.current = true;
    setTimeout(() => { menuJustClosedRef.current = false; }, 400);
    (document.activeElement as HTMLElement)?.blur();
    setMenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  // Select / Alt+Enter: step the header cursor one slot to the right.
  //
  //   not in the header  → land on the hamburger (index 0); its menu opens and
  //                        the arrows navigate the menu as they always have.
  //   on a slot          → advance to the next; leaving the hamburger closes
  //                        its menu behind you.
  //   past the last      → wrap back to the hamburger.
  //
  // On a page with no header toggles at all the ring is just the hamburger, so
  // Select there simply toggles its menu. B / Escape / outside-click still
  // close and leave the header.
  const stepHeaderCursor = useCallback(() => {
    const ringLen = hBtnsRef.current + 1;
    setHeaderNavIdx(cur => {
      if (cur >= 0 && ringLen === 1) {          // nowhere to advance to
        closeMenu();
        return -1;
      }
      // In from outside: the control pill's first cell (slot 1), not the menu.
      const next = cur < 0 ? (ringLen > 1 ? 1 : 0) : (cur + 1) % ringLen;
      if (next === 0) {
        setMenuOpen(true);
        setFocusedIdx(0);
      } else {
        setMenuOpen(false);
        setFocusedIdx(-1);
      }
      playSound('gridMove');
      return next;
    });
  }, [closeMenu]);

  // Move the header cursor to an absolute slot (arrows, Tab). Same open/close
  // side effects as stepHeaderCursor.
  const goHeaderSlot = useCallback((slot: number) => {
    const ringLen = hBtnsRef.current + 1;
    const s = ((slot % ringLen) + ringLen) % ringLen;
    setHeaderNavIdx(s);
    if (s === 0) { setMenuOpen(true); setFocusedIdx(0); }
    else { setMenuOpen(false); setFocusedIdx(-1); }
    playSound('gridMove');
  }, []);

  /**
   * Choosing an entry, said out loud — and then getting out of the menu's way.
   *
   * Same sound as blowing a card up, because it is the same move: you picked a
   * thing and the thing takes the screen. The menu happens to go away
   * afterwards, and the effect above stands down for that close, so the choice
   * is the only thing heard.
   *
   * All three doors into a choice go through here — Select/A on the focused
   * item, a click on a page card, a click on a modal card. The click doors used
   * to call closeMenu() directly and so said nothing at all; the only thing
   * that reached your ears was the menu dismissing itself, which is the
   * opposite of what just happened.
   */
  const chooseEntry = useCallback(() => {
    closedByChoiceRef.current = true;
    playSound('cardMaximize');
    closeMenu();
  }, [closeMenu]);

  // Confirm the currently focused menu item.
  const confirmFocusedItem = useCallback(() => {
    if (focusedIdx < 0 || focusedIdx >= navEntries().length) return;
    const entry = navEntries()[focusedIdx];
    // Framed by an app, its menu is what is showing: the app decides where the
    // choice goes — a page it has a tab for opens there, not in this one.
    if (nativeHost) {
      postToHost({ type: 'choose', id: `menu:${entry.id}`, href: entry.href ?? undefined });
      chooseEntry();
      return;
    }
    if (entry.href) {
      navigate(entry.href);
    } else if (entry.id === 'settings') {
      setIsSettingsOpen(true);
    } else if (entry.id === 'help') {
      setIsHelpOpen(true);
    }
    chooseEntry();
  }, [focusedIdx, navigate, chooseEntry]);

  // ── Add Want / Add Thing: one choice, two answers ───────────────────────────
  // Like a segmented control, or the tabs along the bottom of a phone: one of
  // them at a time. Each still closes its own panel when pressed again; pressed
  // while the other's panel is open, it closes that one first — both lit at
  // once read as two panels open, which is never what was meant.
  const createWant = useCallback(() => {
    if (isAddThingActive) onCreateThing?.();
    onCreateWant();
  }, [isAddThingActive, onCreateThing, onCreateWant]);
  const createThing = useCallback(() => {
    if (isAddWantActive) onCreateWant();
    onCreateThing?.();
  }, [isAddWantActive, onCreateWant, onCreateThing]);

  // ── Header button list (dynamic — only buttons that are present) ─────────────
  // 'want' (Add Want) is listed first so it's always the button the Y button /
  // header-focus-entry lands on, regardless of which other buttons are shown.
  // Re-derive the ring when the alert cell comes or goes.
  const attentionCount = useAttentionStore(s => s.items.length);
  const headerButtons = useCallback(() => {
    const btns: Array<{ id: string; label: string; action: () => void }> = [];
    // The control pill first: it is what Select is for — the controls that
    // matter on every tab — so the first press lands on it (see
    // stepHeaderCursor), and a left from its first cell reaches the
    // hamburger, which is where that is on screen.
    btns.push({ id: 'pill-pause', label: 'Pause', action: () => { void useSystemPauseStore.getState().toggle(); } });
    if (useAttentionStore.getState().items.length > 0) {
      btns.push({ id: 'pill-attention', label: 'Alert', action: () => goToAttention(useAttentionStore.getState().items[0], navigate) });
    }
    // Framed by an app, neither is a button: the menu they open is the app's
    // own (see the host effect below), and talking is the app's chat tab.
    if (!nativeHost) btns.push({ id: 'pill-bell', label: 'News', action: () => { setMenuOpen(true); setFocusedIdx(0); } });
    if (onInteractSubmit && !nativeHost) {
      btns.push({
        id: 'pill-talk', label: 'Talk', action: () => {
          if (window.innerWidth >= 1024) (document.querySelector('[data-global-control-pill] [data-interact-input]') as HTMLInputElement | null)?.focus();
          else setShowBubbleOnMobile(true);
        },
      });
    }
    // Narrow: the three creates share one cell, so the focus walk has one stop
    // for them too — a walk that visits buttons nobody can see is a walk that
    // appears to skip. First either way, so the Y button and header-focus entry
    // land on making something whichever shape the row is in.
    if (!hideCreateButton && compact) {
      btns.push({ id: 'create', label: 'New', action: () => setCreateMenuOpen(v => !v) });
    } else if (!hideCreateButton) {
      btns.push({ id: 'want', label: createButtonLabel.replace(/^(Add|New)\s+/i, ''), action: createWant });
      // Beside it, as the pair is drawn: the other answer to the same choice.
      if (onCreateThing) btns.push({ id: 'thing', label: 'Thing', action: createThing });
    }
    if (onGlobalStateToggle) {
      btns.push({ id: 'global', label: 'Global', action: onGlobalStateToggle });
    }
    if (onImport)             btns.push({ id: 'import', label: 'Import', action: onImport });
    if (onToggleSelectMode)   btns.push({ id: 'select', label: 'Select', action: onToggleSelectMode });
    if (pageAction)           btns.push({ id: 'page', label: pageAction.label, action: pageAction.onClick });
    // Last, so it is the far right of the row and the last stop of a rightward
    // walk through it.
    if (onPadToggle) btns.push({ id: 'pad', label: 'Pad', action: onPadToggle });
    return btns;
  }, [onGlobalStateToggle, onImport, onToggleSelectMode, pageAction, hideCreateButton, onCreateThing, createWant, createThing, createButtonLabel, onPadToggle, compact, attentionCount, onInteractSubmit, navigate]);

  const hBtns = headerButtons();
  // Stable handle to the current control count for the header-cursor callbacks,
  // whose deps must not churn every render.
  const hBtnsRef = useRef(0);
  hBtnsRef.current = hBtns.length;

  // ── Framed by an app: the buttons and the menu, told to it ──────────────────
  // The header is not drawn (see lib/nativeHost); the app draws these instead
  // and sends a press back by id, which runs the very action the header's own
  // button would have. Each with the Lucide name of the icon it has here, and
  // whether it is lit.
  const paused = useSystemPauseStore(s => s.paused);
  // The setting itself: useHeaderAtBottom says "top" whenever an app frames
  // the page, and this is what the app's own bar goes by.
  const headerSetting = useDisplaySettings().header_position;
  const hostCardActions = useHostCardStore(s => s.actions);
  const hostPanel = useHostPanelStore(s => s.panel);
  const hostSheet = useHostSheetStore(s => s.sheet);
  const hostActionsRef = useRef<Record<string, () => void>>({});
  const hostLastRef = useRef('');
  useEffect(() => {
    if (!nativeHost) return;
    const look: Record<string, [string, boolean?]> = {
      'pill-pause': [paused ? 'Play' : 'Pause', !!paused],
      'pill-attention': ['TriangleAlert'],
      want: [iconName(CreateIcon, 'Heart'), isAddWantActive],
      thing: ['Circle', isAddThingActive],
      global: ['Globe', showGlobalState],
      import: ['Upload'],
      select: ['ListChecks', showSelectMode],
      page: [iconName(pageAction?.icon, 'Circle'), pageAction?.active],
      pad: ['Gamepad2', showPad],
    };
    const actions: Record<string, () => void> = {};
    const buttons: HostButton[] = [];
    for (const b of hBtns) {
      const [icon, active] = look[b.id] ?? ['Circle'];
      buttons.push({ id: b.id, label: b.label, icon, active: !!active });
      actions[b.id] = b.action;
    }
    // Not one of the walked cells, but a button all the same.
    if (onMinimapToggle) {
      buttons.push({ id: 'minimap', label: 'Minimap', icon: 'Map', active: showMinimap });
      actions.minimap = onMinimapToggle;
    }
    const menu: HostButton[] = navEntries().map(entry => {
      const id = `menu:${entry.id}`;
      actions[id] = () => {
        if (entry.href) navigate(entry.href);
        else if (entry.id === 'settings') setIsSettingsOpen(true);
        else if (entry.id === 'help') setIsHelpOpen(true);
      };
      return {
        id, label: entry.label, icon: iconName(entry.icon, 'Circle'),
        active: location.pathname === entry.href, href: entry.href ?? undefined,
      };
    });
    const card: HostButton[] = hostCardActions.map(a => {
      actions[a.id] = a.run;
      return { id: a.id, label: a.label, icon: a.icon };
    });
    // The menu closed from the app's side (its sheet swiped away): the header
    // cursor lets go with it, as Back would.
    actions['host:menu-close'] = () => { closeMenu(); setHeaderNavIdx(-1); setFocusedIdx(-1); };
    // The open panel's close, drawn by the app (see useHostPanelStore).
    actions['panel:close'] = () => useHostPanelStore.getState().close?.();
    // The app's sheet closed (see useHostSheetStore): the panel closes here.
    actions['sheet:close'] = () => useHostSheetStore.getState().close?.();
    // The header cursor, for the app to draw: Select still walks it here, in
    // the one place the gamepad's meaning lives — the app only shows it.
    const focus = {
      slot: headerNavIdx === 0 ? 'menu' : headerNavIdx >= 1 ? (hBtns[headerNavIdx - 1]?.id ?? null) : null,
      menu: menuOpen,
      menuIndex: menuOpen ? focusedIdx : -1,
    };
    hostActionsRef.current = actions;
    const message = { type: 'header' as const, buttons, menu, card, focus, panel: hostPanel, sheet: hostSheet, position: headerSetting === 'bottom' ? 'bottom' as const : 'top' as const };
    const json = JSON.stringify(message);
    if (json === hostLastRef.current) return;
    hostLastRef.current = json;
    postToHost(message);
  });
  useEffect(() => {
    if (nativeHost) onHostPress(id => hostActionsRef.current[id]?.());
  }, []);
  // Slots 1..N map onto hBtns; slot 0 is the hamburger, slot -1 is "not here".
  const headerFocusIdx = headerNavIdx >= 1 ? headerNavIdx - 1 : -1;
  const isHeaderFocused = headerFocusIdx >= 0;
  const onHamburgerSlot = headerNavIdx === 0;
  const headerCursorActive = headerNavIdx >= 0;

  // ── Unified keyboard + gamepad input ─────────────────────────────────────────
  useInputActions({
    // Alt+Enter / Select button: walk the header controls, hamburger first.
    onMenuToggle: stepHeaderCursor,

    // Y is no longer a header control — it drives the canvas jump overlay now.
    onYButton: undefined,

    // While the menu is open, navigate through menu items.
    // While a header button (not the hamburger) holds the cursor, arrows walk
    // the control ring — including back onto the hamburger.
    onNavigate: menuOpen ? (dir) => {
      // The menu is a card grid like any other, so moving through it ticks like
      // any other. Every branch below wraps rather than stopping at an edge, so
      // a direction always moves and the tick is always earned.
      playSound('gridMove');
      const n = navEntries().length;
      // The menu is a grid now, so up/down cross a row and left/right a card.
      // Both wrap through the whole list rather than stopping at an edge — the
      // list is short enough that wrapping is quicker than reversing.
      if (dir === 'up') {
        setFocusedIdx(i => (i < 0 ? n - 1 : (i - NAV_COLS + n) % n));
      } else if (dir === 'down') {
        setFocusedIdx(i => (i < 0 ? 0 : (i + NAV_COLS) % n));
      } else if (dir === 'left') {
        setFocusedIdx(i => (i <= 0 ? n - 1 : i - 1));
      } else if (dir === 'right') {
        setFocusedIdx(i => (i < 0 ? 0 : (i + 1) % n));
      } else if (dir === 'home') {
        setFocusedIdx(0);
      } else if (dir === 'end') {
        setFocusedIdx(navEntries().length - 1);
      }
    } : isHeaderFocused ? (dir) => {
      if (dir === 'left')  goHeaderSlot(headerNavIdx - 1);
      if (dir === 'right') goHeaderSlot(headerNavIdx + 1);
    } : undefined,

    onTabForward: menuOpen ? () => {
      playSound('gridMove');
      setFocusedIdx(i => (i < 0 ? 0 : (i + 1) % navEntries().length));
    } : isHeaderFocused ? () => goHeaderSlot(headerNavIdx + 1) : undefined,

    onTabBackward: menuOpen ? () => {
      playSound('gridMove');
      setFocusedIdx(i => (i <= 0 ? navEntries().length - 1 : i - 1));
    } : isHeaderFocused ? () => goHeaderSlot(headerNavIdx - 1) : undefined,

    // Confirm/cancel for menu or header selection.
    onConfirm: menuOpen ? confirmFocusedItem
      : isHeaderFocused ? () => {
          hBtns[headerFocusIdx]?.action();
          setHeaderNavIdx(-1);
        } : undefined,
    onCancel: (menuOpen || headerCursorActive) ? () => {
      if (menuOpen) closeMenu();
      setHeaderNavIdx(-1);
    } : undefined,

    // Capture all input while the menu or header cursor is active.
    captureInput: menuOpen || headerCursorActive,

    ignoreWhenInputFocused: true,
    ignoreWhenInSidebar: false,
  });

  // Who answers what is said in the bubble — the extension that answers it
  // draws the choice (interactProviderSelect). Slides out beside the bubble.
  const providerSelect = (
    <div className={classNames(
      "transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0",
      showProviderSelect ? "opacity-100 max-w-xs" : "opacity-0 max-w-0"
    )}>
      <Slot name="interactProviderSelect" open={showProviderSelect} />
    </div>
  );

  // The control pill's talking cell. Wide: the bubble itself, inline. Narrow:
  // the character, which opens the bubble as an overlay (the old Ask cell).
  const bubbleCell = !onInteractSubmit ? undefined : wide ? (
    <div
      ref={selectRef}
      className="flex items-center gap-1.5 px-2"
      onMouseLeave={() => setShowProviderSelect(false)}
    >
      {providerSelect}
      <InteractBubble
        inline
        onSubmit={handleInteractSubmitInternal}
        isThinking={isInteractThinking}
        onRobotClick={handleRobotClick}
        // Held, not hovered: passing the pointer over the character on the way
        // somewhere else opened the model list every time.
        onRobotLongPress={() => setShowProviderSelect(true)}
        hasUnreadReply={hasUnreadReply}
      />
    </div>
  ) : (
    <Tooltip label="Speak to Agent" below={!isBottom}>
      <button
        ref={robotBtnRef}
        onPointerDown={cellTick}
        onClick={handleRobotClick}
        aria-label="Speak to Agent"
        className={classNames(
          'relative flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-2 h-full transition-colors duration-150 focus:outline-none',
          showBubbleOnMobile
            ? 'bg-blue-600/90 text-white hover:brightness-110'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
      >
        {myCharacter ? <CursorManIcon size={22} /> : <Bot className="h-5 w-5 sm:h-6 sm:w-6" />}
        <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">Ask</span>
        {hasUnreadReply && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
        )}
      </button>
    </Tooltip>
  );

  return (
    <>
    <header
      ref={headerRef}
      className={classNames(
        "bg-slate-100 dark:bg-gray-900 px-3 sm:px-6 py-2 sm:py-4 fixed left-0 right-0 z-[9001]",
        // Framed by an app: not drawn, and so 0 tall — --header-height with it.
        nativeHost && "hidden",
        isBottom ? "bottom-0 border-t border-gray-200 dark:border-gray-700" : "border-b border-gray-200 dark:border-gray-700",
      )}
      style={isBottom ? {} : { top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-4 min-h-[44px] sm:min-h-0">
        {/* Never squeezed: on a phone the row is tight, and a squeezed left group
            let the control pill spill over the right-hand cells — onto the mode
            lamp, which vanished under it. The right-hand row gives instead
            (below), clipping at its far end. */}
        <div className="flex items-center space-x-2 flex-shrink-0 self-stretch" ref={menuRef}>
          {/* Hamburger menu button — opens on hover */}
          <div className="relative self-stretch -my-2 sm:-my-4" onMouseEnter={handleMenuMouseEnter} onMouseLeave={handleMenuMouseLeave}>
            <button
              onClick={() => menuOpen ? closeMenu() : openMenu()}
              className={classNames(
                "relative flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none min-w-[56px] sm:min-w-[64px]",
                menuOpen
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                onHamburgerSlot && 'ring-2 ring-inset ring-sky-400'
              )}
              aria-label="Toggle menu"
              onPointerDown={cellTick}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              data-robot-target="nav_menu"
            >
              {menuOpen ? (
                <X className="h-6 w-6 sm:h-8 sm:w-8" />
              ) : (
                <Menu className="h-6 w-6 sm:h-8 sm:w-8" />
              )}
              <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">
                {menuOpen ? 'Close' : 'Menu'}
              </span>
              {/* Something inside the menu wants attention. Hidden while the
                  menu is open — the entry's own dot is on screen by then.
                  In the viewer's character colour, not a flat red: this is the
                  same "this is for you" signal the want-tile alert badge now
                  carries, and it should read as the same thing. */}
              {anyNavBadge && !menuOpen && (
                <NavDot color={attentionColor} className="absolute top-1.5 right-2 sm:top-2 sm:right-3" />
              )}
            </button>

            {/* Dropdown menu — drawn into the body, on top of everything.
                Inside the header it could only ever be as high as the page
                layout it sits in (Layout is `isolate`), so anything the app
                draws beside the layout — the speech column, most of all — went
                over it however high its own z was. Placed by measuring the
                hamburger instead, as the create menu is. */}
            {menuReveal.mounted && menuAt && createPortal(
              <div
                style={{
                  ...anchoredRevealStyle(menuReveal, isBottom ? 'left bottom' : 'left top'),
                  left: menuAt.left,
                  ...(isBottom ? { bottom: menuAt.bottom } : { top: menuAt.top }),
                }}
                className={classNames(
                  // Three cards across needs more room than the old single
                  // column did, but never more than the screen has — on a phone
                  // the menu is pinned to the viewport and the cards absorb the
                  // difference by shrinking their labels.
                  // Above the robot cursor (99999), the highest thing drawn.
                  "fixed w-[min(24rem,calc(100vw-1rem))] z-[100000]",
                  isBottom ? "pb-2" : "pt-2"
                )}
                role="menu"
                onMouseEnter={handleMenuMouseEnter}
                onMouseLeave={handleMenuMouseLeave}
              >
                {/* Transparent bridge to prevent mouseleave when moving to menu */}
                <div className="absolute inset-x-0 h-2 bg-transparent" style={isBottom ? { bottom: 0 } : { top: 0 }} />

                <div
                  className="bg-slate-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-y-auto overscroll-contain"
                  style={{
                    // Use dynamic viewport height (mobile Safari's URL bar shrinks
                    // the real area vs 100vh) minus the header row and both safe
                    // insets, so the menu always fits and scrolls instead of
                    // clipping its top items.
                    maxHeight:
                      'calc(100dvh - 4rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
                  }}
                >
                  {/* Main items */}
                  <nav
                    className="p-2 grid gap-1.5"
                    aria-label="Main navigation"
                    style={{ ...navGridStyle, '--fit-min': navFit.min, '--fit-max': navFit.max } as React.CSSProperties}
                  >
                    {navEntries().filter(e => MAIN_IDS.has(e.id)).map((entry) => {
                      const globalIdx = navEntries().findIndex(e => e.id === entry.id);
                      return (
                        <NavCard
                          key={entry.id}
                          icon={entry.icon}
                          label={entry.label}
                          color={entry.color}
                          to={entry.href!}
                          onClick={chooseEntry}
                          active={location.pathname === entry.href}
                          focused={focusedIdx === globalIdx}
                          badge={(navBadges[entry.id] ?? 0) > 0}
                          onMouseEnter={() => setFocusedIdx(globalIdx)}
                          menuIdx={globalIdx}
                        />
                      );
                    })}
                  </nav>

                  {/* Advanced items */}
                  <div
                    className="border-t border-gray-200 dark:border-gray-800 p-2"
                    style={{ '--fit-min': navFit.min, '--fit-max': navFit.max } as React.CSSProperties}
                  >
                    <p className="px-1 pb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">Advanced</p>
                    <div className="grid gap-1.5" style={navGridStyle}>
                      {navEntries().filter(e => !MAIN_IDS.has(e.id)).map((entry) => {
                        const globalIdx = navEntries().findIndex(e => e.id === entry.id);
                        // href === null means the entry opens a modal rather
                        // than navigating; NavCard renders those as buttons.
                        const isModal = entry.href === null;
                        return (
                          <NavCard
                            key={entry.id}
                            icon={entry.icon}
                            label={entry.label}
                            color={entry.color}
                            to={entry.href ?? undefined}
                            onClick={() => {
                              if (entry.id === 'settings') setIsSettingsOpen(true);
                              else if (entry.id === 'help') setIsHelpOpen(true);
                              chooseEntry();
                            }}
                            active={!isModal && location.pathname === entry.href}
                            focused={focusedIdx === globalIdx}
                            badge={(navBadges[entry.id] ?? 0) > 0}
                            onMouseEnter={() => setFocusedIdx(globalIdx)}
                            menuIdx={globalIdx}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )}
          </div>

          {/* Global control — the same pill every tab carries (the extension
              and the bookmarklet draw it in this spot on other sites). */}
          <GlobalControlPill
            isBottom={isBottom}
            attention={anyNavBadge}
            attentionColor={attentionColor}
            onBell={() => { if (!menuOpen) openMenu(); }}
            onPointerDown={cellTick}
            compact={compact}
            bubble={bubbleCell}
            focusedCell={isHeaderFocused ? hBtns[headerFocusIdx]?.id : undefined}
            board={showZModeLamp}
          />

          <h1 className="hidden xs:block xs:text-[10.5px] sm:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">{title}</h1>
          {itemLabel && (
            <div className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {itemCount} {itemLabel}{itemCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* InteractBubble on a narrow screen: an overlay along the header,
            opened from the character in the control pill. On a wide one it
            lives in the pill itself — see bubbleCell. */}
        {onInteractSubmit && !wide && showBubbleOnMobile && (
          <div className={classNames(
            "flex items-center justify-center gap-2 absolute inset-x-0 bg-white dark:bg-gray-900 p-4 border-gray-200 dark:border-gray-700 shadow-lg z-50 animate-slide-in",
            isBottom ? "bottom-full mb-px border-t" : "top-full border-b"
          )} ref={selectRef}>
            {providerSelect}
            <InteractBubble
              onSubmit={handleInteractSubmitInternal}
              isThinking={isInteractThinking}
              onRobotClick={handleRobotClick}
              autoFocus
              hasUnreadReply={hasUnreadReply}
            />
          </div>
        )}

        {/* Right: full-height flush button grid */}
        <div className="flex items-stretch self-stretch -my-2 sm:-my-4 min-w-0 overflow-hidden">

          {/* Minimap - mobile only */}
          {onMinimapToggle && (
            <Tooltip label={showMinimap ? 'Hide Minimap' : 'Minimap'}>
              <button
                onClick={onMinimapToggle}
                className={classNames(
                  'lg:hidden flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none',
                  showMinimap
                    ? 'bg-blue-500/90 text-white hover:brightness-110'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <Map className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">Map</span>
              </button>
            </Tooltip>
          )}

          {/* Global */}
          {onGlobalStateToggle && (
            <Tooltip label={showGlobalState ? 'Global ON' : 'Global'} shortcut="g" below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'global'}>
              <button
                onClick={onGlobalStateToggle}
                data-header-btn-id="global"
                onPointerDown={cellTick}
                className={classNames(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none',
                  showGlobalState
                    ? 'bg-green-600/90 text-white hover:brightness-110'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                  isHeaderFocused && hBtns[headerFocusIdx]?.id === 'global' && 'ring-2 ring-inset ring-sky-400'
                )}
              >
                <Globe className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">Global</span>
              </button>
            </Tooltip>
          )}

          {/* Import */}
          {onImport && (
            <Tooltip label="Import YAML" below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'import'}>
              <button
                onClick={onImport}
                disabled={isImporting}
                data-header-btn-id="import"
                onPointerDown={cellTick}
                className={classNames(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none',
                  'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50',
                  isHeaderFocused && hBtns[headerFocusIdx]?.id === 'import' && 'ring-2 ring-inset ring-sky-400'
                )}
              >
                <Upload className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">
                  {isImporting ? 'Importing' : 'Import'}
                </span>
              </button>
            </Tooltip>
          )}

          {/* Select */}
          {onToggleSelectMode && (
            <Tooltip label={showSelectMode ? 'Exit Select' : 'Select'} shortcut="⇧S" below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'select'}>
              <button
                onClick={onToggleSelectMode}
                data-header-btn-id="select"
                onPointerDown={cellTick}
                className={classNames(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none',
                  showSelectMode
                    ? 'bg-blue-600/90 text-white hover:brightness-110'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
                  isHeaderFocused && hBtns[headerFocusIdx]?.id === 'select' && 'ring-2 ring-inset ring-sky-400'
                )}
              >
                <ListChecks className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">Select</span>
              </button>
            </Tooltip>
          )}


          {/* The page's own button (pageAction). */}
          {pageAction && (
            <Tooltip label={pageAction.tooltip ?? pageAction.label} below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'page'}>
              <button
                onClick={pageAction.onClick}
                data-header-btn-id="page"
                onPointerDown={cellTick}
                className={classNames(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none',
                  pageAction.active
                    ? 'bg-blue-600/90 text-white hover:brightness-110'
                    : (pageAction.toneClass ?? 'text-gray-600 dark:text-gray-400') + ' hover:bg-gray-100 dark:hover:bg-gray-800',
                  isHeaderFocused && hBtns[headerFocusIdx]?.id === 'page' && 'ring-2 ring-inset ring-sky-400'
                )}
              >
                <pageAction.icon className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">{pageAction.label}</span>
              </button>
            </Tooltip>
          )}

          {/* Add Note has no button. The row carried three create buttons side
              by side and a note is not a third kind of thing — it is a want of
              type `note`, so Add Want makes one like it makes any other. What
              came off is the shortcut, not the capability. */}
          {/* Add Want and Add Thing, framed as one segmented control: one
              choice with two answers, and only one lit at a time (see
              createWant / createThing). Want first, as in the walk order. */}
          {!compact && !hideCreateButton && (
          <div className="flex h-full items-stretch rounded-xl overflow-hidden ring-1 ring-inset ring-gray-300 dark:ring-gray-700 mx-1">
          {/* Create — separated by a thin line. Labelled "Add Want" unless the
              page creates something else (createButtonLabel/createButtonIcon). */}
          {!compact && !hideCreateButton && (
            <>
              <Tooltip label={isAddWantActive ? `Close ${createButtonLabel}` : createButtonLabel} shortcut="a" below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'want'}>
                <button
                  onClick={createWant}
                  data-header-btn-id="want"
                onPointerDown={cellTick}
                  data-robot-target="add_want_btn"
                  className={classNames(
                    "flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none",
                    // Adding a want is in the app's own pink — the heart of the
                    // tab icon (public/favicon.svg) — lit and unlit, the way Add
                    // Thing is in the thing's orange. Pages that reuse this
                    // button for something else keep the neutral look.
                    createsWant
                      ? (isAddWantActive
                        ? "bg-pink-500 text-white hover:brightness-110 active:opacity-80"
                        : "text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20")
                      : isAddWantActive
                        ? "bg-primary-600 text-white hover:brightness-110 active:opacity-80"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                    isHeaderFocused && hBtns[headerFocusIdx]?.id === 'want' && 'ring-2 ring-inset ring-sky-400'
                  )}
                >
                  <span className="relative inline-flex flex-shrink-0">
                    <CreateIcon className="h-6 w-6 sm:h-8 sm:w-8" />
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2" style={{ strokeWidth: 3 }} />
                  </span>
                  <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">{createButtonLabel.replace(/^(Add|New)\s+/i, '')}</span>
                </button>
              </Tooltip>
            </>
          )}
          {/* Add Thing — in the thing's own amber-orange, and carrying the same
              circle every remembered value wears, so the button looks like what
              it makes. */}
          {!compact && !hideCreateButton && onCreateThing && (
            <>
              <Tooltip label={isAddThingActive ? 'Close Add Thing' : 'Add Thing'} shortcut="t" below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'thing'}>
                <button
                  onClick={createThing}
                  data-header-btn-id="thing"
                onPointerDown={cellTick}
                  data-robot-target="add_thing_btn"
                  className={classNames(
                    "flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none",
                    // Lit while its panel is open, the way Add Want is. The two
                    // buttons do the same kind of thing — open a panel that the
                    // same press closes again — and a button that shows that
                    // beside one that does not reads as two different gestures.
                    // In the thing's own orange rather than the primary, because
                    // the unlit state is orange too and a button should not
                    // change what it is about by being pressed.
                    isAddThingActive
                      ? "bg-orange-500 text-white hover:brightness-110 active:opacity-80"
                      : "text-orange-500 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20",
                    isHeaderFocused && hBtns[headerFocusIdx]?.id === 'thing' && 'ring-2 ring-inset ring-sky-400'
                  )}
                >
                  <span className="relative inline-flex flex-shrink-0">
                    <Circle className="h-6 w-6 sm:h-8 sm:w-8" />
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2" style={{ strokeWidth: 3 }} />
                  </span>
                  <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">Thing</span>
                </button>
              </Tooltip>
            </>
          )}
          </div>
          )}
          {/* One cell for both ways of making something, where the row has no
              space for two.

              Grouped rather than hidden. Add Thing and Add Want are one act
              with two answers, which is what a menu is for; the other cells are
              each a different act, and pushing an arbitrary few of them behind
              a "…" would only decide for the player which ones stop being
              used. */}
          {compact && !hideCreateButton && (
            <>
              <div className="relative h-full">
                <button
                  ref={createBtnRef}
                  onPointerDown={cellTick}
                  onClick={() => setCreateMenuOpen(v => !v)}
                  data-header-btn-id="create"
                  data-robot-target="create_menu_btn"
                  aria-label="New"
                  aria-expanded={createMenuOpen}
                  className={classNames(
                    "flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none",
                    createMenuOpen
                      ? "bg-primary-600 text-white hover:brightness-110"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                    isHeaderFocused && hBtns[headerFocusIdx]?.id === 'create' && 'ring-2 ring-inset ring-sky-400'
                  )}
                >
                  <Plus className="h-7 w-7" style={{ strokeWidth: 2.5 }} />
                </button>
                {createReveal.mounted && createAt && createPortal(
                  <div
                    ref={createMenuRef}
                    className="fixed z-[9100] min-w-[168px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
                    // Opens away from the edge the header is docked to, so it
                    // unfolds over the board rather than off the screen — and
                    // travels out of the ＋ on the way, so what opened it is
                    // never in doubt.
                    style={{
                      ...(isBottom
                        ? { right: createAt.right, bottom: createAt.bottom + 8 }
                        : { right: createAt.right, top: createAt.top + 8 }),
                      ...anchoredRevealStyle(createReveal, isBottom ? 'right bottom' : 'right top'),
                    }}
                  >
                    {([
                      ['want',  createButtonLabel, CreateIcon,  createsWant ? 'text-pink-500' : 'text-primary-600 dark:text-primary-400', createWant],
                      ['thing', 'Add Thing',       Circle,      'text-orange-500 dark:text-orange-400',   onCreateThing ? createThing : undefined],
                    ] as const).map(([id, label, Icon, tone, action]) => action ? (
                      <button
                        key={id}
                        data-header-btn-id={id}
                        onClick={() => { setCreateMenuOpen(false); (action as () => void)(); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Icon className={classNames('h-5 w-5 flex-shrink-0', tone)} />
                        <span className="whitespace-nowrap">{label}</span>
                      </button>
                    ) : null)}
                  </div>,
                  document.body,
                )}
              </div>
            </>
          )}
          {/* The on-screen pad — last, so it holds the right-hand end of the
              row. Lit while the pad is out, the way Add Want is lit while its
              form is open: the button and the thing it opened say the same. */}
          {onPadToggle && (
            <>
              <Tooltip label={showPad ? 'Hide Pad' : 'Show Pad'} below={!isBottom} forceVisible={isHeaderFocused && hBtns[headerFocusIdx]?.id === 'pad'}>
                <button
                  onClick={() => onPadToggle()}
                  data-header-btn-id="pad"
                onPointerDown={cellTick}
                  data-robot-target="pad_btn"
                  aria-pressed={showPad}
                  className={classNames(
                    "flex flex-col items-center justify-center gap-0.5 min-w-[40px] sm:min-w-[52px] px-1 sm:px-3 h-full transition-all duration-150 focus:outline-none",
                    showPad
                      ? "bg-primary-600 text-white hover:brightness-110 active:opacity-80"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                    isHeaderFocused && hBtns[headerFocusIdx]?.id === 'pad' && 'ring-2 ring-inset ring-sky-400'
                  )}
                >
                  <Gamepad2 className="h-6 w-6 sm:h-8 sm:w-8" />
                  <span className="text-[9px] font-bold leading-none uppercase tracking-tighter hidden sm:block">Pad</span>
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
      {isBottom && <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />}
    </header>
    <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};
