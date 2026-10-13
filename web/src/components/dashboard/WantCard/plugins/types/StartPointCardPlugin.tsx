import React from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../../CardFrame';
import { Flag, LogOut } from 'lucide-react';
import { StageJumpButton, readStageTarget } from '../stageJump';

/**
 * Where you came in, and the way back out.
 *
 * The pair of NextStageCardPlugin: that one stands in a stage's last room and
 * sends the game forward, this one stands in the first room and sends it back
 * to the stage that leads here — landing on the portal you walked through, not
 * on that stage's own entrance, because going back should put you where you
 * left rather than at the beginning of it.
 *
 * The first stage has nothing behind it. Its card shows the marker and no
 * button at all, rather than a dead one: a control that can never do anything
 * is worse than no control, and the want type leaves rpg_prev_stage_id unset
 * there precisely because there is no way back to offer.
 */
const StartPointContentSection: React.FC<WantCardPluginProps> = ({ want, isInnerFocused }) => {
  const { stageId, targetX, targetY } = readStageTarget(want, 'rpg_prev_stage_id');
  const rawLabel = (want.state?.current?.label ?? want.spec?.params?.label);
  const label = typeof rawLabel === 'string' ? rawLabel : '';

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          color="#0ea5e9"
          icon={<Flag className="w-[1.8em] h-[1.8em]" strokeWidth={2.5} />}
          caption="スタート地点"
        />
      }
    >
      <CardFrameTitle>
        {label || <span className="italic text-gray-400">(unnamed)</span>}
      </CardFrameTitle>
      {stageId
        ? <CardFrameNote>← {stageId} ({targetX}, {targetY})</CardFrameNote>
        : <CardFrameNote>戻り先なし</CardFrameNote>}

      {stageId && (
        <StageJumpButton
          want={want}
          stageId={stageId}
          targetX={targetX}
          targetY={targetY}
          label="前の階に戻る"
          pendingLabel="Going back…"
          icon={<LogOut className="-scale-x-100" />}
          isInnerFocused={isInnerFocused}
        />
      )}
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['startpoint'],
  ContentSection: StartPointContentSection,
});
