import React from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameTitle, CardFrameLine, CardFrameNote } from '../../CardFrame';

/**
 * How much of the session is spent, and how long until it isn't.
 *
 * Two numbers and two deadlines, of which one number is the one you actually
 * check — so the session ring is the eyecatch and the week is a line in the
 * detail. Before this the card fell through to the generic renderer and showed
 * four state fields as four rows of `key: value`, which is a reasonable way to
 * display data and a poor way to answer "can I keep going".
 */

/** Green while there's room, amber when it's getting on, red when it isn't. */
function usageColor(pct: number): string {
  if (pct >= 90) return '#ef4444';
  if (pct >= 70) return '#f59e0b';
  return '#10b981';
}

/**
 * The ring. Sized in `em` so it tracks the card's own type scale, and drawn
 * with a viewBox so the arc maths stays in one fixed coordinate space no matter
 * what that scale turns out to be.
 */
const UsageRing: React.FC<{ pct: number }> = ({ pct }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = usageColor(clamped);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center h-full aspect-square max-w-full">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-gray-200 dark:stroke-gray-700" />
        <circle
          cx="50" cy="50" r={r}
          fill="none" strokeWidth="10" strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <span
        className="absolute font-bold tabular-nums leading-none text-[1.5em]"
        style={{ color }}
      >
        {Math.round(clamped)}
        <span className="text-[0.55em] font-semibold">%</span>
      </span>
    </div>
  );
};

const ClaudeInfoContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const cur = want.state?.current ?? {};
  const sessionPct = Number(cur.session_usage_pct ?? 0);
  const sessionResets = String(cur.session_resets_in ?? '');
  const weeklyPct = Number(cur.weekly_usage_pct ?? 0);
  const weeklyResets = String(cur.weekly_resets_at ?? '');

  const content = (
    <CardFrame eyecatch={<UsageRing pct={sessionPct} />}>
      <CardFrameTitle>
        {sessionResets ? `あと ${sessionResets}` : 'セッション'}
      </CardFrameTitle>
      <CardFrameLine>
        週 <span className="tabular-nums" style={{ color: usageColor(weeklyPct) }}>{Math.round(weeklyPct)}%</span>
      </CardFrameLine>
      {weeklyResets && <CardFrameNote>{weeklyResets} にリセット</CardFrameNote>}
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['claude_info'],
  ContentSection: ClaudeInfoContentSection,
  hideFinalResult: true,
});
