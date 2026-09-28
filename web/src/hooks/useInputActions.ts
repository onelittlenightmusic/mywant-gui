import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { isAnyCardInnerFocused } from '@/stores/cardInnerFocusStore';
import { heldModeAnswers, CANVAS_ACTIONS } from '@/stores/canvasActorStack';
import { getControllerState } from '@/lib/controllerHub';
import { record as recordInput } from '@/utils/inputTap';

// ─── Public types ─────────────────────────────────────────────────────────────

export type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'home' | 'end';

export interface UseInputActionsOptions {
  /** Called when a directional navigation input is received */
  onNavigate?: (direction: NavigationDirection) => void;
  /**
   * Called on Enter key or Gamepad A button (index 0), fired on release like
   * Enter always has been. Plain Space is NOT grouped with Enter — see
   * onCancel, which Space is grouped with instead.
   */
  onConfirm?: () => void;
  /**
   * Called when Enter/Gamepad A is pressed twice within 300 ms.
   * On the second (double) press, this fires instead of onConfirm.
   * First press always fires onConfirm normally.
   * Intended for expand / maximize on double-tap.
   */
  onDoubleConfirm?: () => void;
  /** Called on Escape key, plain Space (no modifiers), or Gamepad B button
   * (index 1) — Space is treated as equivalent to Escape/Cancel, not Enter/
   * Confirm. Fires on RELEASE for a short press (keyboard has always worked
   * this way; gamepad B used to fire instantly on press, but that made a
   * long-press gesture on the same button impossible to detect reliably —
   * see onCancelLong). Long-press fires onCancelLong instead of this. */
  onCancel?: (press?: { pressedOn: HTMLElement | null }) => void;
  /**
   * Called after Escape/Space/Gamepad B is held for ~500ms (long-press).
   * Layered on top of onCancel rather than replacing it: a short press still
   * fires onCancel as always; a long press fires this instead, then
   * onCancelLongRelease on release (onCancel does NOT also fire for that
   * same press). Intended for a "hold cancel to enter a mode" interaction,
   * e.g. the canvas rotation/length guide.
   */
  onCancelLong?: () => void;
  /** Called when Escape/Space/Gamepad B is released after a long-press (onCancelLong already fired). */
  onCancelLongRelease?: () => void;
  /**
   * Called on Gamepad X button (index 2) press. Keyboard has no key bound
   * to this — x/X is onButtonX — so this is reachable via gamepad only, for
   * a want type or feature that specifically wants the "toggle" trigger key
   * (e.g. a want's input_button param set to "toggle").
   */
  onToggle?: () => void;
  /** Called when Gamepad X button (index 2) is released. Useful for hold-to-show overlays. */
  onToggleRelease?: () => void;
  /** Called on Alt+Enter or Gamepad Select button (index 8) */
  onMenuToggle?: () => void;
  /**
   * Called on Shift+Enter or Gamepad Start button (index 9).
   * Intended for a context-menu / right-click equivalent overlay.
   */
  onContextMenu?: () => void;
  /**
   * Called on Shift+Arrow (keyboard) or A-button held + left-stick (gamepad —
   * the stick is polled centrally and dispatches a synthesized Shift+ArrowX
   * keydown so it reaches this same handler).
   * Intended for moving/reordering the focused item within a list or canvas
   * grid, one step at a time.
   */
  onMove?: (direction: NavigationDirection) => void;
  /**
   * Called on A-button held + D-pad (real gamepad chord), or on a keyboard
   * Arrow key while _confirmHeld is set by simulateConfirmButton — used by
   * the software A button (CanvasDPad) so its own D-pad reaches the same
   * chord behavior without a bespoke keyboard binding like Cmd+Shift+Arrow.
   * Intended for warping the focused item to an edge/boundary in one press,
   * as opposed to onMove's one-step-at-a-time semantics.
   */
  onWarp?: (direction: NavigationDirection) => void;
  /** Called when A/Cross is released after a long-press (confirm-long already fired). */
  onConfirmLongRelease?: () => void;
  /**
   * Called whenever A/Cross is released, regardless of press duration or
   * whether onConfirm/onConfirmLongRelease also fired for the same release —
   * the one unconditional "A just came up" signal. Intended for committing a
   * gamepad A+stick reorder preview (see onMove) on release, mirroring a
   * keyboard Shift-keyup commit.
   */
  onConfirmReleased?: () => void;
  /**
   * Called after A/Cross is held past CONFIRM_LONG_MS (gamepad long-press).
   * Intended for entering a keyboard-driven drag mode on the canvas.
   */
  onConfirmLong?: () => void;
  /**
   * Plain single-character shortcuts, keyed by the character —
   * `{ s: start, x: stop }`, and `{ '1': …, '2': … }` for the canvas skill slot.
   *
   * The channel exists so that letter keys are arbitrated by the same rule as
   * every other key here, instead of by which component mounted first. Before
   * it, a handful of components each bound their own bubble-phase window
   * listener and settled disagreements with stopImmediatePropagation(): the
   * batch bar and the workspace shortcuts both answered `x` and both answered
   * `g`, and which one won depended on mount order. Overlay grids answered `y`
   * with no ownership check at all, on top of whatever the board had bound to
   * the Y button.
   *
   * Resolved on keydown, since a letter is an instant action rather than
   * something with a press and a release. Unmodified presses only — a letter
   * with Cmd or Alt on it is a different key with a different meaning, and
   * those callers still bind them themselves. Repeats are ignored: holding `d`
   * is one delete, not forty.
   *
   * Keys are matched case-insensitively, so a shortcut fires with CapsLock on.
   */
  shortcuts?: Record<string, () => void>;
  /**
   * Called on the `y` / `z` key or Gamepad Y button (index 3 / Triangle) press.
   * Drives the canvas jump overlay; pair with onYButtonRelease for the
   * hold-Y-then-pick-a-direction interaction, and isButtonYHeld() for callers
   * whose own action is not itself a Y press.
   */
  onYButton?: () => void;
  /**
   * Called when `y` (keyboard) or the Gamepad Y button is released.
   */
  onYButtonRelease?: () => void;
  /**
   * Called on the `z` key or the Gamepad L2/LT trigger (index 6) — Z mode's
   * button. Pair with onZButtonRelease for hold-to-aim gestures, and isZHeld()
   * for callers whose own action is not itself a Z press.
   *
   * Deliberately its own channel rather than a second spelling of Y: the Y
   * button is bound all over the app (a card grid's "follow this row", a
   * confirmation's yes), and Z mode is one board-level state. Sharing a key
   * meant the mode and the cluster it drives could disagree about whether they
   * were on.
   */
  onZButton?: () => void;
  /** Called when `z` or L2 is released. See onZButton. */
  onZButtonRelease?: () => void;
  /**
   * Called on the Command key or the Gamepad R2/RT trigger (index 7) — aim
   * mode's button. The free-direction sibling of Z mode: where Z aims along a
   * subject's connections, aim points anywhere and jumps to the nearest tile
   * that way. Pair with onAimButtonRelease, and isAimHeld() for callers whose
   * own action is not itself an aim press.
   */
  onAimButton?: () => void;
  /** Called when Command or R2 is released. See onAimButton. */
  onAimButtonRelease?: () => void;
  /**
   * Called on the `x`/`X` key or Gamepad X button (index 2 / Square) press.
   * Intended for X-specific actions distinct from onConfirm (e.g. aura
   * placement while held, rotation-guide entry) — see onButtonXRelease for
   * the matching release half of press/release interactions. Note:
   * Gamepad X button also fires onToggle for backward compatibility with
   * things that specifically want that key.
   */
  onButtonX?: () => void;
  /**
   * Called when x/X (keyboard) or Gamepad X button (index 2) is released.
   * Pairs with onButtonX for press-to-start/release-to-commit interactions
   * (e.g. the canvas rotation guide).
   */
  onButtonXRelease?: () => void;
  /**
   * Called on the Shift key (alone, no other modifiers) or Gamepad A long-press.
   * Intended for triggering recommendation/autocomplete in value input fields.
   * When onRecommend is provided, A long-press routes here instead of onConfirmLong.
   * Keyboard: fires in capture phase when input is focused; fires in bubble phase when no input is focused.
   */
  onRecommend?: () => void;
  /**
   * Called on Gamepad Y + L1/R1 — one step along the canvas skill slot, back
   * (-1) or forward (+1).
   *
   * Gamepad only, and deliberately: the keyboard equips a skill by its digit
   * through `shortcuts`, which is direct where a walk is not, and a pad has no
   * digits to offer. See pages/canvas/useCanvasSkillSlot.
   */
  onSkillCycle?: (delta: 1 | -1) => void;
  /**
   * Called when the "pick this up and carry it" gesture starts: Shift going
   * down on the keyboard, or A held past CONFIRM_LONG_MS on a gamepad or the
   * software pad.
   *
   * One action because it is one gesture. It used to be two: the board listened
   * for Shift on a window listener of its own and bound A's long press here,
   * and the two drifted apart exactly as far as you would expect — only one of
   * them knew about select mode and about things, and only one of them could be
   * reached with the detail panel open, which is when you most want to move the
   * tile you are standing on. Binding it once means the guards (a text field
   * has focus, a card owns the keys) are applied once too.
   */
  onPickUp?: () => void;
  /**
   * Called when Shift is released.
   *
   * The keyboard half only, deliberately: releasing A after a long press does
   * NOT end the carry, so a one-finger touch flow can let go of A and then work
   * the D-pad. A gamepad ends its carry with an explicit A tap or B.
   */
  onPickUpRelease?: () => void;
  /**
   * Called on Tab key or Gamepad R bumper (index 5).
   * When no callback is provided the R bumper simulates a Tab keypress
   * (moves DOM focus to the next focusable element).
   */
  onTabForward?: () => void;
  /**
   * Called on Shift+Tab or Gamepad L bumper (index 4).
   * When no callback is provided the L bumper simulates Shift+Tab
   * (moves DOM focus to the previous focusable element).
   */
  onTabBackward?: () => void;
  /**
   * Called on Option+Tab (keyboard) or B held + R Bumper (gamepad).
   * Intended for cycling forward through a second-level tab bar
   * (e.g. the Settings sub-tabs: name → params → labels → …).
   *
   * The chord mirrors the keyboard spelling: the bumpers alone are Tab, and
   * holding B makes them the modified Tab. It used to be R2, before that
   * trigger became Z mode's button.
   */
  onSubTabForward?: () => void;
  /**
   * Called on Option+Shift+Tab (keyboard) or B held + L Bumper (gamepad).
   * Intended for cycling backward through a second-level tab bar.
   */
  onSubTabBackward?: () => void;
  /**
   * Called when the bumper of a B+R Bumper chord is released. Pairs with
   * onSubTabForward for hold-to-show / release-to-confirm interactions (no
   * keyboard equivalent — only the pad has a meaningful held/released state
   * here). Fires on the BUMPER's release, not B's, so letting go of the
   * modifier first does not commit anything.
   */
  onSubTabForwardRelease?: () => void;
  /** Called when the bumper of a B+L Bumper chord is released. See onSubTabForwardRelease. */
  onSubTabBackwardRelease?: () => void;
  enabled?: boolean;
  /** Skip if an <input>/<textarea>/contentEditable is focused. Default: true */
  ignoreWhenInputFocused?: boolean;
  /** Skip if focus is inside a [data-sidebar="true"] element. Default: true */
  ignoreWhenInSidebar?: boolean;
  /**
   * When true, this handler intercepts all input before other useInputActions
   * instances (keyboard: capture phase + stopImmediatePropagation; gamepad:
   * exclusive dispatch).  Use for modal/menu navigation that must take priority
   * over page-level handlers.
   */
  captureInput?: boolean;
  /**
   * When true, only the gamepad listener is registered — keyboard events are
   * ignored entirely.  Use when a component already has its own keydown handler
   * for keyboard behaviour but still needs gamepad equivalents.
   */
  gamepadOnly?: boolean;
  /**
   * Called on Alt+ArrowLeft/Right (keyboard), right-stick X-axis (gamepad),
   * or a horizontal touch swipe (touch devices).
   *
   * Direction semantics are unified across all input devices:
   *   'right' = advance / show next  (Opt+→ key, stick right, swipe LEFT with finger)
   *   'left'  = go back / show prev  (Opt+← key, stick left,  swipe RIGHT with finger)
   *
   * Note: touch swipe direction is intentionally inverted from the gesture direction
   * so that it matches keyboard/gamepad convention (swiping left in a carousel
   * reveals the next item, same as pressing the right arrow key).
   */
  onSwipeNavigate?: (direction: 'left' | 'right') => void;
  /**
   * Called on Cmd+Shift+Option+ArrowLeft/Right (keyboard). Reserved chord for
   * hopping the roaming CursorMan to an adjacent browser tab from the mywant-gui
   * tab (see CursorTabHopController) — routed through this common handler so it
   * takes priority over onSwipeNavigate's plainer Alt+Arrow and can't be
   * pre-empted by a component's own ad-hoc listener. The gamepad reaches the
   * same feature through B+L1/R1 via onSubTabForward/Backward, so there's no
   * gamepad equivalent here.
   */
  onCursorTabHop?: (direction: 'left' | 'right') => void;
  /**
   * When true, the touch-swipe listener is suppressed even when onSwipeNavigate
   * is provided.  Use on components that already have their own element-level
   * touch handlers (e.g. RecipeSlideDeck) to avoid double-firing.
   */
  disableTouchSwipe?: boolean;
  /**
   * When true, this handler exclusively owns keyboard Tab / Shift+Tab.
   * A capture-phase window listener fires with e.preventDefault() so the
   * browser does not also move focus.  While this hook is enabled, the
   * form-level captureInput handler will NOT call onTabForward/Backward for
   * keyboard Tab — only gamepad L/R bumpers reach the form-level handler.
   * Use on focused elements that need custom Tab order (section headers,
   * Advanced button, Name input) instead of direct e.key==='Tab' detection,
   * so that gamepad L/R bumpers route through the same onTabForward/Backward
   * callbacks.
   */
  captureTab?: boolean;
  /**
   * Ties this instance's capture claim to real DOM focus.
   *
   * Return the element this widget considers "focused" (usually
   * `() => someRef.current`). While it holds the exclusive slot, every dispatch
   * re-checks that document.activeElement is still inside it; if focus has
   * moved on, the claim is treated as released and the action goes to whoever
   * the user is actually on. This keeps "what looks focused" and "what receives
   * input" from diverging, which they otherwise do whenever a widget's own
   * blur bookkeeping lags a frame behind the DOM.
   *
   * Only for claims that MEAN "this thing is focused". Leave it unset when the
   * claim means "this mode is active" — a modal, a canvas drag, a rotation
   * guide legitimately own input while nothing inside them has DOM focus, and
   * scoping those would silently drop their input.
   */
  focusScope?: () => HTMLElement | null;
}

