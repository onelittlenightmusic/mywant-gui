import React from 'react';
import { WantCardPluginProps } from './registry';
import { WantCardLayout } from '../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../CardFrame';

/**
 * Every effect card, which is one card wearing three coats of paint.
 *
 * Chime, fireworks and hearts were three files that differed only in an icon, a
 * colour and the name of a counter — the rest, down to the box-shadow alpha,
 * was copied. They say the same thing because they *are* the same thing: an
 * effect that has fired some number of times.
 *
 * On CardFrame the glyph becomes the eyecatch and the count becomes the detail,
 * at a size you can read from the dashboard rather than the 11px it was — the
 * count is the whole of what an effect card knows.
 */
export function makeEffectContentSection(opts: {
  /** The state field holding the count, e.g. "chime_triggers". */
  stateKey: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  /** What the count is of, in the detail line. */
  label: string;
}): React.FC<WantCardPluginProps> {
  const { stateKey, icon: Icon, color, label } = opts;

  const Section: React.FC<WantCardPluginProps> = ({ want }) => {
    const raw = want.state?.current?.[stateKey];
    const triggers = typeof raw === 'number' ? raw : 0;

    const content = (
      <CardFrame
        eyecatch={
          <CardFrameBadge
            color={color}
            round
            icon={<Icon className="w-[2em] h-[2em] animate-pulse" style={{ color }} />}
          />
        }
      >
        <CardFrameTitle>
          <span className="tabular-nums" style={{ color }}>{triggers}</span>
          <span className="text-gray-500 dark:text-gray-400"> 回</span>
        </CardFrameTitle>
        <CardFrameNote>{label}</CardFrameNote>
      </CardFrame>
    );

    return <WantCardLayout content={content} />;
  };

  Section.displayName = `EffectContentSection(${stateKey})`;
  return Section;
}
