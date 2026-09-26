import React from 'react';

interface Mark {
  color: string;
  /** 0-100 position along the track, matching the marked value under min/max at mark time */
  percent: number;
}

interface SliderDefaultMarksProps {
  marks: Mark[];
}

const TRIANGLE_WIDTH = 10;
const TRIANGLE_HEIGHT = 7;

/**
 * Aura-colored downward-pointing triangles marking each character's
 * X-marked default value position along a slider track — same "aura
 * default" concept as ToggleDefaultBookmarks/DogEarFlags, adapted for a
 * continuous range (a fixed pair of knob positions doesn't apply here, so
 * marks are placed by percent instead).
 */
export const SliderDefaultMarks: React.FC<SliderDefaultMarksProps> = ({ marks }) => {
  if (marks.length === 0) return null;

  return (
    <>
      {marks.map((m, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: -TRIANGLE_HEIGHT - 1,
            left: `${Math.min(100, Math.max(0, m.percent))}%`,
            transform: 'translateX(-50%)',
            width: TRIANGLE_WIDTH,
            height: TRIANGLE_HEIGHT,
            background: m.color,
            clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
            filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.6))',
          }}
        />
      ))}
    </>
  );
};