export interface UseInputActionsHandle {
  /**
   * Whether x/X (keyboard) or the gamepad X/Square button is currently
   * held, tracked from real press/release (not the browser's native
   * keydown auto-repeat, which most OSes suppress for a held key as soon
   * as a second key — e.g. an arrow key — is also held). Useful for gating
   * a per-step action reported from elsewhere (e.g. a movement callback)
   * on "is x currently held," without that caller needing its own
   * press/release tracking.
   */
  isButtonXHeld: () => boolean;
  /** Same, for the y key or Gamepad Y button. */
  isButtonYHeld: () => boolean;
}

// ─── Gamepad singleton ────────────────────────────────────────────────────────

type GamepadActionType =
  | NavigationDirection
  | 'warp-up' | 'warp-down' | 'warp-left' | 'warp-right'
  | 'confirm'
  | 'cancel'
  | 'toggle'
  | 'toggle-release'
  | 'menu-toggle'
  | 'context-menu'
  | 'tab-forward'
  | 'tab-backward'
  | 'z-button'
  | 'z-button-release'
  | 'aim-button'
  | 'aim-button-release'
  | 'sub-tab-forward'
  | 'sub-tab-backward'
  | 'sub-tab-forward-release'
  | 'sub-tab-backward-release'
  | 'y-button'
  | 'y-button-release'
  | 'button-x'
  | 'button-x-release'
  | 'confirm-long'
  | 'confirm-long-release'
  | 'confirm-released'
  | 'cancel-long'
  | 'cancel-long-release'
  | 'recommend'
  | 'skill-next' | 'skill-prev'
  | 'swipe-left' | 'swipe-right';

type GamepadActionListener = (action: GamepadActionType) => void;

// Repeat timing constants (ms) – mimics OS key-repeat behaviour
const INITIAL_REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 60;
/**
 * How long A/Cross has to be down to be a hold rather than a press.
 *
 * Halved from 500ms. Every gesture built on it — picking a tile up and
 * carrying it, the A+D-pad warp chord — began with a wait long enough to feel
 * like the button had not registered, and a threshold you notice waiting out
 * is too long by definition. 250ms is still comfortably above a deliberate
 * tap, which is what it has to clear: the short press fires on RELEASE, so
 * anything under this is unaffected.
 */
const CONFIRM_LONG_MS = 250;

/**
 * The same question for B/Circle and Escape, and deliberately a different
 * answer.
 *
 * These shared A's number until A's was halved, which would have taken B's
 * with it. B's hold is not the same kind of gesture: A's opens something you
 * are about to do (pick this up, warp from here) and wants to be quick, while
 * B's leaves the thing you were doing for a mode — the rotation guide — and a
 * hold you can fall into by pausing on a cancel is worse than one you have to
 * mean. Kept where it was rather than tuned; nobody has complained about it.
 */
const CANCEL_LONG_MS = 500;
const AXIS_DEADZONE = 0.5;


// Standard Gamepad API button indices.
// Button 0 (A/Cross) is intentionally excluded — it is handled with deferred-confirm
// logic below so that short-press fires 'confirm' on RELEASE and long-press (≥ CONFIRM_LONG_MS)
// fires 'confirm-long' without ever emitting 'confirm'.  This prevents the immediate
// confirm from side-effecting (e.g. deselecting a want) before D-pad warp chords work.
// Button 1 (B/Circle) is excluded for the same reason — see simulateCancelButton:
// firing 'cancel' immediately on press (as this map used to) cleared the
// selection before a long-press's threshold could ever be reached, so a
// hold-B-to-enter-rotation-guide gesture never saw a still-selected want by
// the time it fired.
// What the triggers used to be — the second level of tab navigation — moved
// onto the bumpers as a chord: B held + L1/R1, see the tab-backward/forward
// branch in _processGamepad. The triggers now hold the board's two aiming
// modes instead: L2 is Z mode (jump along a connection), R2 is aim mode (jump
// in a direction). One under each index finger, and neither of them a button
// that means something else elsewhere in the app.
const BUTTON_MAP: Readonly<Record<number, GamepadActionType>> = {
  2: 'toggle',        // X / Square
  3: 'y-button',      // Y / Triangle
  4: 'tab-backward',      // L Bumper (LB / L1) — 'sub-tab-backward' with B held
  5: 'tab-forward',       // R Bumper (RB / R1) — 'sub-tab-forward'  with B held
  6: 'z-button',          // L2 / LT (Left Trigger)  — Z mode
  7: 'aim-button',        // R2 / RT (Right Trigger) — aim mode
  8: 'menu-toggle',       // Select / Back / View / Share
  9: 'context-menu',  // Start / Options / Menu
  12: 'up',           // D-pad Up
  13: 'down',         // D-pad Down
  14: 'left',         // D-pad Left
  15: 'right',        // D-pad Right
};

const NAV_ACTIONS = new Set<GamepadActionType>(['up', 'down', 'left', 'right']);

interface TrackState {
  pressed: boolean;
  repeatTimeout: ReturnType<typeof setTimeout> | null;
  repeatInterval: ReturnType<typeof setInterval> | null;
  /**
   * What this button actually emitted when it went down, when that is not
   * simply its BUTTON_MAP entry — a bumper pressed with B held emits a
   * sub-tab action instead. Kept so the release matches the press even if the
   * modifier was let go in between.
   */
  action?: GamepadActionType;
}

// Module-level singleton — only one RAF loop runs regardless of how many hook
// instances are active.
const _listeners = new Set<GamepadActionListener>();
/**
 * Who has been handed the input, innermost first.
 *
 * A stack, not a slot. Exclusivity has always been "whoever claimed last wins",
 * which is right while they are both there and wrong the moment the inner one
 * leaves: a card's editor claims over its grid, and when the editor closes the
 * single slot was set back to EMPTY rather than to the grid underneath it. The
 * grid is still mounted, still enabled, still the thing the ring is drawn on —
 * and it had stopped receiving anything, because a claim is only made in the
 * effect that runs when a hook mounts or its options change, and neither had
 * happened. Leaving an enum editor left the whole card grid deaf: no arrows, no
 * X, no Y, until something re-rendered it into claiming again.
 *
 * With a stack, releasing a claim uncovers the one under it, which is the only
 * answer that matches what the user sees: they left the editor, so the card
 * they left it from is where they are.
 */
interface CaptureClaim {
  token: object;
  listener: GamepadActionListener;
  /** Focus-derived claims name their element; mode-derived ones pass null. */
  scope: (() => HTMLElement | null) | null;
}
let _captureStack: CaptureClaim[] = [];

/** Claim the input. A second claim by the same instance replaces its first. */
function _pushCapture(claim: CaptureClaim): void {
  _captureStack = _captureStack.filter(c => c.token !== claim.token);
  _captureStack.push(claim);
}

/** Let go, from wherever in the stack this instance sits. */
function _popCapture(token: object): void {
  _captureStack = _captureStack.filter(c => c.token !== token);
}

/**
 * The claim input is actually going to right now, or null when it is free.
 *
 * A focus-derived claim is stale the moment focus leaves its element: the
 * widget's own `enabled` flag has not caught up yet (it depends on a blur it may
 * have missed, or on a React state update that has not committed). Acting on a
 * stale claim is how input ends up going somewhere other than where the focus
 * ring is drawn — so stale claims are skipped and the next one down is asked.
 *
 * Among the live ones, the innermost wins: a claim whose element is inside
 * another's is the more specific answer to "where are the keys", and both are
 * live at once whenever a widget claims inside a grid that also claims. Ties —
 * and mode-derived claims, which name no element — fall back to who claimed
 * last, which is the rule this whole mechanism started as.
 */
function _liveClaim(): CaptureClaim | null {
  const live: Array<{ c: CaptureClaim; el: HTMLElement | null }> = [];
  for (const c of _captureStack) {
    if (c.scope === null) { live.push({ c, el: null }); continue; }
    const el = c.scope();
    if (el && el.contains(document.activeElement)) live.push({ c, el });
  }
  if (live.length === 0) return null;
  let best = live[live.length - 1];          // last claimed, the old rule
  for (let i = live.length - 1; i >= 0; i--) {
    const cand = live[i];
    if (!cand.el) continue;                   // a mode claim is not "deeper"
    // Deeper than the current best: contained by it, or the first scoped one.
    if (!best.el || (best.el !== cand.el && best.el.contains(cand.el))) best = cand;
  }
  return best.c;
}

/**
 * Is the input currently handed to somebody?
 *
 * For the surfaces that sit AROUND a claimant and must not answer its presses.
 * The panel frame is the case this was written for: it binds Escape with the
 * sidebar guard deliberately off (otherwise it would never hear the key that
 * hands its own focus back), so a card grid's editor inside it and the frame
 * around it both used to act on one press — the editor stepped back out and the
 * frame handed the keys to the board in the same beat, and the ring ended up on
 * the canvas. Whoever holds the claim answers first; anything outside it waits
 * for the claim to be released.
 */
export function isInputCaptured(): boolean {
  return _liveClaim() !== null;
}

/**
 * Who this key event belongs to, decided once, at the moment it arrives.
 *
 * The gamepad has always had exactly one answer to "who gets this press": the
 * live claim, or everybody (see _emit). The keyboard had N answers — one
 * listener per hook, each re-asking as it ran — and they disagreed, because a
 * listener earlier in the chain can move focus and the claim is read off focus.
 * That is how one Escape came to mean two things: a card editor's own handler
 * closed it on the way down, and by the time the grid's listener asked, the
 * focus it would have recognised as "inside my editor" was already its own.
 *
 * So the question is asked once per event, by a capture-phase listener that
 * runs before any of them, and cached against the event object. Both devices
 * route by the same rule, from the same fact.
 */
const _keyOwnerCache = new WeakMap<Event, CaptureClaim | null>();
function _keyOwner(e: Event): CaptureClaim | null {
  const cached = _keyOwnerCache.get(e);
  if (cached !== undefined) return cached;
  const claim = _liveClaim();
  _keyOwnerCache.set(e, claim);
  return claim;
}

/**
 * Which keys are currently down inside a text field.
 *
 * The companion to _keyOwner, for the other question asked about every press:
 * "was this typed into something?". Enter and Escape are resolved on KEYUP —
 * deliberately, so their timing matches the gamepad buttons they stand in for —
 * but the field test was made against the keyup's own target, and by then the
 * field can be gone. Anything that closes itself on Enter's keydown (the
 * constellation name prompt, and every other type-a-name-and-submit affordance)
 * unmounts its input in that first half of the press; the keyup then arrives at
 * <body>, no guard sees a text field, and the board resolves an Enter that was
 * never for it — which is how confirming a constellation's name handed the keys
 * straight to the detail panel of whatever the character was standing on.
 *
 * Deciding it at keydown is the same rule _keyOwner already follows and for the
 * same stated reason: ask before anything downstream can blur or unmount what
 * the press landed on. A press belongs to the surface it STARTED on for its
 * whole length, release included.
 */
const _keydownInTextField = new Set<string>();

/** Did this key's press begin inside a text field? See _keydownInTextField. */
function _pressStartedInTextField(key: string): boolean {
  return _keydownInTextField.has(key);
}

// Asked as early as an event can be seen: before the target's own handlers,
// before React's delegated ones, before anything can blur or unmount what the
// press landed on. One listener for the whole app, installed with the module.
if (typeof window !== 'undefined') {
  const _primeKeyOwner = (e: KeyboardEvent) => {
    const owner = _keyOwner(e);
    // The one place every key passes through before anything can act on it, so
    // the one place worth recording from. See utils/inputTap.
    recordInput(e.type, e.key, [
      (e.target as HTMLElement | null)?.tagName ?? '?',
      owner ? (owner.scope ? 'claim:widget' : 'claim:mode') : 'claim:none',
      e.repeat ? 'repeat' : '',
    ].filter(Boolean).join(' '));
    // Recorded on keydown only, and never cleared on keyup: every consumer of
    // this fact reads it DURING the keyup, from a bubble-phase listener that
    // has not run yet when this capture-phase one does. The next press of the
    // same key overwrites it, and a press that started outside a field deletes
    // it, so nothing goes stale in a way that outlives one press.
    if (e.type !== 'keydown') return;
    if (_isTextEditableTarget(e.target)) _keydownInTextField.add(e.key);
    else _keydownInTextField.delete(e.key);
  };
  window.addEventListener('keydown', _primeKeyOwner, true);
  window.addEventListener('keyup', _primeKeyOwner, true);
  // A key held while the WINDOW loses focus never delivers its keyup here.
  // Deliberately NOT in the capture phase: blur does not bubble, so a capturing
  // window listener is the one thing that hears every element's blur as well —
  // including the field unmounting itself in the middle of the very press this
  // set exists to remember. That is not a hypothetical: it is what made the
  // first version of this fix do nothing at all.
  window.addEventListener('blur', () => { _keydownInTextField.clear(); });
}

