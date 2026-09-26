import React from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../../CardFrame';
import { useCharacterStore } from '@/stores/characterStore';
import { Eraser } from 'lucide-react';

const AuraEraseContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const characters = useCharacterStore(s => s.characters);
  const charId = (want.spec?.params?.characters as string[] | undefined)?.[0]
    ?? (want.state?.current?.characters as string[] | undefined)?.[0];
  const character = charId ? characters.find(c => c.id === charId) : undefined;
  const color = character?.color ?? '#64748b';

  const radius = typeof want.state?.current?.erase_radius === 'number'
    ? want.state.current.erase_radius : 1;

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          color={color}
          round
          icon={<Eraser className="w-[2em] h-[2em]" style={{ color }} />}
        />
      }
    >
      <CardFrameTitle>
        <span className="tabular-nums" style={{ color }}>{radius}</span>
        <span className="text-gray-500 dark:text-gray-400"> マス</span>
      </CardFrameTitle>
      <CardFrameNote>消去半径</CardFrameNote>
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['aura_erase'],
  ContentSection: AuraEraseContentSection,
});
