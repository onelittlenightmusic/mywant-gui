/**
 * sounds.ts — Web Audio API sound effects.
 *
 * All sounds are synthesized in-browser (no audio files).
 *
 * Safari-specific notes:
 *   - Desktop Safari suspends AudioContext after ~30s of inactivity even if the
 *     page is visible. We work around this by awaiting resume() before scheduling
 *     any audio nodes, and by recreating the context if resume() rejects.
 *   - iOS Safari suspends on background transition; the touchstart/pointerdown
 *     listeners below proactively resume on the next user gesture.
 */

import { rumbleTap } from '@/lib/controllerHub';

let _ctx: AudioContext | null = null;
// De-duplicates concurrent resume() calls so we only call it once at a time.
let _resumeInFlight: Promise<void> | null = null;

import { SOUND_CATALOG, type CatalogSound, type SoundDef } from './soundCatalog';

// ── iOS silent-WAV session upgrade ───────────────────────────────────────────
// Playing a silent <audio> element inside a gesture upgrades the audio session
// category to "playback", making Web Audio API sounds audible at media volume.
const _SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
let _sessionUpgraded = false;

function _upgradeAudioSession(): void {
  if (_sessionUpgraded) return;
  _sessionUpgraded = true;
  const audio = document.createElement('audio');
  audio.src = _SILENT_WAV;
  audio.volume = 0.001;
  audio.play().catch(() => {
    _sessionUpgraded = false;
  });
}

// ── Core: get a guaranteed-running AudioContext ───────────────────────────────
/**
 * Returns a running AudioContext, or null if unavailable.
 *
 * Awaiting this function guarantees that when it resolves the context is in
 * 'running' state, so it is safe to schedule audio nodes immediately after.
 *
 * If resume() rejects (Safari stale-context case) the context is closed and
 * nulled; the next call will recreate it fresh.
 */
async function ensureRunning(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ctx || _ctx.state === 'closed') {
      _ctx = new (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      _resumeInFlight = null;
    }

    if (_ctx.state === 'running') return _ctx;

    // Suspended (or 'interrupted' on iOS) — resume once, deduplicated.
    if (!_resumeInFlight) {
      _resumeInFlight = _ctx
        .resume()
        .then(() => {
          _resumeInFlight = null;
        })
        .catch(async () => {
          // Safari sometimes refuses resume() on a stale context.
          // Close it so the next ensureRunning() call recreates it.
          _resumeInFlight = null;
          try {
            await _ctx?.close();
          } catch {
            /* ignore */
          }
          _ctx = null;
        });
    }

    await _resumeInFlight;
    return _ctx && (_ctx.state as string) === 'running' ? _ctx : null;
  } catch {
    return null;
  }
}

// ── Proactive resume listeners ────────────────────────────────────────────────
// Attempt a best-effort (non-awaited) resume whenever the user returns to the
// page, so the context is likely running before the next playSound() call.
function _tryResumeEager(): void {
  if (_ctx && (_ctx.state === 'suspended' || (_ctx.state as string) === 'interrupted')) {
    _ctx.resume().catch(() => {});
  }
}

function _setupListeners(): void {
  if (typeof window === 'undefined') return;

  // iOS: upgrade audio session + resume on first touch inside gesture.
  // Also pre-create the AudioContext on first gesture so that sounds triggered
  // by non-gesture events (e.g. robot cursor driven by CLI polling) can play
  // immediately without waiting for the lazy ensureRunning() call.
  const onGesture = () => {
    _upgradeAudioSession();
    // Pre-create context inside gesture if not yet created — this puts it in
    // 'running' state immediately so later non-gesture playSound() calls work.
    if (!_ctx || _ctx.state === 'closed') {
      try {
        _ctx = new (window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext)();
        _resumeInFlight = null;
      } catch { /* ignore */ }
    }
    _tryResumeEager();
  };
  window.addEventListener('touchstart', onGesture, { passive: true });
  window.addEventListener('pointerdown', onGesture, { passive: true });
  // Keys count as a gesture too, and this app is driven by them.
  //
  // Without this, unlocking audio depended on playSound happening to call
  // resume() synchronously inside the keydown handler — true today, but only by
  // accident of how ensureRunning is written, and silently false the moment a
  // caller defers. Pre-warming on the key itself makes it a fact rather than a
  // coincidence.
  //
  // Note what this still cannot fix: THE GAMEPAD. Pad input is polled from a
  // rAF loop, not delivered as an event, and no browser counts it as user
  // activation — so a session driven only by the pad from a fresh load stays
  // silent until a key, click or tap happens once. That is a browser rule, not
  // something this file can work around.
  window.addEventListener('keydown', onGesture, { passive: true });

  // Tab/window focus restored
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) _tryResumeEager();
  });
  // Back-forward cache restore (Safari bfcache)
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) _tryResumeEager();
  });
  // Window re-focused after alt-tab / app switch
  window.addEventListener('focus', _tryResumeEager);
}

_setupListeners();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * The names and the waveforms both come from the catalogue — one entry per
 * sound, so adding one cannot leave a name without a waveform or a waveform
 * nothing reaches. This file is only concerned with whether a sound plays at
 * all: the audio session, the mute flag, the de-duplication, the haptics.
 */
/**
 * Sounds an extension adds, by name — declared by the extension, which merges
 * its names into this interface (`declare module '@/utils/sounds'`) and hands
 * the sounds themselves to registerSounds. Empty in this app: every sound it
 * plays is in its catalogue.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExtensionSounds {}

/** Every sound that can be played: the catalogue's, and the extensions'. */
export type SoundEvent = CatalogSound | keyof ExtensionSounds;