/**
 * The board's two aiming modes, as held state.
 *
 * Z mode (z key / L2) aims along what the character is standing on — its
 * connections — and aim mode (c key / R2) aims anywhere, jumping to the nearest
 * tile that way. Both are the same shape: a button you hold, a lamp that says
 * so, and a drag or a stick that means "aim" instead of "walk" for as long as
 * it is down. So they are one implementation, made twice, rather than two
 * copies of it — the second copy is exactly where the first one's fixes stop
 * being applied.
 *
 * Deliberately not the Y button, which either of them could have been: Y is
 * bound all over the app (a card grid's "follow this row", a confirmation's
 * yes), and while a mode shared it, the mode and the overlay it drives could
 * disagree about whether they were on.
 *
 * A per-instance ref (set on keydown, cleared on keyup inside each hook's own
 * handleKeyUp) used to track Z, and it desynced the moment two instances cared
 * about the same press: CanvasYJumpOverlay opens with `captureInput: open`, so
 * while its cluster is open its keyup listener runs in the DOM's capture phase
 * and calls stopImmediatePropagation() to consume the release — which, because
 * capture finishes before bubble, silently prevented every bubble-phase
 * instance's own bookkeeping from ever seeing that same keyup. The flag
 * reported "still held" forever after the first release that happened while a
 * cluster was open. Tracked once, here, ahead of every consumer, and installed
 * with the module for the same reason _primeKeyOwner is, it cannot be
 * swallowed.
 */
interface HoldTracker {
  /** The pad's half — called every frame by _processGamepad. */
  setPad: (held: boolean) => void;
  /** Fires once per actual transition, immediately. */
  subscribe: (fn: (held: boolean) => void) => () => void;
  isHeld: () => boolean;
}

function _makeHoldTracker(
  /** Whether this event is the mode's own key. Takes the event, not the key,
   *  because a mode spelled with a modifier has to say so — see aim's Meta. */
  isKey: (e: KeyboardEvent) => boolean,
): HoldTracker {
  // The two sources are tracked apart and OR'd, for the reason _confirmHeld's
  // halves are: the key coming up must not clear a hold the trigger is still
  // keeping, or the other way round.
  let fromKeyboard = false;
  let fromPad = false;
  let held = false;
  // Push rather than poll: a change to a single boolean that only matters a
  // handful of times a session does not earn its own interval timer. Every
  // writer goes through one place, so "did it actually change" and "who to
  // tell" are answered once.
  const listeners = new Set<(held: boolean) => void>();
  const apply = (): void => {
    const next = fromKeyboard || fromPad;
    if (held === next) return;
    held = next;
    for (const fn of listeners) fn(next);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (isKey(e) && !e.repeat) { fromKeyboard = true; apply(); }
    }, true);
    // Unconditional on release — other modifiers held at release time are not
    // reason enough to leave the flag stuck.
    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (isKey(e)) { fromKeyboard = false; apply(); }
    }, true);
    // The WINDOW losing focus, not any element inside it: blur does not bubble,
    // so capture here would drop the hold every time focus moved between two
    // controls with the key still down. See _keydownInTextField's blur for the
    // same trap caught the hard way.
    window.addEventListener('blur', () => { fromKeyboard = false; apply(); });
  }

  return {
    setPad: (v: boolean) => { if (fromPad !== v) { fromPad = v; apply(); } },
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    isHeld: () => held,
  };
}

const _plain = (e: KeyboardEvent) => !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
const _zTracker = _makeHoldTracker(e => (e.key === 'z' || e.key === 'Z') && _plain(e));
/**
 * Aim mode is Command, not a letter.
 *
 * A modifier is the honest spelling for it: aim mode does not do anything by
 * itself, it changes what the arrows and the stick already mean — which is what
 * a modifier is for. Cmd+Arrow was already a second reading of the arrows on
 * this board (want-focus navigation), so the mode is not taking a chord that
 * was free; it is collecting one that was already there.
 *
 * Matched on the key itself rather than on `metaKey`, so it tracks Command
 * going down and coming up rather than every chord that happens to include it.
 * Its own keydown carries metaKey: true, which is why the plain-key guard the
 * letters use cannot apply here.
 */
const _aimTracker = _makeHoldTracker(e => e.key === 'Meta');

/**
 * Y, tracked in one place rather than per hook instance.
 *
 * Every useInputActions instance keeps its own yHeldRef for isButtonYHeld(),
 * and that copy can be left behind: an instance that captures input stops the
 * event before other instances' listeners run, so their refs never see the
 * press. Anything that only needs to know whether Y is DOWN — the skill slot's
 * switcher, which appears while it is — reads this instead, which is fed from
 * the window listeners the tracker installs and from the pad poll below.
 */
const _yTracker = _makeHoldTracker(e => (e.key === 'y' || e.key === 'Y') && _plain(e));

const _setPadZHeld = _zTracker.setPad;
const _setPadAimHeld = _aimTracker.setPad;
const _setPadYHeld = _yTracker.setPad;

/** Subscribe to Z mode's held state — see _makeHoldTracker. */
export const subscribeZHeld = _zTracker.subscribe;
/** Whether Z mode is engaged from a real button right now. */
export const isZHeld = _zTracker.isHeld;
/** Subscribe to Y's held state — see _yTracker. */
export const subscribeYHeld = _yTracker.subscribe;
/** Whether Y is down right now, on either device. */
export const isYHeld = _yTracker.isHeld;
/** Subscribe to aim mode's held state — see _makeHoldTracker. */
export const subscribeAimHeld = _aimTracker.subscribe;
/** Whether aim mode is engaged from a real button right now. */
export const isAimHeld = _aimTracker.isHeld;

// When true, a captureTab hook is active and owns keyboard Tab — the form-level
// captureInput keyboard handler will skip Tab to avoid double-navigation.
let _captureTabActive = false;
let _rafHandle: number | null = null;
const _trackStates = new Map<string, TrackState>();

// Flag used inside _emit to detect whether a listener consumed a tab action
// with an explicit custom callback.  Prevents _focusNext from running when a
// consumer provides its own onTabForward / onTabBackward handler.
let _tabActionConsumed = false;

// The same idea for D-pad directions — see the arrow-key fallback in _emit.
let _navActionConsumed = false;

// True while the A/Cross (confirm) button is physically held.
// When held, D-pad direction inputs are upgraded to "warp-*" actions so
// consumers can bind A+D-pad to a "warp to edge" operation. (A-held + left
// stick maps to onMove instead — see the left-stick polling below, which
// synthesizes a Shift+ArrowX keydown rather than going through this path.)
/**
 * How long a confirm press waits to find out whether it is half of a double.
 *
 * 300 ms, the value this hook has always used to detect the second press, now
 * also the window a lone press is held for when both actions are bound. The
 * card's mouse handler uses 250 ms for the same distinction; the keyboard is
 * given slightly longer because there is no pointer travel to hurry it.
 */
const DOUBLE_CONFIRM_MS = 300;

let _confirmHeld = false;
/** Whether A/Cross is physically held right now — for rAF polls that need to
 * know this directly (e.g. a continuous stick-drag that should keep running
 * only while A stays down), rather than reacting to confirm-* events. */
export function isConfirmHeld(): boolean {
  return _confirmHeld;
}

// Timer for A long-press detection (→ confirm-long action).
let _confirmLongTimer: ReturnType<typeof setTimeout> | null = null;

// A/Cross is held by TWO independent sources: the physical pad (written every
// frame by _pollGamepads) and software buttons like CanvasDPad (written on
// press/release). They must be tracked separately and OR'd, never share one
// flag.
//
// Sharing one flag meant the poll loop clobbered software holds: the frame
// after CanvasDPad's A called simulateConfirmButton(true), the poll wrote
// buttons[0].pressed === false straight back over it, killing the hold ~16ms
// in. The long-press never reached its threshold, so A's latch (canvas drag, rendered
// as the inverted white A) silently did nothing — but ONLY while a physical
// gamepad was connected, since with no pad there is no poll to overwrite it.
let _confirmHeldPhysical = false;
let _confirmHeldSoftware = false;

/** Physical-pad half of the A button — called every frame by _pollGamepads. */
function _setPhysicalConfirm(pressed: boolean): void {
  _confirmHeldPhysical = pressed;
  _applyConfirmHeld();
}

// Deferred-confirm state machine for the A/Cross button, shared by real
// gamepad polling (_pollGamepads below) and any software/on-screen button
// that wants full parity with a physical gamepad A button — same
// confirm/confirm-long/confirm-long-release timing, and same _confirmHeld
// flag so D-pad chords (warp-*) upgrade correctly regardless of which
// input drove the press:
//   Short press  (< CONFIRM_LONG_MS): emits 'confirm' on RELEASE
//   Long press   (≥ CONFIRM_LONG_MS): emits 'confirm-long' at that mark, never 'confirm'
//   While held:  D-pad inputs are upgraded to 'warp-*' (chord navigation)
/**
 * Select and Start, from the software pad.
 *
 * Straight to _emit, the way the physical buttons arrive: a real Select is
 * gamepad button 8 mapped to 'menu-toggle' and Start is button 9 mapped to
 * 'context-menu' (see GAMEPAD_BUTTON_ACTIONS), and their keyboard spellings are
 * Alt+Enter and Shift+Enter. Synthesising one of those key events instead would
 * mean reproducing the Enter handler's other branches to get past them; these
 * two have no held state and no long press, so the action itself is the whole
 * of what a press means.
 */
export function simulateSelectButton(): void { _emit('menu-toggle'); }
/**
 * Y, pressed or let go, by software — Y mode's press on a tapped want or
 * thing (see yModeStore). Emitted as the pad's own action, so whichever skill
 * is equipped hears exactly what a real Y would have given it.
 */
export function simulateYButton(pressed: boolean): void { _emit(pressed ? 'y-button' : 'y-button-release'); }
export function simulateStartButton(): void { _emit('context-menu'); }

export function simulateConfirmButton(pressed: boolean): void {
  _confirmHeldSoftware = pressed;
  _applyConfirmHeld();
}

/**
 * Fold both A sources into _confirmHeld and run the press/release state
 * machine on the *combined* value, so a press from either source starts the
 * long-press timer and neither source's release cancels the other's hold.
 */
function _applyConfirmHeld(): void {
  const aPrev = _confirmHeld;
  _confirmHeld = _confirmHeldPhysical || _confirmHeldSoftware;
  if (_confirmHeld && !aPrev) {
    _confirmLongTimer = setTimeout(() => {
      _confirmLongTimer = null;
      _emit('confirm-long');
    }, CONFIRM_LONG_MS);
  } else if (!_confirmHeld && aPrev) {
    if (_confirmLongTimer !== null) {
      clearTimeout(_confirmLongTimer);
      _confirmLongTimer = null;
      _emit('confirm');
    } else {
      _emit('confirm-long-release');
    }
    // Unconditional, in addition to whichever of the above also fired — the
    // one reliable "A was just released" signal, e.g. for committing a
    // gamepad A+stick reorder preview (see onConfirmReleased) regardless of
    // whether the hold happened to cross the long-press threshold.
    _emit('confirm-released');
  }
}

// True while B/Circle is physically held — for rAF polls that need to know
// this directly, mirroring isConfirmHeld().
let _cancelHeld = false;
export function isCancelHeld(): boolean {
  return _cancelHeld;
}
// Timer for B long-press detection (→ cancel-long action).
let _cancelLongTimer: ReturnType<typeof setTimeout> | null = null;

// Physical vs software halves of B, split for exactly the reason A is — see
// _confirmHeldPhysical.
let _cancelHeldPhysical = false;
let _cancelHeldSoftware = false;

/** Physical-pad half of the B button — called every frame by _pollGamepads. */
function _setPhysicalCancel(pressed: boolean): void {
  _cancelHeldPhysical = pressed;
  _applyCancelHeld();
}

// Deferred-cancel state machine for the B/Circle button — mirrors
// simulateConfirmButton exactly (same reasoning applies): firing 'cancel'
// immediately on press used to clear the selection before a long-press's
// 500ms threshold could be reached, so a hold-to-enter-rotation-guide
// gesture never saw a still-selected want by the time it fired. Deferring
// the short-press 'cancel' to RELEASE fixes that, and happens to also match
// keyboard Escape/Space's cancel timing, which already fired on release.
//   Short press  (< CANCEL_LONG_MS): emits 'cancel' on RELEASE
//   Long press   (≥ CANCEL_LONG_MS): emits 'cancel-long' at that mark, never 'cancel'
export function simulateCancelButton(pressed: boolean): void {
  _cancelHeldSoftware = pressed;
  _applyCancelHeld();
}

/**
 * What had focus when B went down, for the same reason the keyboard keeps it:
 * the action fires on release and the answer must describe the press.
 */
let _cancelPressTarget: HTMLElement | null = null;

/** Combined-value state machine for B — mirrors _applyConfirmHeld. */
function _applyCancelHeld(): void {
  const bPrev = _cancelHeld;
  _cancelHeld = _cancelHeldPhysical || _cancelHeldSoftware;
  if (_cancelHeld && !bPrev) {
    _cancelPressTarget = (document.activeElement as HTMLElement | null) ?? null;
    _cancelChordUsed = false;
    _cancelLongTimer = setTimeout(() => {
      _cancelLongTimer = null;
      _emit('cancel-long');
    }, CANCEL_LONG_MS);
  } else if (!_cancelHeld && bPrev) {
    if (_cancelChordUsed) {
      // B was a modifier this time, not a press. Letting go of it means the
      // chord is over and nothing else — firing 'cancel' here would back out
      // of whatever the chord just opened, which for B+R1 is the tab picker
      // the user is looking at.
      _cancelChordUsed = false;
    } else if (_cancelLongTimer !== null) {
      clearTimeout(_cancelLongTimer);
      _cancelLongTimer = null;
      _emit('cancel');
    } else {
      _emit('cancel-long-release');
    }
  }
}

/**
 * Whether the B currently held has been used as a chord modifier.
 *
 * Set when a B+button combination fires; read on B's release to suppress the
 * press it would otherwise be. Also stops the long-press timer, since a chord
 * held past 500ms is still a chord — the alternative is that reaching for a
 * second tab hop drops you into the rotation guide.
 */
