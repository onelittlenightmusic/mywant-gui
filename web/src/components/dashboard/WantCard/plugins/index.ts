// Auto-register every plugin in ./types/ via its self-registration side-effect —
// no per-plugin import line to maintain. To add a want type / effect, just drop
// a file in ./types/ (or, for X-press effects, add an entry to
// web/src/shared/effects.ts — SharedEffectsCanvasPlugins picks it up).
//
// RpgStageViewCardPlugin was never in the import list — keep it inactive.
// Delete a file (or drop its negative pattern) to include it.
//
// DynamicBackgroundCardPlugin used to be excluded here too, on the grounds that
// an image URL already renders generically through FinalResultDisplay's
// isImageUrl(). It is back in: rebuilt on CardFrame, it now says which of its
// two URLs is on screen and how the fetch went, which the generic renderer
// cannot.
import.meta.glob(
  [
    './types/*.tsx',
    '!./types/RpgStageViewCardPlugin.tsx',
  ],
  { eager: true },
);
