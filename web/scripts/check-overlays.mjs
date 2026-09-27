#!/usr/bin/env node
/**
 * Every overlay is drawn from the overlay library (src/components/overlay).
 *
 * The library is where an overlay's design lives — its cells, its frame, its
 * tail, how it comes in — and an overlay elsewhere only says what its actions
 * mean. This fails the build when a piece of that design is written out by hand
 * somewhere else, which is how two dozen overlays each came to have their own
 * idea of what one looks like.
 *
 * Usage: node scripts/check-overlays.mjs [srcDir ...]   (default: src)
 * mywant-guiex runs it over its own src from the submodule.
 */
import fs from 'node:fs';
import path from 'node:path';

const RULES = [
  {
    re: /bg-slate-900 border border-slate-600/,
    say: "an overlay's surface — use OverlayBubble, or useOverlayDesign().surface for another shape",
  },
  {
    re: /rgb\(71 85 105\)/,
    say: "an overlay's outline colour (a tail, most likely) — use OverlayBubble, or useOverlayDesign().tailColor",
  },
  {
    re: /['`]quickActions(Btn)?In\b/,
    say: 'an overlay entrance — use useOverlayDesign().enterAnimation / .cellEnterAnimation, or OverlayCell',
  },
];

/** The library itself, and the stylesheet the keyframes are defined in. */
const isExempt = (file) =>
  file.split(path.sep).join('/').includes('/components/overlay/') || file.endsWith('.css');

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
  }
}

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('src');

const problems = [];
for (const root of roots) {
  for (const file of walk(root)) {
    if (isExempt(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.re.test(line)) problems.push(`${file}:${i + 1}: ${rule.say}\n    ${line.trim()}`);
      }
    });
  }
}

if (problems.length > 0) {
  console.error(`Overlay design outside src/components/overlay (${problems.length}):\n`);
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('overlays: ok');
