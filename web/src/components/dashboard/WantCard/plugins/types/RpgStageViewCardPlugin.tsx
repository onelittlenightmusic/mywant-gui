import React from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';

const TitleBar: React.FC<{ stageId: string; position: 'top' | 'bottom' }> = ({ stageId, position }) => (
  <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1"
    style={{
      background: '#161b22',
      [position === 'top' ? 'borderBottom' : 'borderTop']: '1px solid #30363d',
    }}>
    <span className="w-2 h-2 rounded-full bg-red-500 opacity-80" />
    <span className="w-2 h-2 rounded-full bg-yellow-400 opacity-80" />
    <span className="w-2 h-2 rounded-full bg-green-500 opacity-80" />
    <span className="ml-2 font-mono" style={{ color: '#8b949e' }}>
      {stageId || 'rpg-stage-view'}
    </span>
    <span className="ml-auto flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      <span style={{ color: '#3fb950' }}>live</span>
    </span>
  </div>
);

const RpgStageViewContentSection: React.FC<WantCardPluginProps> = ({
  want, isExpanded,
}) => {
  const scene = (want.state?.current?.scene as string) || '';
  const stageId = (want.state?.current?.stage as string) || '';

  if (!scene) {
    return (
      <WantCardLayout
        className="rounded-lg bg-gray-900"
        centerContent
        content={<span className="text-gray-500 font-mono px-3 py-2">観測中…</span>}
      />
    );
  }

  return (
    <WantCardLayout
      className="rounded-lg overflow-hidden"
      style={{ background: '#0d1117' }}
      top={isExpanded ? <TitleBar stageId={stageId} position="top" /> : undefined}
      content={
        <pre
          className="h-full overflow-auto leading-tight px-3 py-2"
          style={{
            color: '#e6edf3',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
            whiteSpace: 'pre',
            margin: 0,
          }}
        >
          {scene}
        </pre>
      }
      bottom={!isExpanded ? <TitleBar stageId={stageId} position="bottom" /> : undefined}
    />
  );
};

registerWantCardPlugin({
  types: ['rpg_stage_view'],
  ContentSection: RpgStageViewContentSection,
});
