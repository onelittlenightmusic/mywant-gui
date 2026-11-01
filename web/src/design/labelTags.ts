/**
 * A label as a hang tag (荷札): a coloured tag with its hole and string —
 * the label section's cards (LabelsSection).
 *
 * The colour is the key's: one of a few soft colours, picked from the key's
 * name, so the same label wears the same tag on every want and thing. Each
 * tone is written out whole, class by class, for Tailwind to find.
 */
export interface LabelTone {
  /** The tag's face. */
  face: string;
  /** The darker edge under it — the tag's thickness. */
  edge: string;
  /** Its words: the key small, the value large. */
  ink: string;
}

const TONES: LabelTone[] = [
  { face: 'bg-[#ffd9e2] dark:bg-[#5c2b3a]', edge: 'shadow-[0_2px_0_#f2b3c2] dark:shadow-[0_2px_0_#3d1a26]', ink: 'text-[#7a2340] dark:text-[#ffd9e2]' },
  { face: 'bg-[#d4f1e2] dark:bg-[#1f4a37]', edge: 'shadow-[0_2px_0_#a9dcc2] dark:shadow-[0_2px_0_#123224]', ink: 'text-[#1f5b40] dark:text-[#d4f1e2]' },
  { face: 'bg-[#dbe8ff] dark:bg-[#26385e]', edge: 'shadow-[0_2px_0_#b3caf2] dark:shadow-[0_2px_0_#17243f]', ink: 'text-[#24427a] dark:text-[#dbe8ff]' },
  { face: 'bg-[#fff0bf] dark:bg-[#4f3f12]', edge: 'shadow-[0_2px_0_#ecd68a] dark:shadow-[0_2px_0_#33280a]', ink: 'text-[#6a4b06] dark:text-[#fff0bf]' },
  { face: 'bg-[#e9defd] dark:bg-[#3d2b5c]', edge: 'shadow-[0_2px_0_#cbb7f2] dark:shadow-[0_2px_0_#271b3d]', ink: 'text-[#4a2a7a] dark:text-[#e9defd]' },
];

/** The tone a label's key wears — the same for the same key, everywhere. */
export function labelTone(key: string): LabelTone {
  let h = 7;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}