let _cancelChordUsed = false;
function _markCancelChord(): void {
  _cancelChordUsed = true;
  if (_cancelLongTimer !== null) {
    clearTimeout(_cancelLongTimer);
    _cancelLongTimer = null;
  }
}

function _emit(action: GamepadActionType): void {
  // Upgrade direction → warp-<dir> while A button is held
  const effectiveAction: GamepadActionType =
    _confirmHeld && NAV_ACTIONS.has(action as NavigationDirection)
      ? (`warp-${action}` as GamepadActionType)
      : action;

  // The gamepad's single funnel, the counterpart to _primeKeyOwner's. Logged
  // with the same claim state so a keyboard press and a pad press that mean
  // the same thing sit side by side in the tap and can be compared.
  {
    const claim = _liveClaim();
    recordInput('gamepad', effectiveAction,
      claim ? (claim.scope ? 'claim:widget' : 'claim:mode') : 'claim:none');
  }

  const isTabAction    = effectiveAction === 'tab-forward'     || effectiveAction === 'tab-backward';
  const isSubTabAction = effectiveAction === 'sub-tab-forward' || effectiveAction === 'sub-tab-backward';

  // tab-* and sub-tab-* always broadcast to ALL listeners regardless of who holds the claim.
  // This ensures L1/R1 reach WantDetailsSidebar's tab-switch handler even while a
  // card-grid (useCardGridNavigation) holds the capture slot.
  if (isTabAction || isSubTabAction) {
    _tabActionConsumed = false;
    _broadcast(effectiveAction);
    // Fall back to native Tab-style focus movement only when nothing consumed
    // the action AND no sidebar is on screen.
    //
    // The sidebar test must be isSidebarOnScreen() (does a sidebar exist?), not
    // just _isInSidebar() (is document.activeElement inside one?). Those differ
    // exactly when it matters: while the Add Want sidebar is in its
    // type-selection phase, nothing has taken DOM focus yet, so activeElement
    // is still <body> — outside the sidebar. _isInSidebar() therefore returned
    // false and _focusNext() ran, walking the whole document's focusables and
    // yanking focus out of the open sidebar into the canvas behind it. From
    // there the canvas's own focus-driven hooks come alive and start claiming
    // the exclusive gamepad capture slot, so a later A press never reaches the
    // form — even though the form still looks focused. (isSidebarOnScreen's own
    // doc comment already warns that "activeElement may still be stale".)
    if (isTabAction && !_tabActionConsumed && !_isInSidebar() && !isSidebarOnScreen()) {
      _focusNext(effectiveAction === 'tab-backward');
    }
    return;
  }

  // confirm-released always broadcasts too — a passive "A just came up"
  // signal (e.g. committing a gamepad reorder preview), not a navigation
  // action, so it must reach its listener even while some card-grid holds the
  // capture slot for D-pad/A.
  if (effectiveAction === 'confirm-released') {
    _broadcast(effectiveAction);
    return;
  }

  const isNav = NAV_ACTIONS.has(effectiveAction);
  if (isNav) _navActionConsumed = false;

  // Route exclusively to the capture slot, but only while its claim is still
  // credible — a focus-derived claim whose element no longer holds focus is
  // stale and must not swallow the action (see _liveClaim).
  const claim = _liveClaim();
  if (claim) {
    try {
      claim.listener(effectiveAction);
    } catch (err) {
      console.error('[useInputActions] capture listener threw', effectiveAction, err);
    }
    if (isNav && !_navActionConsumed) _fallBackToArrowKey(effectiveAction as StickDir);
    return;
  }

  _broadcast(effectiveAction);
  if (isNav && !_navActionConsumed) _fallBackToArrowKey(effectiveAction as StickDir);
}

/**
 * A D-pad direction nobody bound becomes the arrow key it stands for.
 *
 * The two devices did not reach the same places. The left stick has always been
 * turned into arrow keydowns (see _pollLeftStick), so it lands in every plain
 * onKeyDown in the app; the D-pad is only ever broadcast as an action, so it
 * lands solely in handlers that thought to bind onNavigate. Anything with its
 * own keydown — and there are good reasons to have one, e.g. the detail panel
 * stops arrows from bubbling out of itself, which puts its innards out of a
 * window listener's reach — was therefore reachable with the arrow keys and a
 * dead end with the pad. That is not a property of any one screen, so it is not
 * any one screen's job to patch: the fallback belongs here, next to the stick's.
 *
 * Only when nothing consumed it. A handler that binds onNavigate has said the
 * direction is its own, and synthesizing a key on top would step twice — the
 * same contract _tabActionConsumed already uses for L1/R1.
 *
 * Sent to the focused element rather than to document.body (where the stick's
 * synthesis goes, and must stay: it is aimed at window-level listeners). A real
 * arrow key is delivered to whatever has focus and bubbles up from there, and
 * the handlers this exists to reach sit BELOW the window — they only see an
 * event that starts inside them. Falls back to body when nothing is focused, so
 * the target is always an Element and the `.closest` guards downstream (which
 * threw on `window` once already) stay safe. keyup follows immediately: held
 * D-pad repeat comes from _beginRepeat as a series of taps, and a keydown with
 * no keyup would leave "which arrows are held" state stuck down forever.
 */
function _fallBackToArrowKey(dir: StickDir): void {
  const key = ARROW_KEY[dir];
  if (!key) return;
  const target: Element = document.activeElement instanceof Element ? document.activeElement : document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  target.dispatchEvent(new KeyboardEvent('keyup',   { key, bubbles: true, cancelable: true }));
}

// Deliver an action to every registered listener, isolating each one.
//
// This used to be a bare `_listeners.forEach(fn => fn(action))`. Array/Set
// forEach does NOT contain exceptions: the first listener that throws
// propagates out and every listener after it is skipped — so one unrelated
// broken handler silently swallowed the action for the entire app, with no
// visible error at the point of failure.
//
// That produced a genuinely baffling symptom: gamepad A appeared dead while
// keyboard Enter still worked. The two travel different paths — gamepad
// actions all funnel through this single shared loop, whereas each hook
// installs its own window.addEventListener for keyboard, and the browser
// isolates exceptions between listeners automatically. So a throwing handler
// took out the gamepad path only. (The concrete thrower was _isInSidebar
// hitting a non-Element event target; both of those are fixed too, but the
// loop must not be this fragile in the first place.)
function _broadcast(action: GamepadActionType): void {
  _listeners.forEach(fn => {
    try {
      fn(action);
    } catch (err) {
      console.error('[useInputActions] listener threw', action, err);
    }
  });
}

function _getOrCreate(key: string): TrackState {
  if (!_trackStates.has(key)) {
    _trackStates.set(key, { pressed: false, repeatTimeout: null, repeatInterval: null });
  }
  return _trackStates.get(key)!;
}

function _beginRepeat(key: string, action: GamepadActionType): void {
  if (!NAV_ACTIONS.has(action)) return;
  const state = _trackStates.get(key);
  if (!state) return;
  state.repeatTimeout = setTimeout(() => {
    if (!_trackStates.get(key)?.pressed) return;
    _emit(action);
    state.repeatInterval = setInterval(() => {
      if (!_trackStates.get(key)?.pressed) {
        clearInterval(state.repeatInterval!);
        state.repeatInterval = null;
        return;
      }
      _emit(action);
    }, REPEAT_INTERVAL);
  }, INITIAL_REPEAT_DELAY);
}

function _endRepeat(key: string): void {
  const state = _trackStates.get(key);
  if (!state) return;
  if (state.repeatTimeout !== null) { clearTimeout(state.repeatTimeout); state.repeatTimeout = null; }
  if (state.repeatInterval !== null) { clearInterval(state.repeatInterval); state.repeatInterval = null; }
}

// Left-stick-as-arrow-key state, keyed by gamepad index — mirrors the
// keyboard's own repeat timing (see INITIAL_REPEAT_DELAY/REPEAT_INTERVAL)
// but tuned separately since analog input naturally debounces direction
// changes differently than a digital key.
const STICK_DEADZONE   = 0.4;
const STICK_INITIAL_MS = 250;
const STICK_REPEAT_MS  = 80;
// B (button 1) held = accelerated stick movement — shorter initial delay and a
// faster repeat, so holding B while pushing the stick steps the CursorMan across
// cells much quicker. Mirrors the external CursorMan overlay's B-held fast mode
// (cursorOverlayCore's stickSpeed cur[1] ? 30 : 10).
const STICK_FAST_INITIAL_MS = 110;
const STICK_FAST_REPEAT_MS  = 32;
const ARROW_KEY: Record<'up' | 'down' | 'left' | 'right', string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};
type StickDir = 'up' | 'down' | 'left' | 'right';
interface StickState {
  dirs: StickDir[];
  startTime: number;
  lastMoveTime: number;
}
const _stickStates = new Map<number, StickState>();

// Suppresses _pollLeftStick's synthesized-keydown dispatch entirely — set by a
// page that's driving the plain stick itself via a free-roaming cursor instead
// (e.g. useFreeCursorNav's CursorMan-equivalent list navigation, or WantCanvas's
// own CursorMan drag). A-held+stick (want-drag/warp) is unaffected by callers of
// this — they only suppress while A is not held, matching their own gating.
let _stickNavSuppressed = false;
export function setStickNavSuppressed(v: boolean): void {
  _stickNavSuppressed = v;
}

// Predicate answering "will another mechanism take the plain left stick on
// THIS frame, for these exact axis values?" — consulted below before any arrow
// key is synthesized.
//
// setStickNavSuppressed alone could not prevent the following race, because it
// is a flag written by a *different* rAF callback. useFreeCursorNav engages its
// free-roaming cursor at 0.15 deflection and only then suppresses; this poll
// synthesizes arrows at 0.4. Push the stick slowly and suppression is armed
// long before 0.4 is crossed, so all is well — but flick it past 0.4 inside a
// single frame and the outcome depends purely on which rAF callback the
// browser happens to run first. When this one won, it fired an ArrowX before
// suppression existed and focus snapped to a neighbouring card, i.e. the stick
// intermittently behaved like the D-pad instead of moving the cursor freely.
//
// A predicate removes the ordering dependence entirely: both mechanisms decide
// from the same axis values within the same frame, so they cannot disagree
// regardless of who runs first.
let _stickOwnerProbe: ((lx: number, ly: number, aHeld: boolean) => boolean) | null = null;
export function setStickOwnerProbe(
  fn: ((lx: number, ly: number, aHeld: boolean) => boolean) | null,
): void {
  _stickOwnerProbe = fn;
}

// Whether WantCanvas's own internal CursorMan currently owns the plain left
// stick — set by WantCanvas while the canvas area has "canvas focus" (see
// its cursorFocused logic). While true, the app-wide free-roaming list
// cursor (useGlobalFreeCursor) must not move or render, so the two systems
// never fight over the same stick input; when canvas cedes focus (e.g. a
// details sidebar takes over), this flips false so the external cursor
// resumes — see WantCanvas's own poll loop for where this is set.
let _canvasCursorActive = false;
export function setCanvasCursorActive(v: boolean): void {
  _canvasCursorActive = v;
}
export function isCanvasCursorActive(): boolean {
  return _canvasCursorActive;
}

// Whether the canvas spatial minimap currently owns the plain left stick —
// set true when Dashboard's L1/R1 handler hands off to the minimap while
// CursorMan is on empty canvas ground (see CanvasSpatialMinimap's
// enterNavFromCanvas), set false when the minimap's own nav hands back
// (pushing left off its leftmost item, or B — see CanvasSpatialMinimap).
// While true, WantCanvas's canvasFocusedNow computes to false (on top of the
// existing isFocusInsideSidebar() check) so its own CursorMan stops consuming the
// stick, letting the minimap's nav take over.
/**
 * A want card holds inner focus — its slider, its text box, its picker.
 *
 * While this is true the card owns the keyboard outright: anything it does not
 * consume is dropped rather than falling through to whatever is behind it. Two
 * cards' worth of handlers listening at once is how a press ended up moving the
 * board while the user thought they were dragging a slider.
 *
 * Escape is the exception, and deliberately the only one — it is the way out,
 * so it can never be the thing that gets swallowed.
 *
 * Read straight from cardInnerFocusStore rather than mirrored into a local
 * boolean here. The mirror was a second copy of a fact the scrim also reads,
 * and the two could disagree — a card unmounted mid-edit released this one and
 * not the other, leaving the board grey but responsive. One fact, one writer
 * (the card, which claims and releases), every reader asking it directly.
 */
export function isCardInnerFocusActive(): boolean {
  return isAnyCardInnerFocused();
}

let _minimapCursorActive = false;
export function setMinimapCursorActive(v: boolean): void {
  _minimapCursorActive = v;
}
export function isMinimapCursorActive(): boolean {
  return _minimapCursorActive;
}

