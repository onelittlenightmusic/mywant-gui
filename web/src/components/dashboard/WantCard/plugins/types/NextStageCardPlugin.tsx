import React from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../../CardFrame';
import { DoorOpen, LogIn } from 'lucide-react';
import { StageJumpButton, readStageTarget } from '../stageJump';

/**
 * The way on. Its pair is StartPointCardPlugin, which is the way back — see
 * stageJump for the gesture both share.
 */
const NextStageContentSection: React.FC<WantCardPluginProps> = ({ want, isInnerFocused }) => {
  const { stageId, targetX, targetY } = readStageTarget(want, 'rpg_next_stage_id');

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          color="#8b5cf6"
          icon={<DoorOpen className="w-[1.8em] h-[1.8em]" strokeWidth={2.5} />}
          caption="ステージ"
        />
      }
    >
      <CardFrameTitle>
        {stageId || <span className="italic text-gray-400">(unset)</span>}
      </CardFrameTitle>
      <CardFrameNote>spawn ({targetX}, {targetY})</CardFrameNote>

      <StageJumpButton
        want={want}
        stageId={stageId}
        targetX={targetX}
        targetY={targetY}
        label="進む"
        pendingLabel="Advancing…"
        icon={<LogIn />}
        isInnerFocused={isInnerFocused}
      />
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['next_stage'],
  ContentSection: NextStageContentSection,
});
