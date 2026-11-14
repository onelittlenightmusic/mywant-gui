import { playSound } from './sounds';

/**
 * Short tactile-style click — the 'hapticClick' sound, which is felt as well
 * (its catalogue entry's `feel`): a phone's vibration where there is one, the
 * app's tap, a pad's rumble. playSound does all of it; this is the name the
 * callers know.
 */
export function playHapticClick() {
  playSound('hapticClick');
}