function _pollLeftStick(gi: number, gp: Gamepad): void {
  if (_stickNavSuppressed) {
    // Reset repeat-timing state so a stale `dirs` set doesn't cause a spurious
    // burst of fireDir calls the instant suppression is lifted.
    _stickStates.set(gi, { dirs: [], startTime: 0, lastMoveTime: 0 });
    return;
  }
  const lxRaw = gp.axes[0];
  const lyRaw = gp.axes[1];
  const aHeld = gp.buttons[0]?.pressed ?? false;
  const bHeld = gp.buttons[1]?.pressed ?? false; // B = accelerate (fast repeat)

  // Another mechanism owns the stick this frame (see _stickOwnerProbe). Reset
  // repeat state for the same reason the _stickNavSuppressed branch does — a
  // stale `dirs` set would fire a burst the moment ownership comes back.
  if (_stickOwnerProbe?.(lxRaw, lyRaw, aHeld)) {
    _stickStates.set(gi, { dirs: [], startTime: 0, lastMoveTime: 0 });
    return;
  }

  // Test each axis independently (not "whichever dominates") so a corner push
  // yields BOTH a horizontal and a vertical direction → diagonal movement.
  const dirs: StickDir[] = [];
  if      (lxRaw >  STICK_DEADZONE) dirs.push('right');
  else if (lxRaw < -STICK_DEADZONE) dirs.push('left');
  if      (lyRaw >  STICK_DEADZONE) dirs.push('down');
  else if (lyRaw < -STICK_DEADZONE) dirs.push('up');

  // Dispatch on document.body, NOT window: dispatching directly on window makes
  // event.target === window, and the keyboard handlers below do
  // `_isInSidebar(e.target)` → `target.closest(...)`, which throws on window
  // (it has no .closest). That exception propagates out of whichever handler
  // is running and, on the gamepad broadcast path, aborts the whole
  // _listeners.forEach — silently killing input for every listener after it.
  // document.body still bubbles to window, so window-level listeners are
  // unaffected. CanvasDPad's fireKey already does this for the same reason.
  const fireDir = (d: StickDir) =>
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ARROW_KEY[d], shiftKey: aHeld, bubbles: true, cancelable: true }));

  if (!_stickStates.has(gi)) _stickStates.set(gi, { dirs: [], startTime: 0, lastMoveTime: 0 });
  const state = _stickStates.get(gi)!;
  const now = performance.now();
  const key = dirs.slice().sort().join(',');
  const prevKey = state.dirs.slice().sort().join(',');
  if (key !== prevKey) {
    // Direction set changed — fire only the newly-added directions immediately
    // (so pushing into a corner steps diagonally at once), and reset repeat timing.
    const added = dirs.filter(d => state.dirs.indexOf(d) === -1);
    state.dirs = dirs;
    state.startTime = now;
    state.lastMoveTime = now;
    added.forEach(fireDir);
  } else if (dirs.length) {
    const initialMs = bHeld ? STICK_FAST_INITIAL_MS : STICK_INITIAL_MS;
    const repeatMs  = bHeld ? STICK_FAST_REPEAT_MS  : STICK_REPEAT_MS;
    const heldMs = now - state.startTime;
    if (heldMs >= initialMs && now - state.lastMoveTime >= repeatMs) {
      state.lastMoveTime = now;
      dirs.forEach(fireDir); // repeat all active directions → sustained diagonal
    }
  }
}

// Option(Alt)+Arrow keyboard tracker — a keyboard equivalent of the left
// analog stick's vector, so useFreeCursorNav / WantCanvas's CursorMan drag can
// be driven the same way by Option+Arrow as by the stick. Digital (-1/0/1 per
// axis, no magnitude gradation). Skipped while focus is in a text field —
// Option+Left/Right is the standard macOS "move by word" editing shortcut
// there, and must not be hijacked.
const _optionArrowHeld = new Set<string>();
let _optionArrowX = 0, _optionArrowY = 0;
const _ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function _isTextEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function _recomputeOptionArrowVector(): void {
  _optionArrowX = (_optionArrowHeld.has('ArrowRight') ? 1 : 0) - (_optionArrowHeld.has('ArrowLeft') ? 1 : 0);
  _optionArrowY = (_optionArrowHeld.has('ArrowDown')  ? 1 : 0) - (_optionArrowHeld.has('ArrowUp')   ? 1 : 0);
}

// Capture phase for the key events, bubble for blur — the asymmetry is the
// point, and both halves of it have already been learned the hard way here.
// Capture, because whether a key is PHYSICALLY down is true regardless of who
// consumes the event: a captureInput hook calling stopImmediatePropagation()
// would otherwise stop this tracker ever seeing the release, and the vector
// would stay non-zero forever (the exact failure Z mode's flag was rewritten
// for). Bubble for blur, because blur does not bubble, so a capturing window
// listener is the only one that hears every ELEMENT's blur too — and clearing
// held state every time focus moved between two controls is its own bug (see
// _keydownInTextField, where that mistake silently disabled a whole fix).
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.altKey || !_ARROW_KEYS.has(e.key) || _isTextEditableTarget(e.target)) return;
    if (!_optionArrowHeld.has(e.key)) { _optionArrowHeld.add(e.key); _recomputeOptionArrowVector(); }
  }, true);
  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (_optionArrowHeld.delete(e.key)) _recomputeOptionArrowVector();
  }, true);
  // A stuck-held key (e.g. Alt released via OS focus-switch while an arrow was
  // still down) would otherwise leave the vector non-zero forever.
  window.addEventListener('blur', () => {
    if (_optionArrowHeld.size > 0) { _optionArrowHeld.clear(); _recomputeOptionArrowVector(); }
  });
}

// Plain-Space keyboard tracker — the keyboard equivalent of the gamepad B
// button being physically held, for consumers that read gamepad B's raw
// hold state directly (e.g. useFreeCursorNav / WantCanvas's CursorMan drag
// 3x-speed boost) rather than going through the cancel/cancel-long action
// system. Deliberately a SEPARATE global flag from _cancelHeld (which
// mirrors ONLY the real gamepad button, continuously re-synced every poll
// frame — merging keyboard into that same flag would have it stomped back
// to false on the very next gamepad poll tick). Skipped while focus is in a
// text field, same reasoning as Option+Arrow: a literal space being typed
// must never be read as "the accelerate button is held".
let _spaceHeld = false;

// Capture for the keys, bubble for blur — same asymmetry, same reasons, as the
// Option+Arrow tracker above. This one is the more visible of the two when it
// sticks: CursorMan's drag reads it for the 3x speed boost, so a swallowed
// keyup leaves the character running at triple speed with nothing held.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== ' ' || e.altKey || e.shiftKey || _isTextEditableTarget(e.target)) return;
    _spaceHeld = true;
  }, true);
  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (e.key === ' ') _spaceHeld = false;
  }, true);
  window.addEventListener('blur', () => { _spaceHeld = false; });
}

/** Whether plain Space is physically held right now — the keyboard mirror
 * of gamepad B's raw hold state (see the tracker above for why this is a
 * separate flag from _cancelHeld/isCancelHeld). */
export function isSpaceHeld(): boolean {
  return _spaceHeld;
}

/** Keyboard equivalent of the left analog stick's {x,y}, driven by
 * Option(Alt)+Arrow keys. See the tracker above for scope/caveats. */
export function getOptionArrowVector(): { x: number; y: number } {
  return { x: _optionArrowX, y: _optionArrowY };
}

// Process one gamepad's buttons/sticks. `gp` is either a real Gamepad (Gamepad
// API) or a synthetic one built from a WebHID frame — both expose
// buttons[i].pressed + axes[i], which is all this reads.
function _processGamepad(gi: number, gp: Gamepad): void {
  // Deferred-confirm for A/Cross (button 0) — see simulateConfirmButton.
  // Writes the PHYSICAL half only: this runs every frame, so writing the
  // shared flag here would overwrite a software button's hold ~16ms after it
  // started (see _confirmHeldPhysical).
  if (gp.buttons[0]) _setPhysicalConfirm(gp.buttons[0].pressed);
  // Deferred-cancel for B/Circle (button 1) — see simulateCancelButton.
  if (gp.buttons[1]) _setPhysicalCancel(gp.buttons[1].pressed);
  // The two aiming modes' pad halves — L2 for Z mode, R2 for aim mode. Read
  // straight off the frame, like the two above and unlike their button actions
  // below, because these are HELD states: the action fires once per press, and
  // the flag has to be true for the whole time in between whether or not
  // anything happened to bind the action.
  if (gp.buttons[3]) _setPadYHeld(gp.buttons[3].pressed);
  if (gp.buttons[6]) _setPadZHeld(gp.buttons[6].pressed);
  if (gp.buttons[7]) _setPadAimHeld(gp.buttons[7].pressed);

  // Mapped buttons
  for (const [btnIdxStr, action] of Object.entries(BUTTON_MAP)) {
    const bi = Number(btnIdxStr);
    if (bi >= gp.buttons.length) continue;
    const key = `${gi}:b${bi}`;
    const state = _getOrCreate(key);
    const pressed = gp.buttons[bi].pressed;

    if (pressed && !state.pressed) {
      state.pressed = true;
      // B + bumper is the second level of tab navigation — what the triggers
      // used to be, before they became A and B. Resolved once, at the press,
      // and remembered: B can be let go while the bumper is still down, and
      // the release must still be the release of what was actually emitted.
      const onBumper = action === 'tab-backward' || action === 'tab-forward';
      const chord = _cancelHeld && onBumper;
      // Y + bumper walks the canvas skill slot, the way B + bumper walks the
      // sub-tabs: the slot's own button, and the two nearest things to it.
      //
      // Read off the pad itself rather than through a held flag. Y's press is
      // dispatched from this same sweep, so the physical state in THIS frame is
      // the one the chord is about, and there is no second copy of it to fall
      // out of step (which per-instance Y-held tracking has form for).
      //
      // Asked after B's chord so the older combination keeps its meaning when
      // both are somehow down.
      const skillChord = !chord && onBumper && (gp.buttons[3]?.pressed ?? false);
      const resolved: GamepadActionType = chord
        ? (action === 'tab-forward' ? 'sub-tab-forward' : 'sub-tab-backward')
        : skillChord
          ? (action === 'tab-forward' ? 'skill-next' : 'skill-prev')
          : action;
      if (chord) _markCancelChord();
      state.action = resolved;
      _emit(resolved);
      // X/Square button (toggle) also fires button-x so onButtonX listeners react.
      if (resolved === 'toggle') _emit('button-x');
      _beginRepeat(key, resolved);
    } else if (!pressed && state.pressed) {
      state.pressed = false;
      _endRepeat(key);
      const resolved = state.action ?? action;
      state.action = undefined;
      // Emit release events for toggle (X/Square button) so callers can
      // implement hold-to-show (toggle-release) or press/release interactions
      // keyed to X specifically (button-x-release). The sub-tab chord gets the
      // same treatment so a picker can be held open and confirmed on release.
      if (resolved === 'toggle') { _emit('toggle-release'); _emit('button-x-release'); }
      else if (resolved === 'y-button') _emit('y-button-release');
      else if (resolved === 'z-button') _emit('z-button-release');
      else if (resolved === 'aim-button') _emit('aim-button-release');
      else if (resolved === 'sub-tab-forward') _emit('sub-tab-forward-release');
      else if (resolved === 'sub-tab-backward') _emit('sub-tab-backward-release');
    }
  }

  // Left stick (axes 0/1): same as D-pad — dispatches synthesized ArrowX
  // keydown events (Shift+ArrowX while A is held) so all existing keyboard
  // handlers (onNavigate / onMove) respond naturally, regardless of which
  // page/mode is currently mounted. Polled centrally (not per-component)
  // so list views get the same stick support as the canvas.
  if ((gp.axes?.length ?? 0) > 1) _pollLeftStick(gi, gp);

  // Right stick: E/W zone (|x|>=|y|, ±45° from horizontal) → slide, N/S zone → canvas zoom.
  // D-pad buttons (12-15) are the canonical navigation input.
  if ((gp.axes?.length ?? 0) > 2) {
    const rsxKey = `${gi}:rsx`;
    const rsxState = _getOrCreate(rsxKey);
    const x = gp.axes[2];
    const y = gp.axes.length > 3 ? gp.axes[3] : 0;
    // Fire slide only when X is past deadzone AND dominates Y (east/west sector)
    const inZone = Math.abs(x) > AXIS_DEADZONE && Math.abs(x) >= Math.abs(y);
    if (inZone && !rsxState.pressed) {
      rsxState.pressed = true;
      _emit(x < 0 ? 'swipe-left' : 'swipe-right');
    } else if (!inZone && rsxState.pressed) {
      rsxState.pressed = false;
    }
  }
}

// Build a Gamepad-shaped view over a normalized {buttons, axes} frame so
// _processGamepad/_pollLeftStick can consume WebHID identically to the Gamepad
// API. Only buttons[i].pressed + axes[i] are read, so the rest is unfilled.
function _syntheticGamepad(frame: { buttons: boolean[]; axes: number[] }): Gamepad {
  return {
    buttons: frame.buttons.map(p => ({ pressed: p, touched: p, value: p ? 1 : 0 })),
    axes: frame.axes,
  } as unknown as Gamepad;
}

// Buttons already down when this tab came back to the front — ignored until
// they are let go.
//
// The poll runs on requestAnimationFrame, which stops while the tab is hidden,
// so a button pressed elsewhere is never seen going down; the first frame back
// sees it held, reads that as a fresh press, and on its release A fires
// 'confirm'. The extension's Warp is exactly that: A pressed on another site's
// tab brings this one forward with A still down, and the card that had focus
// here was opened as if A had been pressed on it. What began on another tab
// belongs to that tab.
const _heldSinceReturn = new Set<number>();
let _hiddenSincePoll = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) _hiddenSincePoll = true;
  });
}

/** The frame with every button held since the tab came back reading as up. */
function _maskHeldSinceReturn(frame: { buttons: boolean[]; axes: number[] }): { buttons: boolean[]; axes: number[] } {
  if (_hiddenSincePoll) {
    _hiddenSincePoll = false;
    _heldSinceReturn.clear();
    frame.buttons.forEach((p, i) => { if (p) _heldSinceReturn.add(i); });
  }
  if (_heldSinceReturn.size === 0) return frame;
  return {
    axes: frame.axes,
    buttons: frame.buttons.map((p, i) => {
      if (!_heldSinceReturn.has(i)) return p;
      if (!p) _heldSinceReturn.delete(i);
      return false;
    }),
  };
}

function _pollGamepads(): void {
  // Processing is wrapped so a throw can never skip the re-schedule below.
  // This loop is self-perpetuating: the requestAnimationFrame at the end is
  // what keeps it alive. Previously an exception anywhere in _processGamepad —
  // e.g. a listener's _isInSidebar hitting a non-Element event target —
  // propagated out before that line ran, so the loop was never queued again
  // and ALL gamepad input died permanently for the rest of the page session.
  // Keyboard kept working (separate window listeners, which the browser
  // isolates), which is why the failure looked like "the A button is dead but
  // Enter is fine". It appeared to recover at random only because
  // _registerListener re-arms polling whenever the listener set drops to 0 and
  // back to 1 — which component churn from switching tabs happens to do.
  try {
    // Single resolved controller state (WebHID-preferred, Gamepad-API fallback)
    // from the shared source — see controllerHub.getControllerState. Processed as
    // one synthetic gamepad at index 0.
    const state = getControllerState();
    if (state) _processGamepad(0, _syntheticGamepad(_maskHeldSinceReturn(state)));
  } catch (err) {
    console.error('[useInputActions] gamepad poll failed', err);
  }

  _rafHandle = requestAnimationFrame(_pollGamepads);
}