const _extensionSounds = new Map<string, SoundDef>();

/**
 * Add sounds, for an extension whose moments this app does not have — the
 * canvas's footsteps, say. A name the catalogue already has is not replaced.
 */
export function registerSounds(defs: Record<string, SoundDef>): void {
  for (const [name, def] of Object.entries(defs)) {
    if (!(name in SOUND_CATALOG)) _extensionSounds.set(name, def);
  }
}

function soundDef(event: SoundEvent): SoundDef | undefined {
  return (SOUND_CATALOG as Record<string, SoundDef>)[event] ?? _extensionSounds.get(event);
}

let _soundEnabled = true;

export function setSoundEnabledFlag(enabled: boolean): void {
  _soundEnabled = enabled;
}

/**
 * Play a sound effect. Fire-and-forget safe to call from any event handler.
 *
 * Internally awaits ensureRunning() so the AudioContext is guaranteed to be in
 * 'running' state before audio nodes are scheduled — this fixes the Safari
 * inactivity-suspension bug where resume() was previously called without await.
 */
/**
 * The events that also buzz the controller.
 *
 * The ones that mean "input just went somewhere" — into a panel or a menu, and
 * one level deeper into a choice or into a card that has taken the screen. Not
 * the step tick: it fires on every card you walk past, and a pad that buzzes
 * continuously while you move stops meaning anything. Not the way out either —
 * the arrival is the part worth feeling.
 *
 * cardMaximize is listed even though it shares confirmIn's waveform, because
 * membership is by event and not by sound; picking a page from the menu speaks
 * as cardMaximize, and leaving it out would have quietly dropped that buzz.
 */
const HAPTIC_EVENTS = new Set<SoundEvent>(['handoverIn', 'confirmIn', 'cardMaximize']);

// Last time each event was played, for the dedupe in playSound below.
const _lastPlayedAt = new Map<SoundEvent, number>();
/**
 * How close together two of the same sound have to be to count as one.
 *
 * Long enough to cover a single press being answered by two handlers, short
 * enough that a deliberate repeat — walking a grid, holding a direction — still
 * ticks every time. The fastest auto-repeat in the app is the stick's 32ms
 * (STICK_FAST_REPEAT_MS), so this has to stay under that.
 */
const DEDUPE_MS = 30;

/**
 * How long a sound takes from being asked for to being heard, in ms — the
 * audio context's own report where the browser gives one (outputLatency +
 * baseLatency), else a typical figure. For playing a sound early so that it
 * lands on a moment rather than after it (see whenCursorLands).
 */
export function audioLatencyMs(): number {
  const c = _ctx as (AudioContext & { outputLatency?: number }) | null;
  const s = c ? (c.outputLatency ?? 0) + (c.baseLatency ?? 0) : 0;
  const ms = s > 0 ? s * 1000 : 50;
  return Math.max(0, Math.min(150, ms));
}

export function playSound(event: SoundEvent): void {
  if (!_soundEnabled) return;
  // A name nobody registered — an extension that is not installed — is silence.
  const def = soundDef(event);
  if (!def) return;
  // One press, one sound.
  //
  // Some presses are legitimately handled by two layers at once — B while a
  // card's controls are open leaves the controls AND the panel, and each says
  // so. Two handlers is a real thing that happened, but two copies of the same
  // sound a millisecond apart is just a flam; it reads as a glitch rather than
  // as two events. Nothing about the behaviour changes here — both handlers
  // still run — only the second identical noise is dropped.
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const last = _lastPlayedAt.get(event);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  _lastPlayedAt.set(event, now);

  // Haptics ride along with the sound, and deliberately ahead of it.
  //
  // Here rather than at the events' own call sites for the reason the sounds
  // themselves ended up here: going into a panel and committing to something
  // each happen through several routes, and anything written per-route is
  // silent on the route added next.
  //
  // Ahead of the audio because it does not share the audio's problem. A
  // browser refuses to start an AudioContext until the page has seen a click
  // or a key, and gamepad input is neither — so a session driven from a cold
  // load by the pad alone hears nothing (see _setupListeners). Rumble needs no
  // such permission, which makes it the one feedback that always lands.
  //
  // It does respect the mute above: that is the user asking for no feedback,
  // not the browser withholding it.
  if (HAPTIC_EVENTS.has(event)) rumbleTap();

  // Already running: play now, in this call, not in a .then.
  //
  // A .then is a microtask, and a key press that also sets React state has
  // React's own render queued as a microtask ahead of it — so the sound waited
  // for the whole re-render the step caused, and a footstep asked for as the
  // character set off was heard as they arrived.
  if (_ctx && _ctx.state === 'running') {
    try {
      def.play(_ctx);
      window.dispatchEvent(new CustomEvent('mywant:sound', { detail: event }));
    } catch {
      /* silently ignore audio errors */
    }
    return;
  }

  ensureRunning()
    .then((c) => {
      if (!c) return;
      try {
        def.play(c);
        // Say what was played, for anything that needs to observe it.
        //
        // Sound is the one part of this UI that leaves no trace to assert on,
        // and it carries real meaning here — which way input just moved. The
        // regression suite used to infer it from the shape of the audio graph
        // ("three triangle oscillators, so that was the sparkle"), which broke
        // every time a sound was retuned and could not tell two sounds of the
        // same shape apart at all.
        //
        // Dispatched after the handler, not before: this reports what actually
        // reached the speakers, so a sound blocked by the autoplay policy stays
        // visibly absent rather than being reported as played.
        window.dispatchEvent(new CustomEvent('mywant:sound', { detail: event }));
      } catch {
        /* silently ignore audio errors */
      }
    })
    .catch(() => {/* ignore */});
}
