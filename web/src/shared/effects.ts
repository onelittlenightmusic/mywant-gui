// X-press effect framework — one framework-agnostic source rendered identically
// by mywant-gui's canvas (React host) and the browser-extension overlay
// (vanilla, spliced into cursor-overlay.generated.js by build-shared-visuals.js).
//
// Add a new effect by appending one entry to effectDefs() (plus its spawn/css
// helper functions here) — both the dashboard and external tabs pick it up.
//
// EVERY function below must be SELF-CONTAINED (no imports, no module-scope refs
// except calling the OTHER exported functions by bare name). build-shared-visuals
// splices each as a standalone `var name = function ...`, and the overlay wires
// them as siblings, so cross-references between these functions are fine but a
// reference to any non-spliced module scope would be a ReferenceError in-page.

export interface EffectDef {
  /** Want type this effect renders for (e.g. 'heart_effect'). */
  type: string;
  durationMs: number;
  defaultParams: Record<string, string>;
  /** This effect's CSS (keyframes + class). Injected once per surface. */
  css: () => string;
  /** Create the animated DOM at (x, y) inside container; auto-removes itself. */
  spawn: (container: HTMLElement, x: number, y: number, position?: 'absolute' | 'fixed') => void;
  /** Optional side-effect on trigger (e.g. sound). */
  onTrigger?: () => void;
}

// ── SVG markup ────────────────────────────────────────────────────────────────

export function heartInnerSvgMarkup(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
}

export function chimeInnerSvgMarkup(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>';
}

// ── CSS ───────────────────────────────────────────────────────────────────────

export function heartCss(): string {
  return '@keyframes mw-heart-float-up{0%{transform:translate(-50%,0) scale(0.5);opacity:0}20%{transform:translate(-50%,-20px) scale(1.3);opacity:1}100%{transform:translate(-50%,-90px) scale(0.8);opacity:0}}'
    + '.mw-heart-effect{position:absolute;pointer-events:none;color:#ff4b72;fill:#ff4b72;animation:mw-heart-float-up 1s cubic-bezier(0.18,0.89,0.32,1.28) forwards;}';
}

export function chimeCss(): string {
  return '@keyframes mw-chime-sparkle{0%{transform:translate(-50%,-50%) scale(0.4);opacity:0}25%{transform:translate(-50%,-70%) scale(1.4);opacity:1}100%{transform:translate(-50%,-110%) scale(0.6);opacity:0}}'
    + '.mw-chime-effect{position:absolute;pointer-events:none;color:#f59e0b;fill:#f59e0b;animation:mw-chime-sparkle 0.8s cubic-bezier(0.18,0.89,0.32,1.28) forwards;}';
}

export function fireworksCss(): string {
  return '@keyframes mw-fireworks-particle{0%{transform:translate(-50%,-50%) scale(1.2);opacity:1}60%{opacity:0.8}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(0.2);opacity:0}}'
    + '.mw-fireworks-particle{position:absolute;pointer-events:none;border-radius:50%;animation:mw-fireworks-particle var(--duration) cubic-bezier(0.2,0.8,0.4,1) forwards;}';
}

// ── Spawners ──────────────────────────────────────────────────────────────────

export function spawnHeart(container: HTMLElement, x: number, y: number, position?: 'absolute' | 'fixed'): void {
  var el = document.createElement('div');
  el.className = 'mw-heart-effect';
  el.style.position = position || 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.zIndex = '70';
  el.innerHTML = heartInnerSvgMarkup();
  container.appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1000);
}

export function spawnChime(container: HTMLElement, x: number, y: number, position?: 'absolute' | 'fixed'): void {
  var el = document.createElement('div');
  el.className = 'mw-chime-effect';
  el.style.position = position || 'absolute';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.zIndex = '70';
  el.innerHTML = chimeInnerSvgMarkup();
  container.appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
}

export function spawnFireworks(container: HTMLElement, x: number, y: number, position?: 'absolute' | 'fixed'): void {
  var colors = ['#ff4b72', '#ff8c00', '#ffd700', '#44dd66', '#4488ff', '#cc44ff', '#ff44cc', '#00ccdd'];
  var count = 16;
  for (var i = 0; i < count; i++) {
    var angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    var dist = 55 + Math.random() * 55;
    var size = 5 + Math.random() * 6;
    var dur = 0.7 + Math.random() * 0.5;
    var p = document.createElement('div');
    p.className = 'mw-fireworks-particle';
    p.style.position = position || 'absolute';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.zIndex = '70';
    p.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
    p.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
    p.style.setProperty('--duration', dur + 's');
    container.appendChild(p);
    (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1400); })(p);
  }
}

// ── Sound (vanilla Web Audio, so it works on external tabs too) ────────────────

export function chimeSound(): void {
  try {
    var w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    var Ctx = w.AudioContext || w.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    var notes = [880, 1108.73, 1318.51];
    var t0 = ctx.currentTime;
    for (var i = 0; i < notes.length; i++) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = notes[i];
      var start = t0 + i * 0.06;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.42);
    }
    setTimeout(function () { try { ctx.close(); } catch (e) { /* ignore */ } }, 700);
  } catch (e) { /* audio unavailable */ }
}

/**
 * Short tick — same synth as the dashboard's card-to-card move sound
 * (web/src/utils/sounds.ts's gridMove), reimplemented standalone here so the
 * browser-extension overlay can play it too. Used for CursorMan tab hops
 * (explicit B+L1/R1 and auto-follow) — a tab switch is the extension's
 * equivalent of moving between want cards.
 */
export function gridMoveSound(): void {
  try {
    var w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    var Ctx = w.AudioContext || w.webkitAudioContext;
    if (!Ctx) return;
    var ctx = new Ctx();
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.055);
    gain.gain.setValueAtTime(0.13, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    osc.start(t);
    osc.stop(t + 0.06);
    setTimeout(function () { try { ctx.close(); } catch (e) { /* ignore */ } }, 200);
  } catch (e) { /* audio unavailable */ }
}

// ── Registry ──────────────────────────────────────────────────────────────────

export function effectDefs(): EffectDef[] {
  var trig = { input_button: 'button-x', input_action: 'trigger' };
  return [
    { type: 'heart_effect', durationMs: 1000, defaultParams: trig, css: heartCss, spawn: spawnHeart },
    { type: 'fireworks_effect', durationMs: 1400, defaultParams: trig, css: fireworksCss, spawn: spawnFireworks },
    { type: 'chime_effect', durationMs: 800, defaultParams: trig, css: chimeCss, spawn: spawnChime, onTrigger: chimeSound },
  ];
}

/** All effect CSS concatenated — inject once per surface. */
export function allEffectCss(): string {
  return effectDefs().map(function (d) { return d.css(); }).join('');
}
