import React from 'react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { useColorMode } from '@/hooks/useColorMode';

const GaugeContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const colorMode = useColorMode();
  const isDark = colorMode === 'dark';

  const value  = typeof want.state?.current?.value_pct === 'number' ? want.state.current.value_pct : 0;
  const label  = (want.state?.current?.label as string | undefined) || '';
  const max    = 100;
  const pct    = Math.min(1, Math.max(0, value / max));

  // Geometry
  const cx = 100, cy = 88, r = 68, sw = 13;

  // Arc endpoints: 0% = left (angle = π), 100% = right (angle = 2π)
  // angle_rad = (1 + pct) * π
  const startX = cx - r, startY = cy;
  const endX   = cx + r, endY   = cy;

  const needleAngle = (1 + pct) * Math.PI;
  const nx = cx + r * Math.cos(needleAngle);
  const ny = cy + r * Math.sin(needleAngle);

  const arcColor =
    value >= 80 ? '#ef4444' :
    value >= 60 ? '#f59e0b' :
    '#3b82f6';

  const textFill    = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';
  const subFill     = isDark ? 'rgba(255,255,255,0.40)' : 'rgba(15,23,42,0.40)';
  const trackFill   = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
  const needleFill  = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)';

  // Needle tip: inner edge of arc so it rests on the colored portion
  const tipR   = r - sw / 2 - 3;
  const tailR  = 10;
  const tailAngle = needleAngle + Math.PI;

  return (
    <WantCardLayout
      centerContent
      content={
        <div className="w-full h-full flex items-center justify-center">
          <svg
            viewBox="0 0 200 118"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
          >
            {/* Background track */}
            <path
              d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
              fill="none"
              stroke={trackFill}
              strokeWidth={sw}
              strokeLinecap="round"
            />

            {/* Value arc */}
            {pct > 0.005 && (
              <path
                d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
                fill="none"
                stroke={arcColor}
                strokeWidth={sw}
                strokeLinecap="round"
              />
            )}

            {/* Needle */}
            <line
              x1={cx + tailR * Math.cos(tailAngle)}
              y1={cy + tailR * Math.sin(tailAngle)}
              x2={cx + tipR  * Math.cos(needleAngle)}
              y2={cy + tipR  * Math.sin(needleAngle)}
              stroke={needleFill}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Center pivot */}
            <circle cx={cx} cy={cy} r="4.5" fill={needleFill} />

            {/* Value number */}
            <text
              x={cx} y={cy - 16}
              textAnchor="middle"
              fontSize="24"
              fontWeight="700"
              fill={textFill}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              {value}
            </text>

            {/* Percent sign */}
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="10" fill={subFill}>
              %
            </text>

            {/* Range labels */}
            <text x={startX + 2} y={startY + 16} textAnchor="middle" fontSize="9" fill={subFill}>0</text>
            <text x={endX - 2}   y={endY + 16}   textAnchor="middle" fontSize="9" fill={subFill}>{max}</text>

            {/* Optional label */}
            {label ? (
              <text x={cx} y={112} textAnchor="middle" fontSize="9" fill={subFill}>{label}</text>
            ) : null}
          </svg>
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['gauge'],
  ContentSection: GaugeContentSection,
  hideFinalResult: true,
});
