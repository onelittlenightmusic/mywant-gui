import { playSound } from './sounds';

/**
 * Short tactile-style click — real vibration where supported, otherwise (or
 * in addition) an audio click via sounds.ts's playSound, which already
 * handles iOS's audio-session/mute-switch quirks (see sounds.ts's
 * _upgradeAudioSession) that a bare `new AudioContext()` here would miss.
 *
 * navigator.vibrate is unavailable on every iOS browser, not just Safari —
 * Chrome/Firefox-on-iOS are WebKit under the hood (Apple requires this for
 * App Store distribution), and Apple has never implemented the Vibration API
 * there. The audio click is the only feedback iOS can give; on platforms
 * where real vibration works, both fire together.
 */
export function playHapticClick() {
  playSound('hapticClick');
  navigator.vibrate?.(10);
}
