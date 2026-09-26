import React from 'react';
import { ThingDot } from './ThingDot';

interface Mark {
  color: string;
  /** true = marked as the toggle's "on" default, false = "off" default */
  value: boolean;
}

interface ToggleDefaultBookmarksProps {
  marks: Mark[];
  /** Matches the toggle knob's own compact sizing so the marks line up with it */
  compact: boolean;
}

const MARK_H = 11;
const MARK_W = MARK_H * 0.72;

/**
 * Bookmark badges marking which side (on/off) of a boolean toggle each
 * character has set as their aura-default — not wherever the knob currently
 * sits, so an on-mark and an off-mark stay distinguishable no matter which
 * state the toggle is showing (a DogEarFlags-style single badge can't do this:
 * it has only one position). The on-mark sits at the top-right of the on-knob
 * position; the off-mark at the top-LEFT of the off-knob position — opposite
 * corners, as far apart as possible, so the two are never confused.
 *
 * The shape is the dot every remembered value wears: an X-press both sets this
 * mark and names the value into the thing, so there is one silhouette for both.
 */
export const ToggleDefaultBookmarks: React.FC<ToggleDefaultBookmarksProps> = ({ marks, compact }) => {
  if (marks.length === 0) return null;

  const knobSize = compact ? 18 : 22;
  const onKnobLeft = compact ? 23 : 29;
  const offKnobLeft = compact ? 3 : 4;

  const renderGroup = (group: Mark[], on: boolean) =>
    group.map((m, i) => (
      <ThingDot
        key={`${on}-${i}`}
        color={m.color}
        size={MARK_H}
        style={{
          position: 'absolute',
          top: -6,
          left: on
            ? onKnobLeft + knobSize - MARK_W * 0.7 + i * 5
            : offKnobLeft - MARK_W * 0.5 - i * 5,
          pointerEvents: 'none',
        }}
      />
    ));

  return (
    <>
      {renderGroup(marks.filter(m => !m.value), false)}
      {renderGroup(marks.filter(m => m.value), true)}
    </>
  );
};
