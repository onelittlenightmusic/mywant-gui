import React, { useEffect } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { WantTileFaceProps, registerWantCardPlugin } from '../registry';
import {
  ensureTileFaceMotion, stateString, tileFacePalette, untilLabel, useNow,
} from '../../tileFace/tileFaceKit';

/**
 * The reminder's tile face. The reminder's card keeps its default body (its
 * message and the reaction buttons are drawn by WantCardContent); this plugin
 * brings only how it looks standing on the board.
 *
 * A bell, and a tag hung on it saying the one thing you would walk over to
 * learn: when it will ring, or that it is waiting for your answer. The bell
 * swings only while it waits on you, so from across the board a still bell
 * means there is nothing to do.
 */

type Mood = 'waiting' | 'calling' | 'done' | 'failed';

function moodOf(want: WantTileFaceProps['want']): Mood {
  const phase = stateString(want.state, 'reminder_phase');
  const status = want.status as string;
  if (status === 'failed' || phase === 'failed') return 'failed';
  if (status === 'waiting_user_action' || want.state?.current?.reaction_queue_id || phase === 'reaching') return 'calling';
  if (status === 'achieved' || phase === 'completed') return 'done';
  return 'waiting';
}

const ReminderTileFace: React.FC<WantTileFaceProps> = ({ want, width, height, isLight }) => {
  useEffect(ensureTileFaceMotion, []);
  const now = useNow();
  const palette = tileFacePalette(isLight);
  const mood = moodOf(want);

  const eventIso = stateString(want.state, 'event_time');
  const eventMs = eventIso ? Date.parse(eventIso) : NaN;
  const tag =
    mood === 'calling' ? '返事まち'
    : mood === 'done' ? 'おわり'
    : mood === 'failed' ? 'うまくいかず'
    : Number.isFinite(eventMs) ? untilLabel(eventMs, now)
    : '';
  const tagFill = mood === 'calling' || mood === 'failed' ? palette.calling : palette.panel;
  const tagInk = mood === 'calling' || mood === 'failed' ? '#ffffff' : palette.ink;
  const BellGlyph = mood === 'calling' ? BellRing : Bell;

  const vbH = Math.max(60, Math.round((100 * height) / Math.max(1, width)));
  const panelH = vbH - 10;
  const tagW = Math.max(34, Math.min(84, tag.length * 9 + 14));

  return (
    <svg width={width} height={height} viewBox={`0 0 100 ${vbH}`} role="img"
      aria-label={['reminder', tag].filter(Boolean).join(' ')}
      style={{ display: 'block', fontFamily: 'inherit' }}>
      <rect x="5" y="5" width="90" height={panelH} rx="9" fill={palette.panel} />
      <g className={mood === 'calling' ? 'mw-tf-swing' : undefined}>
        <BellGlyph x={28} y={8} size={44} color={palette.accent} strokeWidth={1.7} />
      </g>
      {mood === 'done' && (
        <g>
          <circle cx="70" cy="44" r="9" fill={palette.accent} />
          <Check x={64} y={38} size={12} color={isLight ? '#ffffff' : '#0f172a'} strokeWidth={3} />
        </g>
      )}
      {tag && (
        <g transform={`rotate(-4 ${50} ${panelH - 6})`}>
          <rect x={50 - tagW / 2} y={panelH - 18} width={tagW} height="18" rx="5"
            fill={tagFill} stroke={palette.muted} strokeWidth={mood === 'waiting' || mood === 'done' ? 0.6 : 0} />
          <text x="50" y={panelH - 5} textAnchor="middle" fill={tagInk} fontSize="11" fontWeight="700">{tag}</text>
        </g>
      )}
    </svg>
  );
};

registerWantCardPlugin({
  types: ['reminder'],
  TileFace: ReminderTileFace,
});