function _startPolling(): void {
  if (_rafHandle !== null) return;
  _rafHandle = requestAnimationFrame(_pollGamepads);
}

function _stopPolling(): void {
  if (_rafHandle !== null) {
    cancelAnimationFrame(_rafHandle);
    _rafHandle = null;
  }
  _trackStates.forEach((_, key) => _endRepeat(key));
  _trackStates.clear();
  _stickStates.clear();
}

function _registerListener(fn: GamepadActionListener): void {
  _listeners.add(fn);
  if (_listeners.size === 1) _startPolling();
}

function _unregisterListener(fn: GamepadActionListener): void {
  _listeners.delete(fn);
  if (_listeners.size === 0) _stopPolling();
}

// ─── Guard helpers ────────────────────────────────────────────────────────────

function _isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function _isInSidebar(target?: HTMLElement | null): boolean {
  const el = target ?? (document.activeElement as HTMLElement | null);
  // Not every event target is an Element: dispatching a synthetic event
  // directly on window makes event.target === window, and document/Document
  // nodes reach here too. Those have no .closest, so calling it threw a
  // TypeError that escaped into the dispatch loop (see _broadcast). Treat
  // anything that isn't an Element as "not in a sidebar" rather than throwing.
  if (!el || typeof el.closest !== 'function') return false;
  // data-sidebar-open is set/cleared by RightSidebar via useLayoutEffect
  // based on the isOpen prop — not CSS animation state.  This makes the guard
  // reliable regardless of transition timing.
  if (el.closest('[data-sidebar="true"][data-sidebar-open="true"]')) return true;
  // The panel's card, blown up, is a portal at the document root — outside the
  // panel by containment and inside it by every other measure. Read as outside,
  // this guard let the board's handlers fire over a textarea the user was
  // typing into. See isInSidebarSurface, which is where this question is
  // properly answered.
  return !!el.closest('[data-sidebar-portal="true"]');
}

/**
 * Whether DOM FOCUS is inside an open sidebar — i.e. document.activeElement
 * (or `target`) has an open sidebar as an ancestor.
 *
 * Contrast with isSidebarOnScreen(), which asks whether a sidebar exists at
 * all. The two disagree exactly when a sidebar is open but nothing inside it
 * has taken focus yet (activeElement is still <body>), which is the normal
 * state during the Add Want form's type-selection phase. Reaching for this
 * one when the question was really "is a sidebar in the way?" is a mistake
 * that has been made three separate times in this codebase — it let the
 * canvas and the minimap decide they owned focus and pull it out from behind
 * an open sidebar. If you are arbitrating who owns input, you almost
 * certainly want isSidebarOnScreen().
 */
export function isFocusInsideSidebar(target?: HTMLElement | null): boolean {
  return _isInSidebar(target);
}

/**
 * Whether a sidebar is ON SCREEN at all, regardless of where DOM focus is.
 *
 * This is the one to use when deciding whether some background surface (the
 * canvas, the minimap, native Tab focus movement) may claim input: a sidebar
 * being open means it is in front of you, whether or not anything inside it
 * has been focused yet. isFocusInsideSidebar() answers a narrower question
 * and returns false in that very common case — see its doc comment.
 */
export function isSidebarOnScreen(): boolean {
  return !!document.querySelector('[data-sidebar="true"][data-sidebar-open="true"]');
}

// ─── Tab focus simulation ─────────────────────────────────────────────────────
// Used by gamepad L/R bumper buttons to replicate browser Tab / Shift+Tab
// behaviour when no explicit onTabForward/onTabBackward callback is provided.
// Called at most ONCE per button press (guarded by _tabActionConsumed flag in
// _emit, so multiple registered listeners never multiply this call).

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function _focusNext(reverse: boolean): void {
  // Use getBoundingClientRect for visibility check — more reliable than
  // offsetParent which returns null for position:fixed ancestors.
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(el => {
    if (el.closest('[aria-hidden="true"]')) return false;
    
    // Visibility check
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (candidates.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  const activeIdx = active ? candidates.indexOf(active) : -1;
  const nextIdx = reverse
    ? (activeIdx <= 0 ? candidates.length - 1 : activeIdx - 1)
    : (activeIdx < 0 ? 0 : (activeIdx + 1) % candidates.length);

  const target = candidates[nextIdx];
  if (target) {
    target.focus();
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Unified keyboard + Gamepad API input handler.
 *
 * Keyboard mapping:
 *   Arrow keys         → onNavigate (up / down / left / right)
 *   Alt+ArrowLeft/Right→ onSwipeNavigate (left / right)
 *   Home / End         → onNavigate (home / end)
 *   Enter              → onConfirm (KeyUp - aligned with Gamepad A release)
 *   Shift+Enter        → onContextMenu (KeyUp, same as plain Enter)
 *   Alt+Enter          → onMenuToggle (KeyUp, same as plain Enter)
 *   Escape / Space     → onCancel (KeyUp), or onCancelLong/onCancelLongRelease
 *                        instead if held ~500ms (aligned with Gamepad B) —
 *                        Space is grouped with Escape/Cancel, NOT Enter/Confirm
 *   x / X              → onButtonX
 *   z / Z              → onZButton / onZButtonRelease — Z mode, the keyboard
 *                        spelling of L2; NOT a second Y, which it used to be
 *   Meta (Command)     → onAimButton / onAimButtonRelease — aim mode, the
 *                        keyboard spelling of R2. Held, not chorded: what it
 *                        modifies is the arrows and the stick.
 *   any plain letter   → shortcuts[key] (KeyDown, unmodified, no repeat)
 *   Tab                → onTabForward  (no preventDefault — browser focus also moves)
 *   Shift+Tab          → onTabBackward (no preventDefault)
 *
 * Gamepad mapping (Standard Gamepad layout):
 *   D-pad / Left stick  → onNavigate
 *   A (0) held + D-pad  → onWarp (chord; left stick unaffected)
 *   A (0) held + Left stick → onMove (synthesized as a Shift+ArrowX keydown)
 *   Right stick X       → onSwipeNavigate (left / right, fires once per deadzone crossing)
 *   A (0)               → onConfirm (short press) / onConfirmLong + onConfirmLongRelease (held)
 *   B (1)               → onCancel (short press) / onCancelLong + onCancelLongRelease (held)
 *   X (2)               → onToggle + onButtonX (both fire)
 *   L Bumper (4)        → onTabBackward / simulate Shift+Tab
 *   R Bumper (5)        → onTabForward  / simulate Tab
 *   B held + L Bumper   → onSubTabBackward, then onSubTabBackwardRelease on release
 *   B held + R Bumper   → onSubTabForward,  then onSubTabForwardRelease  on release
 *   L2 (6)              → onZButton / onZButtonRelease — Z mode, see isZHeld()
 *   R2 (7)              → onAimButton / onAimButtonRelease — aim, see isAimHeld()
 *   Select (8)          → onMenuToggle
 *   Start (9)           → onContextMenu
 *
 * The second level of tab navigation is B + a bumper — one level down from the
 * bumpers alone, which is what it is, and the same shape the keyboard already
 * spells as Tab and Option+Tab.
 *
 * Touch (iPhone / touch devices):
 *   Horizontal swipe    → onSwipeNavigate (left / right)
 *
 * Navigation inputs have key-repeat behaviour (400 ms initial, 120 ms repeat).
 *
 * Set captureInput: true to claim the input. One rule serves both devices: a
 * key or a button goes to the live claim and to nobody else, and when there is
 * no claim it goes to every enabled instance, each applying its own guards.
 * Which claim is live is decided once per event, off the focus at the moment it
 * arrived (see _keyOwner / _liveClaim).
 */
export function useInputActions({
  onNavigate,
  onConfirm,
  onDoubleConfirm,
  onCancel,
  onCancelLong,
  onCancelLongRelease,
  onToggle,
  onToggleRelease,
  onMenuToggle,
  onContextMenu,
  onMove,
  onWarp,
  onConfirmLong,
  shortcuts,
  onConfirmLongRelease,
  onConfirmReleased,
  onYButton,
  onZButton,
  onZButtonRelease,
  onAimButton,
  onAimButtonRelease,
  onYButtonRelease,
  onButtonX,
  onButtonXRelease,
  onTabForward,
  onTabBackward,
  onSubTabForward,
  onSubTabBackward,
  onSubTabForwardRelease,
  onSubTabBackwardRelease,
  onRecommend,
  onSkillCycle,
  onPickUp,
  onPickUpRelease,
  onSwipeNavigate,
  onCursorTabHop,
  disableTouchSwipe = false,
  enabled = true,
  ignoreWhenInputFocused = true,
  ignoreWhenInSidebar = true,
  captureInput = false,
  gamepadOnly = false,
  captureTab = false,
  focusScope,
}: UseInputActionsOptions): UseInputActionsHandle {
  // Refs let us update callbacks without re-subscribing to events.
  const onNavigateRef        = useRef(onNavigate);
  const onMoveRef            = useRef(onMove);
  const onWarpRef            = useRef(onWarp);
  const onConfirmRef         = useRef(onConfirm);
  const onDoubleConfirmRef   = useRef(onDoubleConfirm);
  const onConfirmLongRef        = useRef(onConfirmLong);
  const shortcutsRef            = useRef(shortcuts);
  const onConfirmLongReleaseRef = useRef(onConfirmLongRelease);
  const onConfirmReleasedRef    = useRef(onConfirmReleased);
  const onCancelRef          = useRef(onCancel);
  const onCancelLongRef        = useRef(onCancelLong);
  const onCancelLongReleaseRef = useRef(onCancelLongRelease);
  const onToggleRef          = useRef(onToggle);
  const onToggleReleaseRef   = useRef(onToggleRelease);
  const onMenuToggleRef      = useRef(onMenuToggle);
  const onContextMenuRef     = useRef(onContextMenu);
  const onYButtonRef         = useRef(onYButton);
  const onZButtonRef         = useRef(onZButton);
  const onZButtonReleaseRef  = useRef(onZButtonRelease);
  const onAimButtonRef        = useRef(onAimButton);
  const onAimButtonReleaseRef = useRef(onAimButtonRelease);
  const onYButtonReleaseRef  = useRef(onYButtonRelease);
  const onButtonXRef         = useRef(onButtonX);
  const onButtonXReleaseRef  = useRef(onButtonXRelease);
  // Physical y hold state, the mirror of xHeldRef — see isButtonYHeld().
  const yHeldRef              = useRef(false);
  // Tracks physical x/X hold state (keyboard: real keydown/keyup, not the
  // browser's native auto-repeat; gamepad: button-x press / toggle-release)
  // — exposed via isButtonXHeld() so callers whose action isn't itself a
  // keyboard/gamepad event (e.g. a movement step reported from elsewhere)
  // can still gate on "is x currently held" without their own tracking.
  const xHeldRef              = useRef(false);
  // Keyboard-only long-press tracking for Escape/Space (onCancelLong) — kept
  // per-instance (not routed through the module-level gamepad _emit system)
  // so it respects this hook's own captureInput/DOM-capture semantics
  // instead of gamepad's separate _captureListener routing. Layered
  // alongside the existing on-release onCancel exactly like the gamepad
  // side's simulateCancelButton: a short press still fires onCancel on
  // release as always; a long hold fires onCancelLong instead, at the
  // threshold, and onCancelLongRelease (not onCancel) on release.
  const cancelLongTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What had focus when the current cancel press started — see startCancelLongPress. */
  const cancelPressTargetRef  = useRef<HTMLElement | null>(null);
  const cancelLongFiredRef    = useRef(false);
  const onTabForwardRef      = useRef(onTabForward);
  const onTabBackwardRef     = useRef(onTabBackward);
  const onSubTabForwardRef   = useRef(onSubTabForward);
  const onSubTabBackwardRef  = useRef(onSubTabBackward);
  const onSubTabForwardReleaseRef  = useRef(onSubTabForwardRelease);
  const onSubTabBackwardReleaseRef = useRef(onSubTabBackwardRelease);
  const onRecommendRef       = useRef(onRecommend);
  const onSkillCycleRef      = useRef(onSkillCycle);
  const onPickUpRef          = useRef(onPickUp);
  const onPickUpReleaseRef   = useRef(onPickUpRelease);
  const onSwipeNavigateRef   = useRef(onSwipeNavigate);
  const onCursorTabHopRef    = useRef(onCursorTabHop);
  const enabledRef           = useRef(enabled);
  /** Stable per-instance identity, used to tell whether THIS instance is the one
   *  holding the exclusive input claim (see _liveClaim). */
  const instanceTokenRef     = useRef({});
  const instanceToken        = instanceTokenRef.current;
  const focusScopeRef        = useRef(focusScope);
  focusScopeRef.current      = focusScope;
  /** Timestamp of the last fired confirm (used for double-tap detection). */
  const lastConfirmMsRef     = useRef(0);
  /** Pending single-confirm, held open in case a second press makes it a double. */
  const confirmDeferRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Resolve one confirm press — Enter or gamepad A, the same rule for both.
   *
   * A hook that binds only one of the two acts immediately: there is nothing to
   * wait for. A hook that binds BOTH has an ambiguous press on its hands, and
   * the honest reading of it is not available yet — so the single action is
   * held for the double window instead of being fired and then contradicted.
   * That is exactly what the card's mouse handler already does to tell a click
   * from a double-click, and the keyboard should not mean something different.
   *
   * The case that forced it: on the card embedded in the detail sidebar, a
   * quick double is "make this big" and a deliberate second press is "let me
   * work the controls". Acting on the first press made the quick double
   * unreachable — you were always already inside the card by the time the
   * second press landed.
   */
  const resolveConfirm = useCallback((consume?: () => void) => {
    const now = Date.now();
    const isDouble = !!onDoubleConfirmRef.current && (now - lastConfirmMsRef.current < DOUBLE_CONFIRM_MS);
    lastConfirmMsRef.current = isDouble ? 0 : now;

    if (isDouble) {
      if (confirmDeferRef.current) { clearTimeout(confirmDeferRef.current); confirmDeferRef.current = null; }
      consume?.();
      onDoubleConfirmRef.current!();
      return;
    }
    if (!onConfirmRef.current) return;
    consume?.();
    if (onDoubleConfirmRef.current) {
      confirmDeferRef.current = setTimeout(() => {
        confirmDeferRef.current = null;
        onConfirmRef.current?.();
      }, DOUBLE_CONFIRM_MS);
    } else {
      onConfirmRef.current();
    }
  }, []);

  // A press left waiting when the hook goes away must not fire into a card that
  // is no longer there.
  useEffect(() => () => {
    if (confirmDeferRef.current) { clearTimeout(confirmDeferRef.current); confirmDeferRef.current = null; }
  }, []);

  // Keep refs current on every render.
  onNavigateRef.current       = onNavigate;
  onMoveRef.current           = onMove;
  onWarpRef.current           = onWarp;
  onConfirmRef.current        = onConfirm;
  onDoubleConfirmRef.current  = onDoubleConfirm;
  onConfirmLongRef.current        = onConfirmLong;
  shortcutsRef.current            = shortcuts;
  onConfirmLongReleaseRef.current = onConfirmLongRelease;
  onConfirmReleasedRef.current    = onConfirmReleased;
  onCancelRef.current         = onCancel;
  onCancelLongRef.current        = onCancelLong;
  onCancelLongReleaseRef.current = onCancelLongRelease;
  onToggleRef.current         = onToggle;
  onToggleReleaseRef.current  = onToggleRelease;
  onMenuToggleRef.current     = onMenuToggle;
  onContextMenuRef.current    = onContextMenu;
  onYButtonRef.current        = onYButton;
  onZButtonRef.current        = onZButton;
  onZButtonReleaseRef.current = onZButtonRelease;
  onAimButtonRef.current        = onAimButton;
  onAimButtonReleaseRef.current = onAimButtonRelease;
  onYButtonReleaseRef.current = onYButtonRelease;
  onButtonXRef.current        = onButtonX;
  onButtonXReleaseRef.current = onButtonXRelease;
  onTabForwardRef.current     = onTabForward;
  onTabBackwardRef.current    = onTabBackward;
  onSubTabForwardRef.current  = onSubTabForward;
  onSubTabBackwardRef.current = onSubTabBackward;
  onSubTabForwardReleaseRef.current  = onSubTabForwardRelease;
  onSubTabBackwardReleaseRef.current = onSubTabBackwardRelease;
  onRecommendRef.current      = onRecommend;
  onSkillCycleRef.current     = onSkillCycle;
  onPickUpRef.current         = onPickUp;
  onPickUpReleaseRef.current  = onPickUpRelease;
  onSwipeNavigateRef.current  = onSwipeNavigate;
  onCursorTabHopRef.current   = onCursorTabHop;
  enabledRef.current          = enabled;

  // Shared by both the bubble-phase and captureInput-phase handlers below —
  // starts the Escape/Space long-press timer on keydown (no-op if one is
  // already running, e.g. from OS key-repeat).
  const startCancelLongPress = () => {
    if (cancelLongTimerRef.current !== null) return;
    // Where the press landed. The action resolves on RELEASE (so a long press
    // can be told from a short one), and by then the DOM may have moved on: a
    // card's editor closes on the same Escape's keydown, so the focus at keyup
    // is already the grid behind it. Deciding what the press MEANT from that
    // is deciding it from the consequences of the press. The gamepad never had
    // this problem — nothing runs between its press and its release — which is
    // exactly why B and Escape behaved differently.
    cancelPressTargetRef.current = (document.activeElement as HTMLElement | null) ?? null;
    cancelLongFiredRef.current = false;
    cancelLongTimerRef.current = setTimeout(() => {
      cancelLongTimerRef.current = null;
      cancelLongFiredRef.current = true;
      onCancelLongRef.current?.();
    }, CANCEL_LONG_MS);
  };
  // Resolves the timer on keyup: fires onCancelLongRelease if the long-press
  // already triggered, otherwise the normal onCancel (short-press) — same
  // either/or split as the gamepad side's simulateCancelButton.
  const resolveCancelRelease = () => {
    if (cancelLongTimerRef.current !== null) {
      clearTimeout(cancelLongTimerRef.current);
      cancelLongTimerRef.current = null;
    }
    if (cancelLongFiredRef.current) {
      cancelLongFiredRef.current = false;
      onCancelLongReleaseRef.current?.();
    } else {
      onCancelRef.current?.({ pressedOn: cancelPressTargetRef.current });
    }
    cancelPressTargetRef.current = null;
  };

  // ── Keyboard ────────────────────────────────────────────────────────────────
  // ONE key→action mapping, used by both dispatch modes.
  //
  // This used to be written out twice — a bubble-phase copy and a capture-phase
  // copy, ~370 lines in total — and the two had already drifted: the capture
  // copy silently lacked the A-held "warp" chord and the Cmd+Shift+Opt
  // cursor-tab-hop, so those did nothing in any sidebar or modal. Splitting the
  // mapping per dispatch mode is the same mistake that split it per input
  // device (see the removed captureGamepad option): behaviour belongs in one
  // place, and only *delivery* should differ.
  //
  // What still differs between the modes, and only this:
  //   • capture  — listens in the capture phase, so it sees keys before page
  //                handlers, and swallows what it consumes
  //                (preventDefault + stopImmediatePropagation) so nothing
  //                underneath reacts to the same press. Used for modals,
  //                sidebars and focused widgets that must win.
  //   • bubble   — ordinary listener; consuming a key only prevents the
  //                browser default, letting other handlers still see it.
  // `consume()` below is the single place that distinction lives.
  //
  // useLayoutEffect: in capture mode the listener must be registered
  // synchronously on commit, before paint and before the user can press
  // anything — otherwise there is a window where a situation has changed (e.g.
  // formSituation → 'type-selection') but nothing is capturing yet.
  useLayoutEffect(() => {
    if (!enabled || gamepadOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      // The one routing rule, shared with the gamepad (see _emit): while a claim
      // is live the press goes to it and to nobody else; with no claim it goes
      // to everyone, and each instance's own guards decide.
      const owner = _keyOwner(e);
      const isOwner = owner?.token === instanceToken;
      if (owner && !isOwner) return;

      const target = e.target as HTMLElement;
      const isInputEl = _isTextEditableTarget(e.target);
      if (!isOwner) {
        // The card with inner focus owns everything but the way out.
        if (isAnyCardInnerFocused() && e.key !== 'Escape') return;
        if (ignoreWhenInputFocused && isInputEl) return;
        if (ignoreWhenInSidebar && _isInSidebar(target)) return;
      }

      // Mark this key as ours. In capture mode that also means stopping it
      // reaching anything else.
      const consume = () => {
        e.preventDefault();
        if (captureInput) e.stopImmediatePropagation();
      };

      // Letter shortcuts, before the switch: they are looked up by character
      // rather than matched against a fixed set of named keys, and a caller
      // that has claimed one owns it outright. See `shortcuts`.
      const sc = shortcutsRef.current;
      if (sc && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.repeat) {
        const fn = sc[e.key] ?? sc[e.key.toLowerCase()];
        if (fn) { consume(); fn(); return; }
      }

      switch (e.key) {
        // Navigation — A-held (chord) → onWarp; Shift+Arrow → onMove; plain Arrow → onNavigate.
        // _confirmHeld is driven by real gamepad button 0 (see _pollGamepads) and by
        // software A buttons via simulateConfirmButton — this is the only place a
        // keyboard-dispatched Arrow (physical or software D-pad) can reach onWarp.
        //
        // The !e.shiftKey guard keeps A+D-pad (warp) distinct from A+left-stick
        // (one-step move): _pollLeftStick synthesizes Shift+ArrowX while A is held,
        // and _confirmHeld is true for both chords, so without this the stick's
        // Shift never survives to the onMove branch and every stick nudge warped
        // to the edge. The software D-pad never sets shiftKey, so it still warps.
        case 'ArrowUp':
        case 'ArrowDown': {
          const dir = e.key === 'ArrowUp' ? 'up' : 'down';
          if (_confirmHeld && !e.shiftKey) { if (onWarpRef.current) { consume(); onWarpRef.current(dir); } }
          else {
            const fn = e.shiftKey ? onMoveRef.current : onNavigateRef.current;
            if (fn) { consume(); fn(dir); }
          }
          break;
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          const dir = e.key === 'ArrowLeft' ? 'left' : 'right';
          if (_confirmHeld && !e.shiftKey) {
            if (onWarpRef.current) { consume(); onWarpRef.current(dir); }
          } else if (e.metaKey && e.shiftKey && e.altKey) {
            if (onCursorTabHopRef.current) { consume(); onCursorTabHopRef.current(dir); }
          } else if (e.altKey) {
            if (onSwipeNavigateRef.current) { consume(); onSwipeNavigateRef.current(dir); }
          } else {
            const fn = e.shiftKey ? onMoveRef.current : onNavigateRef.current;
            if (fn) { consume(); fn(dir); }
          }
          break;
        }
        case 'Home':
        case 'End': {
          if (onNavigateRef.current) { consume(); onNavigateRef.current(e.key === 'Home' ? 'home' : 'end'); }
          break;
        }

        // Enter resolves on keyup, so that a double-tap can be detected and so
        // its timing matches the gamepad's A button (which also fires on
        // release). Nothing to do here.
        case 'Enter':
          break;

        // Escape — resolved on keyup like Enter, but the long-press timer has
        // to start now (see onCancelLong). In capture mode the key is also
        // swallowed here so page-level keydown handlers (e.g. a card's
        // collapse-on-Escape) don't act on a press this hook is going to
        // resolve itself.
        case 'Escape':
          if (captureInput && onCancelRef.current) consume();
          if (!e.repeat) startCancelLongPress();
          break;

        // Space is grouped with Escape/Cancel (NOT Enter/Confirm) and always
        // prevents the browser's page-scroll here (scrolling happens on
        // keydown, so deferring to keyup would be too late). A literal space
        // typed into a text field is never hijacked — the isInputEl guard
        // above already returned for those when ignoreWhenInputFocused is set,
        // and this second check covers callers that opt out of it.
        //
        // Neither modifier means anything on Space any more. Shift+Space was
        // the context menu and moved to Shift+Enter, so confirm and its
        // "confirm with options" variant share one key; Alt+Space was the main
        // menu and moved to Alt+Enter, because Space is a printable key and a
        // modifier can rewrite what it produces (macOS makes Option+Space a
        // NO-BREAK SPACE, so that binding never fired there at all).
        case ' ':
          if (isInputEl) break;
          if (!e.altKey && !e.shiftKey) {
            consume();
            if (!e.repeat) startCancelLongPress();
          }
          break;

        // Tab / Shift+Tab. Never stopImmediatePropagation and never
        // preventDefault for plain Tab: browser focus must still move.
        case 'Tab':
          if (e.altKey) {
            // Option+Tab / Option+Shift+Tab → second-level sub-tab navigation.
            e.preventDefault();
            if (e.shiftKey) { onSubTabBackwardRef.current?.(); }
            else            { onSubTabForwardRef.current?.();  }
            return;
          }
          // Skip when a captureTab hook is active — it owns keyboard Tab exclusively.
          if (!captureTab && !_captureTabActive) {
            if (e.shiftKey) { onTabBackwardRef.current?.(); }
            else            { onTabForwardRef.current?.();  }
          }
          return;

        case 'y':
        case 'Y':
          if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            // Track the hold even where nothing binds onYButton; the browser's
            // auto-repeat is not a second press.
            if (!e.repeat) yHeldRef.current = true;
            if (onYButtonRef.current) {
              consume();
              if (!e.repeat) onYButtonRef.current();
            }
          }
          break;

        // Z mode's key. It used to be a second spelling of Y; it is its own
        // channel now, because the mode and the general Y action are not the
        // same thing and sharing a key let them disagree. The module-level
        // hold flag is updated by the capture-phase listener above, ahead of
        // this, so it is right even where nothing binds onZButton.
        case 'z':
        case 'Z':
          if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            if (onZButtonRef.current) {
              consume();
              if (!e.repeat) onZButtonRef.current();
            }
          }
          break;

        // Aim mode's key. Never consumed: Command is half of a hundred browser
        // and OS chords, and swallowing it would break every one of them. The
        // hold is what matters and the capture-phase tracker above already has
        // it; this only tells whoever is listening that the mode just began.
        case 'Meta':
          if (!e.repeat) onAimButtonRef.current?.();
          break;


        case 'x':
        case 'X':
          if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            // Track held state unconditionally, even for an instance with no
            // onButtonX of its own — isButtonXHeld() should work for any
            // caller. Only consume when actually acting on it.
            if (!e.repeat) xHeldRef.current = true;
            if (onButtonXRef.current) {
              consume();
              if (!e.repeat) onButtonXRef.current();
            }
          }
          break;

        // Shift alone (no other modifier) — triggers recommend. In capture mode
        // this is scoped to text fields, where the feature is used.
        case 'Shift':
          if (!e.altKey && !e.ctrlKey && !e.metaKey && (!captureInput || isInputEl)) {
            if (onRecommendRef.current) { consume(); onRecommendRef.current(); }
          }
          // The keyboard half of "pick this up". Not consumed and not gated on
          // the modifiers above: Shift going down is also the first half of
          // Shift+Enter and Shift+Arrow, and those must keep working while
          // something is being carried. Repeats are not a second press.
          if (!e.repeat && onPickUpRef.current) onPickUpRef.current();
          break;
      }

    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Held-state bookkeeping must run even for instances that ignore the key.
      if (e.key === 'x' || e.key === 'X') xHeldRef.current = false;
      if (e.key === 'y' || e.key === 'Y' || e.key === 'z' || e.key === 'Z') yHeldRef.current = false;
      if (!enabledRef.current) return;
      const owner = _keyOwner(e);
      const isOwner = owner?.token === instanceToken;
      if (owner && !isOwner) return;

      const target = e.target as HTMLElement;
      const isInputEl = _isTextEditableTarget(e.target);
      if (!isOwner) {
        if (ignoreWhenInputFocused && isInputEl) return;
        if (ignoreWhenInSidebar && _isInSidebar(target)) return;
      }

      const consume = () => {
        e.preventDefault();
        if (captureInput) e.stopImmediatePropagation();
      };

      switch (e.key) {
        // Letting go of Shift puts down whatever it picked up. The keyboard
        // half only: releasing A after a long press deliberately keeps the
        // carry alive, so a one-finger touch flow can let go and then work the
        // D-pad. See onPickUpRelease.
        case 'Shift':
          if (onPickUpReleaseRef.current) onPickUpReleaseRef.current();
          break;

        // The three things Enter can mean, in one place: plain confirms,
        // Shift confirms with a choice of action, Alt opens the main menu.
        // None of the modified ones may fall through to resolveConfirm — a
        // modified press followed by a plain one would read as a double-tap.
        case 'Enter': {
          if (isInputEl) return;   // Enter belongs to the field being typed in
          // …and it still belongs to it when the field answered on keydown and
          // closed itself, which is what every type-a-name-and-submit prompt on
          // the board does. The check above cannot see that: its input is
          // already unmounted and this keyup is landing on <body>. Escape has
          // had its own version of this since cancelPressTargetRef (see
          // startCancelLongPress) — same reasoning, one half of a press must
          // not be read from the consequences of the other half.
          if (_pressStartedInTextField('Enter')) return;
          // The main menu. On Enter rather than Space because a modifier can
          // rewrite the character a printable key produces and Space is
          // printable — macOS turns Option+Space into U+00A0 NO-BREAK SPACE,
          // which is what made the old Alt+Space binding do nothing at all
          // there. Enter prints nothing, so nothing can rewrite it.
          if (e.altKey) {
            if (onMenuToggleRef.current) { consume(); onMenuToggleRef.current(); }
            break;
          }
          // Shift+Enter is the context menu ("confirm, but let me pick which
          // action").
          if (e.shiftKey) {
            if (onContextMenuRef.current) { consume(); onContextMenuRef.current(); }
            break;
          }
          resolveConfirm(consume);
          break;
        }

        // Escape and plain Space are equivalent — both resolve through
        // resolveCancelRelease (onCancel for a short press, onCancelLong /
        // onCancelLongRelease for a held one).
        case 'Escape':
        case ' ': {
          if (e.key === ' ') {
            if (e.altKey || e.shiftKey) break;  // neither modifier is bound on Space
            if (isInputEl) return;              // no timer was started for this at keydown
          }
          // Centralized Escape-to-blur for the interact input.
          if (isInputEl && target.hasAttribute?.('data-interact-input')) {
            if (cancelLongTimerRef.current !== null) {
              clearTimeout(cancelLongTimerRef.current);
              cancelLongTimerRef.current = null;
            }
            cancelLongFiredRef.current = false;
            target.blur();
            consume();
          } else if (onCancelRef.current || onCancelLongRef.current) {
            consume();
            resolveCancelRelease();
          }
          break;
        }

        case 'x':
        case 'X':
          if (onButtonXReleaseRef.current) { consume(); onButtonXReleaseRef.current(); }
          break;

        case 'y':
        case 'Y':
          if (onYButtonReleaseRef.current) { consume(); onYButtonReleaseRef.current(); }
          break;

        case 'z':
        case 'Z':
          if (onZButtonReleaseRef.current) { consume(); onZButtonReleaseRef.current(); }
          break;

        case 'Meta':
          onAimButtonReleaseRef.current?.();
          break;

      }
    };

    const handleBlur = () => { xHeldRef.current = false; yHeldRef.current = false; };

    window.addEventListener('keydown', handleKeyDown, captureInput);
    window.addEventListener('keyup',   handleKeyUp,   captureInput);
    window.addEventListener('blur',    handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, captureInput);
      window.removeEventListener('keyup',   handleKeyUp,   captureInput);
      window.removeEventListener('blur',    handleBlur);
    };
  }, [enabled, captureInput, gamepadOnly, captureTab, ignoreWhenInputFocused, ignoreWhenInSidebar]);

  // ── captureTab: capture-phase listener that owns keyboard Tab exclusively ─────
  // useLayoutEffect so _captureTabActive is set synchronously after React commits,
  // before any keydown event can arrive.  While active, the form-level captureInput
  // handler skips keyboard Tab (checked via _captureTabActive flag) so there is no
  // double-call to navigateFormTab.
  useLayoutEffect(() => {
    if (!enabled || !captureTab) return;

    _captureTabActive = true;

    const handleTabCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (!enabledRef.current) return;
      const target = e.target as HTMLElement;
      if (ignoreWhenInputFocused && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (ignoreWhenInSidebar && _isInSidebar(target)) return;
      e.preventDefault();
      if (e.shiftKey) { onTabBackwardRef.current?.(); }
      else            { onTabForwardRef.current?.();  }
    };

    window.addEventListener('keydown', handleTabCapture, true);

    return () => {
      window.removeEventListener('keydown', handleTabCapture, true);
      _captureTabActive = false;
    };
  }, [enabled, captureTab, ignoreWhenInputFocused, ignoreWhenInSidebar]);

  // ── Touch swipe (touch devices) ──────────────────────────────────────────────
  // Fires onSwipeNavigate with unified direction semantics:
  //   swipe LEFT  (dx < 0) → 'right' (advance/next) — matches carousel convention
  //   swipe RIGHT (dx > 0) → 'left'  (back/prev)
  // Only fires when the gesture is primarily horizontal:
  //   |dx| ≥ SWIPE_MIN_PX  AND  |dy| < |dx| * SWIPE_H_RATIO  (≈within ±34°)
  // Set disableTouchSwipe: true on components that already have their own
  // element-level touch handler (e.g. RecipeSlideDeck) to avoid double-firing.
  useEffect(() => {
    if (!enabled || !onSwipeNavigate || disableTouchSwipe) return;

    const SWIPE_MIN_PX   = 50;   // minimum horizontal distance to count as a swipe
    const SWIPE_H_RATIO  = 0.65; // |dy| must be < 65% of |dx| to be "horizontal"

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current) return;
      if (ignoreWhenInputFocused && _isInputFocused()) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN_PX) return;
      if (Math.abs(dy) >= Math.abs(dx) * SWIPE_H_RATIO) return;
      // Invert: swipe left (dx < 0) → 'right' (advance) to match keyboard/gamepad convention
      onSwipeNavigateRef.current?.(dx < 0 ? 'right' : 'left');
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend',   handleTouchEnd,   { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [enabled, onSwipeNavigate, disableTouchSwipe, ignoreWhenInputFocused]);

  // ── Gamepad ───────────────────────────────────────────────────────────────────
  // useLayoutEffect (not useEffect) ensures the claim is released
  // synchronously after React's commit, before the next requestAnimationFrame
  // poll fires.  With useEffect the cleanup runs after paint, leaving a window
  // where the claim still points at a disabled handler and swallows all
  // gamepad input.
  useLayoutEffect(() => {
    if (!enabled) return;

    const handleGamepadAction = (action: GamepadActionType) => {
      if (!enabledRef.current) return;
      // The same rule the keyboard now follows: the instance the claim was
      // handed to answers unguarded; anyone reached by a broadcast is guarded.
      // Asked of the live claim rather than of the captureInput flag, because a
      // capturing instance whose claim has gone stale is reached by broadcast
      // like everyone else and must be guarded like everyone else.
      if (_liveClaim()?.token !== instanceToken) {
        // A held mode's directions arrive before the guards below, and only
        // those: while a ring is up on the board the D-pad belongs to it,
        // wherever focus is sitting. See heldModeAnswers, which explains why
        // this is a gamepad-only problem.
        const heldModeDirection =
          NAV_ACTIONS.has(action) && heldModeAnswers(CANVAS_ACTIONS.NAVIGATE);
        if (!heldModeDirection) {
          if (ignoreWhenInputFocused && _isInputFocused()) return;
          if (ignoreWhenInSidebar && _isInSidebar()) return;
          // A card being operated owns its own directions, exactly as it owns
          // the arrow keys (see the keyboard handler's inner-focus line).
          // Without this the two devices disagreed inside a card: an arrow key
          // walked the card's own controls, while the D-pad went past it to
          // whatever was behind — on the board, the want focus moved out from
          // under the card the user was editing.
          //
          // Directions only, not every action. The keyboard drops all of them
          // here and lets Escape through; matching that exactly would silence
          // gamepad bindings that work today (a plugin's X, say) for no reason
          // the user asked for. What was asked for is that up/down/left/right
          // mean the same thing on both devices, so that is what this covers.
          //
          // Nothing is lost by dropping it: an unconsumed direction becomes the
          // arrow key it stands for (see _fallBackToArrowKey), which is how it
          // reaches the card's inner-focus ring — the same walk the arrow keys
          // take, through the same code.
          if (isAnyCardInnerFocused() && NAV_ACTIONS.has(action)) return;
        }
      }

      switch (action) {
        case 'up':
        case 'down':
        case 'left':
        case 'right':
        case 'home':
        case 'end':
          // Flagged here, past this instance's guards, rather than at binding
          // time: a handler that was skipped because focus is in a sidebar (or
          // in a text field) has not consumed anything, and treating it as if
          // it had would swallow the arrow-key fallback in _emit.
          if (onNavigateRef.current) { _navActionConsumed = true; onNavigateRef.current(action); }
          break;
        case 'warp-up':    onWarpRef.current?.('up');    break;
        case 'warp-down':  onWarpRef.current?.('down');  break;
        case 'warp-left':  onWarpRef.current?.('left');  break;
        case 'warp-right': onWarpRef.current?.('right'); break;
        case 'confirm': {
          resolveConfirm();
          break;
        }
        case 'confirm-long':
          // Route to onRecommend when provided; otherwise fall through to onConfirmLong.
          onRecommendRef.current ? onRecommendRef.current() : onConfirmLongRef.current?.();
          // The pad's half of "pick this up" — the same gesture Shift is on the
          // keyboard. Alongside the two above rather than instead of them: a
          // hold means one thing to whoever asked for a hold and another to
          // whoever asked to carry something, and no instance asks for both.
          onPickUpRef.current?.();
          break;
        case 'confirm-long-release': onConfirmLongReleaseRef.current?.(); break;
        case 'confirm-released': onConfirmReleasedRef.current?.(); break;
        case 'recommend':    onRecommendRef.current?.();   break;
        case 'skill-next':   onSkillCycleRef.current?.(1);  break;
        case 'skill-prev':   onSkillCycleRef.current?.(-1); break;
        case 'cancel':        onCancelRef.current?.({ pressedOn: _cancelPressTarget }); break;
        case 'cancel-long':        onCancelLongRef.current?.();        break;
        case 'cancel-long-release': onCancelLongReleaseRef.current?.(); break;
        case 'toggle':         onToggleRef.current?.();        break;
        // toggle-release is gamepad X/Square's release (see button-x below
        // for the matching press) — clear held state unconditionally, same
        // reasoning as the keyboard 'x' case.
        case 'toggle-release':    xHeldRef.current = false; onToggleReleaseRef.current?.(); break;
        case 'button-x':          xHeldRef.current = true; onButtonXRef.current?.();       break;
        case 'button-x-release':  onButtonXReleaseRef.current?.();                         break;
        case 'menu-toggle':  onMenuToggleRef.current?.();  break;
        case 'context-menu': onContextMenuRef.current?.(); break;
        case 'y-button':         yHeldRef.current = true;  onYButtonRef.current?.();        break;
        case 'y-button-release': yHeldRef.current = false; onYButtonReleaseRef.current?.(); break;
        case 'z-button':         onZButtonRef.current?.();        break;
        case 'z-button-release': onZButtonReleaseRef.current?.(); break;
        case 'aim-button':         onAimButtonRef.current?.();        break;
        case 'aim-button-release': onAimButtonReleaseRef.current?.(); break;
        case 'tab-forward':
          if (onTabForwardRef.current) { _tabActionConsumed = true; onTabForwardRef.current(); }
          break;
        case 'tab-backward':
          if (onTabBackwardRef.current) { _tabActionConsumed = true; onTabBackwardRef.current(); }
          break;
        case 'sub-tab-forward':  onSubTabForwardRef.current?.();  break;
        case 'sub-tab-backward': onSubTabBackwardRef.current?.(); break;
        case 'sub-tab-forward-release':  onSubTabForwardReleaseRef.current?.();  break;
        case 'sub-tab-backward-release': onSubTabBackwardReleaseRef.current?.(); break;
        case 'swipe-left':  onSwipeNavigateRef.current?.('left');  break;
        case 'swipe-right': onSwipeNavigateRef.current?.('right'); break;
      }
    };

    _registerListener(handleGamepadAction);
    if (captureInput) {
      _pushCapture({
        token: instanceToken,
        listener: handleGamepadAction,
        // Read through the ref so a later render's closure is used, rather than
        // freezing whichever one happened to claim.
        scope: focusScopeRef.current ? () => focusScopeRef.current!() : null,
      });
    }

    return () => {
      _unregisterListener(handleGamepadAction);
      _popCapture(instanceToken);
    };
  }, [enabled, captureInput, gamepadOnly, ignoreWhenInputFocused, ignoreWhenInSidebar]);

  // Z mode's hold is NOT here: it is the module-level flag isZHeld() reads,
  // for the reason that flag's own comment gives — a per-instance ref desyncs
  // the moment a capture-phase consumer swallows the release. This one is only
  // the Y button's own press state, which no overlay consumes that way.
  return { isButtonXHeld: () => xHeldRef.current, isButtonYHeld: () => yHeldRef.current };
}
