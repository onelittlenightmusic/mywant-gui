import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { CardFrame } from '../../CardFrame';
import { CX, CY, R_FACE } from '../../../../forms/timerUtils';
import { writeWantState } from '@/api/wantState';

// ── helpers ──────────────────────────────────────────────────────────────────

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => i + start);
}

async function putState(id: string, key: string, value: unknown) {
  writeWantState(id, { [key]: value });
}

const selectCls =
  'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 ' +
  'rounded text-gray-800 dark:text-gray-100 px-1 py-0.5 ' +
  'focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer';

// ── AM/PM badge ───────────────────────────────────────────────────────────────

const AmPmBadge: React.FC<{
  isPM: boolean;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ isPM, onClick }) => (
  <span
    onClick={onClick}
    onMouseDown={onClick ? (e) => e.stopPropagation() : undefined}
    className={[
      'font-mono font-bold px-1.5 py-0.5 rounded-full select-none',
      onClick ? 'cursor-pointer hover:brightness-125 active:scale-95 transition-all' : '',
      isPM
        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    ].join(' ')}
  >
    {isPM ? 'PM' : 'AM'}
  </span>
);

// ── Analog Clock ──────────────────────────────────────────────────────────────

const R_HOUR   = 28;
const R_MINUTE = 40;
const R_SECOND = 46;
const R_TICK_O = R_FACE - 4;
const R_TICK_MAJOR = R_FACE - 9;
const R_TICK_MINOR = R_FACE - 6;

function handXY(angleDeg: number, length: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: CX + length * Math.cos(rad), y: CY + length * Math.sin(rad) };
}

// Radial zone boundaries (in viewBox units)
const ZONE_H = R_FACE / 3;       // 0 … ZONE_H  → hour
const ZONE_M = (R_FACE * 2) / 3; // ZONE_H … ZONE_M → minute
                                  // ZONE_M … R_FACE  → second

const ZONE_COLORS = { hour: '#3b82f6', minute: '#10b981', second: '#ef4444' } as const;
type DragZone = 'hour' | 'minute' | 'second';

interface AnalogClockProps {
  hour: number; minute: number; second: number;
  size?: number;
  // real-time (no PUT)
  onDragHour?: (h: number) => void;
  onDragMinute?: (m: number) => void;
  onDragSecond?: (s: number) => void;
  // commit on pointer-up (PUT)
  onCommitHour?: (h: number) => void;
  onCommitMinute?: (m: number) => void;
  onCommitSecond?: (s: number) => void;
}

const AnalogClock: React.FC<AnalogClockProps> = ({
  // No default: the one caller passes nothing, and undefined is what selects
  // the fill-the-space branch below. A default of 96 made that branch dead code
  // — the dial stayed 96px however much room the card had.
  hour, minute, second, size,
  onDragHour, onDragMinute, onDragSecond,
  onCommitHour, onCommitMinute, onCommitSecond,
}) => {
  const isPM = hour >= 12;
  const hourAngle   = ((hour % 12) / 12) * 360 + (minute / 60) * 30 + (second / 3600) * 30;
  const minuteAngle = (minute / 60) * 360 + (second / 60) * 6;
  const secondAngle = (second / 60) * 360;

  const hourEnd   = handXY(hourAngle,   R_HOUR);
  const minuteEnd = handXY(minuteAngle, R_MINUTE);
  const secondEnd = handXY(secondAngle, R_SECOND);

  const svgRef    = useRef<SVGSVGElement>(null);
  const [dragging,  setDragging]  = useState<DragZone | null>(null);
  const [hoverZone, setHoverZone] = useState<DragZone | null>(null);
  // snapshot AM/PM at drag-start so mid-drag hand crossing doesn't flip it
  const isPMAtStart = useRef(isPM);

  const isInteractive = !!(onDragHour || onCommitHour);

  /** Client → SVG viewBox coordinates */
  const toSvgXY = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 140, y: ((clientY - r.top) / r.height) * 140 };
  };

  const zoneAt = (x: number, y: number): DragZone | null => {
    const r = Math.hypot(x - CX, y - CY);
    if (r > R_FACE) return null;
    if (r < ZONE_H)  return 'hour';
    if (r < ZONE_M)  return 'minute';
    return 'second';
  };

  const angleAt = (x: number, y: number) =>
    (Math.atan2(y - CY, x - CX) * 180 / Math.PI + 90 + 360) % 360;

  const valueFromAngle = (zone: DragZone, angle: number): number => {
    if (zone === 'hour') {
      const h12 = Math.round((angle / 360) * 12) % 12;
      return (h12 % 12) + (isPMAtStart.current ? 12 : 0);
    }
    return Math.round((angle / 360) * 60) % 60;
  };

  const applyDrag = (zone: DragZone, angle: number, commit = false) => {
    const v = valueFromAngle(zone, angle);
    if (zone === 'hour')   { commit ? onCommitHour?.(v)   : onDragHour?.(v);   }
    if (zone === 'minute') { commit ? onCommitMinute?.(v) : onDragMinute?.(v); }
    if (zone === 'second') { commit ? onCommitSecond?.(v) : onDragSecond?.(v); }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isInteractive) return;
    e.stopPropagation();
    const pt = toSvgXY(e.clientX, e.clientY);
    if (!pt) return;
    const zone = zoneAt(pt.x, pt.y);
    if (!zone) return;
    isPMAtStart.current = hour >= 12;
    setDragging(zone);
    setHoverZone(zone);
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    applyDrag(zone, angleAt(pt.x, pt.y));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    const pt = toSvgXY(e.clientX, e.clientY);
    if (!pt) return;
    if (dragging) {
      applyDrag(dragging, angleAt(pt.x, pt.y));
    } else if (isInteractive) {
      setHoverZone(zoneAt(pt.x, pt.y));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    e.stopPropagation();
    const pt = toSvgXY(e.clientX, e.clientY);
    if (pt) applyDrag(dragging, angleAt(pt.x, pt.y), true);
    setDragging(null);
  };

  const active = dragging ?? hoverZone;
  const noTransition = (zone: DragZone) => dragging === zone ? 'none' : 'all 0.3s ease';

  return (
    // With no explicit size the dial fills whatever it is given: the svg
    // carries a viewBox and the default preserveAspectRatio, so it stays a
    // circle and simply grows. That is what makes the clock big when the card
    // is maximised and the frame hands its eyecatch the top half. flex-1 +
    // min-h-0 so the AM/PM badge keeps its natural height and the dial takes
    // the rest. Passing `size` opts back into a fixed square.
    <div className={size ? 'flex flex-col items-center gap-0.5 flex-shrink-0'
                         : 'flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-0 min-w-0'}>
      <svg ref={svgRef} width={size ?? '100%'} height={size ?? '100%'} viewBox="0 0 140 140"
        className={size ? undefined : 'flex-1 min-h-0 w-full'}
        style={{ cursor: dragging ? 'grabbing' : (hoverZone && isInteractive ? 'grab' : 'default') }}
        onPointerDown={isInteractive ? handlePointerDown : undefined}
        onPointerMove={handlePointerMove}
        onPointerUp={isInteractive ? handlePointerUp : undefined}
        onPointerLeave={() => { if (!dragging) setHoverZone(null); }}>

        {/* Face */}
        <circle cx={CX} cy={CY} r={R_FACE}
          className="fill-white stroke-gray-200 dark:fill-gray-800 dark:stroke-gray-600"
          strokeWidth="1.5" />

        {/* Radial zone guide rings (shown when interactive) */}
        {isInteractive && (<>
          <circle cx={CX} cy={CY} r={ZONE_H} fill="none"
            stroke={active === 'hour' ? ZONE_COLORS.hour : '#9ca3af'}
            strokeWidth={active === 'hour' ? 1 : 0.4} strokeDasharray="2,2"
            opacity={active === 'hour' ? 0.65 : 0.2} />
          <circle cx={CX} cy={CY} r={ZONE_M} fill="none"
            stroke={active === 'minute' ? ZONE_COLORS.minute : '#9ca3af'}
            strokeWidth={active === 'minute' ? 1 : 0.4} strokeDasharray="2,2"
            opacity={active === 'minute' ? 0.65 : 0.2} />
        </>)}

        {/* Tick marks */}
        {Array.from({ length: 60 }, (_, i) => {
          const isMajor = i % 5 === 0;
          const rad = ((i / 60) * 360 - 90) * (Math.PI / 180);
          const rIn = isMajor ? R_TICK_MAJOR : R_TICK_MINOR;
          return (
            <line key={i}
              x1={CX + rIn      * Math.cos(rad)} y1={CY + rIn      * Math.sin(rad)}
              x2={CX + R_TICK_O * Math.cos(rad)} y2={CY + R_TICK_O * Math.sin(rad)}
              className={isMajor ? 'stroke-gray-400 dark:stroke-gray-500' : 'stroke-gray-200 dark:stroke-gray-700'}
              strokeWidth={isMajor ? 1.5 : 0.7} />
          );
        })}

        {/* 12/3/6/9 labels */}
        {([12, 3, 6, 9] as const).map((num, qi) => {
          const rad = (qi * 90 - 90) * (Math.PI / 180);
          const r   = R_FACE - 17;
          return (
            <text key={num}
              x={CX + r * Math.cos(rad)} y={CY + r * Math.sin(rad)}
              textAnchor="middle" dominantBaseline="central"
              fontSize="9.5" fontFamily="monospace" fontWeight="bold"
              className="fill-gray-500 dark:fill-gray-400">
              {num}
            </text>
          );
        })}

        {/* Hour hand — highlighted when hour zone is active */}
        <line x1={CX} y1={CY} x2={hourEnd.x} y2={hourEnd.y}
          className={active === 'hour' ? '' : 'stroke-gray-900 dark:stroke-gray-100'}
          style={{ stroke: active === 'hour' ? ZONE_COLORS.hour : undefined, transition: noTransition('hour') }}
          strokeWidth={active === 'hour' ? 4 : 3.5} strokeLinecap="round" />

        {/* Minute hand — highlighted when minute zone is active */}
        <line x1={CX} y1={CY} x2={minuteEnd.x} y2={minuteEnd.y}
          className={active === 'minute' ? '' : 'stroke-gray-700 dark:stroke-gray-300'}
          style={{ stroke: active === 'minute' ? ZONE_COLORS.minute : undefined, transition: noTransition('minute') }}
          strokeWidth={active === 'minute' ? 3 : 2.2} strokeLinecap="round" />

        {/* Second hand — always red, brighter when active */}
        <line x1={CX} y1={CY} x2={secondEnd.x} y2={secondEnd.y}
          style={{ stroke: active === 'second' ? '#ff3333' : '#ef4444', transition: noTransition('second') }}
          strokeWidth={active === 'second' ? 1.8 : 1.2} strokeLinecap="round" />

        {/* Center cap */}
        <circle cx={CX} cy={CY} r="3.5" className="fill-gray-900 dark:fill-gray-100" />

        {/* Active zone label */}
        {active && isInteractive && (
          <text x={CX} y={CY - 20} textAnchor="middle" dominantBaseline="central"
            fontSize="6" fontFamily="monospace" fontWeight="bold"
            fill={ZONE_COLORS[active]} opacity="0.85">
            {active.toUpperCase()}
          </text>
        )}
      </svg>
      <AmPmBadge isPM={isPM} />
    </div>
  );
};

// ── 7-Segment Digital Clock ───────────────────────────────────────────────────
//   Segments: a=top  b=top-right  c=bot-right  d=bottom  e=bot-left  f=top-left  g=middle

const SEG_MAP: boolean[][] = [
  //  a      b      c      d      e      f      g
  [true,  true,  true,  true,  true,  true,  false], // 0
  [false, true,  true,  false, false, false, false], // 1
  [true,  true,  false, true,  true,  false, true ], // 2
  [true,  true,  true,  true,  false, false, true ], // 3
  [false, true,  true,  false, false, true,  true ], // 4
  [true,  false, true,  true,  false, true,  true ], // 5
  [true,  false, true,  true,  true,  true,  true ], // 6
  [true,  true,  true,  false, false, false, false], // 7
  [true,  true,  true,  true,  true,  true,  true ], // 8
  [true,  true,  true,  true,  false, true,  true ], // 9
];

const SW   = 11;   // segment digit width (SVG units)
const SH   = 19;   // segment digit height (SVG units)
const ST   = 2.5;  // segment thickness
const SS   = 0.8;  // bevel slant
const SG   = 0.4;  // gap from edges
const SPAD = 3;    // SVG padding

const SEG_ON   = '#f59e0b'; // amber active
const SEG_OFF  = '#3d1a00'; // dark amber ghost

function drawDigit(digit: number, ox: number, oy: number, pfx: string): React.ReactElement[] {
  const on = SEG_MAP[Math.max(0, Math.min(9, digit))];
  const hx    = ox + ST + SG;
  const hLen  = SW - 2 * (ST + SG);
  const xL    = ox + SG;
  const xR    = ox + SW - ST - SG;
  const vtop1 = oy + ST + SG;
  const vtop2 = oy + SH / 2 - SG;
  const vbot1 = oy + SH / 2 + SG;
  const vbot2 = oy + SH - ST - SG;
  const vLenT = vtop2 - vtop1;
  const vLenB = vbot2 - vbot1;

  // Horizontal bar (beveled hexagon)
  const h = (y: number, lit: boolean, k: string) => {
    const pts = [
      `${hx + SS},${y}`,
      `${hx + hLen - SS},${y}`,
      `${hx + hLen},${y + ST / 2}`,
      `${hx + hLen - SS},${y + ST}`,
      `${hx + SS},${y + ST}`,
      `${hx},${y + ST / 2}`,
    ].join(' ');
    return <polygon key={`${pfx}-${k}`} points={pts} fill={lit ? SEG_ON : SEG_OFF} />;
  };

  // Vertical bar (beveled hexagon)
  const v = (x: number, y1: number, len: number, lit: boolean, k: string) => {
    const pts = [
      `${x},${y1 + SS}`,
      `${x + ST / 2},${y1}`,
      `${x + ST},${y1 + SS}`,
      `${x + ST},${y1 + len - SS}`,
      `${x + ST / 2},${y1 + len}`,
      `${x},${y1 + len - SS}`,
    ].join(' ');
    return <polygon key={`${pfx}-${k}`} points={pts} fill={lit ? SEG_ON : SEG_OFF} />;
  };

  return [
    h(oy + SG,              on[0], 'a'), // top
    v(xR, vtop1, vLenT,    on[1], 'b'), // top-right
    v(xR, vbot1, vLenB,    on[2], 'c'), // bot-right
    h(vbot2,                on[3], 'd'), // bottom
    v(xL, vbot1, vLenB,    on[4], 'e'), // bot-left
    v(xL, vtop1, vLenT,    on[5], 'f'), // top-left
    h(oy + SH / 2 - ST / 2, on[6], 'g'), // middle
  ];
}

function colonDots(cx: number, oy: number): React.ReactElement[] {
  return [
    <circle key={`c${cx}-1`} cx={cx} cy={oy + SH * 0.3} r={1.5} fill={SEG_ON} />,
    <circle key={`c${cx}-2`} cx={cx} cy={oy + SH * 0.7} r={1.5} fill={SEG_ON} />,
  ];
}

interface SevenSegClockProps {
  hour: number; minute: number; second: number;
  onIncrHour: () => void; onIncrHourTen: () => void;
  onIncrMinute: () => void; onIncrMinuteTen: () => void;
  onIncrSecond: () => void; onIncrSecondTen: () => void;
  onToggleAmPm: () => void;
  scale?: number;
}

const SevenSegClock: React.FC<SevenSegClockProps> = ({
  hour, minute, second,
  onIncrHour, onIncrHourTen,
  onIncrMinute, onIncrMinuteTen,
  onIncrSecond, onIncrSecondTen,
  onToggleAmPm, scale = 1,
}) => {
  const isPM = hour >= 12;
  const h12  = hour % 12 === 0 ? 12 : hour % 12;
  const [hov, setHov] = useState<Group | null>(null);

  const d = [
    Math.floor(h12 / 10), h12 % 10,
    Math.floor(minute / 10), minute % 10,
    Math.floor(second / 10), second % 10,
  ];

  // X offsets: [d0][gap][d1][colon][d2][gap][d3][colon][d4][gap][d5]
  const GAP = 2, COL = 6;
  const x: number[] = [];
  x[0] = SPAD;
  x[1] = x[0] + SW + GAP;
  const cx1 = x[1] + SW + GAP + COL / 2;
  x[2] = cx1 + COL / 2 + GAP;
  x[3] = x[2] + SW + GAP;
  const cx2 = x[3] + SW + GAP + COL / 2;
  x[4] = cx2 + COL / 2 + GAP;
  x[5] = x[4] + SW + GAP;

  const svgW = x[5] + SW + SPAD;
  const svgH = SH + 2 * SPAD;
  const oy   = SPAD;

  // Clickable hit-box per digit: tens digit (+10), ones digit (+1)
  type Group = 'h10' | 'h1' | 'm10' | 'm1' | 's10' | 's1';
  const groups: { key: Group; xStart: number; xEnd: number; onClick: () => void }[] = [
    { key: 'h10', xStart: x[0] - 1, xEnd: x[0] + SW + 1, onClick: onIncrHourTen   },
    { key: 'h1',  xStart: x[1] - 1, xEnd: x[1] + SW + 1, onClick: onIncrHour      },
    { key: 'm10', xStart: x[2] - 1, xEnd: x[2] + SW + 1, onClick: onIncrMinuteTen },
    { key: 'm1',  xStart: x[3] - 1, xEnd: x[3] + SW + 1, onClick: onIncrMinute    },
    { key: 's10', xStart: x[4] - 1, xEnd: x[4] + SW + 1, onClick: onIncrSecondTen },
    { key: 's1',  xStart: x[5] - 1, xEnd: x[5] + SW + 1, onClick: onIncrSecond    },
  ];

  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <svg width={svgW * scale} height={svgH * scale} viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ background: '#0c0a09', borderRadius: 4 * scale }}>
        {/* Digits & colons */}
        {d.map((dig, i) => drawDigit(dig, x[i], oy, String(i)))}
        {colonDots(cx1, oy)}
        {colonDots(cx2, oy)}

        {/* Hover highlight + click overlays (rendered on top) */}
        {groups.map(({ key, xStart, xEnd, onClick }) => (
          <g key={key}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={() => setHov(key)}
            onMouseLeave={() => setHov(null)}
            style={{ cursor: 'n-resize' }}>
            {/* Highlight when hovered */}
            {hov === key && (
              <rect x={xStart} y={0} width={xEnd - xStart} height={svgH} rx={2}
                fill="#f59e0b" fillOpacity={0.18} />
            )}
            {/* Transparent hit area */}
            <rect x={xStart} y={0} width={xEnd - xStart} height={svgH} fill="transparent" />
          </g>
        ))}
      </svg>
      <AmPmBadge isPM={isPM}
        onClick={(e) => { e.stopPropagation(); onToggleAmPm(); }} />
    </div>
  );
};

// ── Mini Calendar ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function parseYMD(dateStr: string): { y: number; m: number; d: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0])) return null;
  return { y: parts[0], m: parts[1] - 1, d: parts[2] }; // m is 0-based
}

const MiniCalendar: React.FC<{
  value: string;
  onChange: (date: string) => void;
}> = ({ value, onChange }) => {
  const today  = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const parsed = parseYMD(value);
  const [viewY, setViewY] = useState(parsed?.y ?? todayY);
  const [viewM, setViewM] = useState(parsed?.m ?? todayM);

  // Follow external value changes
  useEffect(() => {
    const p = parseYMD(value);
    if (p) { setViewY(p.y); setViewM(p.m); }
  }, [value]);

  const firstDow  = new Date(viewY, viewM, 1).getDay();        // 0=Sun
  const daysInMon = new Date(viewY, viewM + 1, 0).getDate();

  const prevMonth = useCallback(() => {
    setViewM(prev => {
      if (prev === 0) { setViewY(y => y - 1); return 11; }
      return prev - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewM(prev => {
      if (prev === 11) { setViewY(y => y + 1); return 0; }
      return prev + 1;
    });
  }, []);

  // Build cell array: leading nulls + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div
      className="flex flex-col gap-1 select-none min-w-[196px]"
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* Month / year navigation */}
      <div className="flex items-center justify-between px-0.5">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-gray-700 dark:text-gray-200 tracking-wide">
          {MONTH_NAMES[viewM]} {viewY}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {/* Day-of-week header */}
        {DAYS_SHORT.map(d => (
          <div key={d} className="w-7 text-center font-semibold text-gray-400 dark:text-gray-500 pb-0.5">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="w-7 h-6" />;
          const ds = `${viewY}-${String(viewM + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isSelected = ds === value;
          const isToday    = viewY === todayY && viewM === todayM && day === todayD;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onChange(ds)}
              className={[
                'w-7 h-6 rounded-md transition-colors leading-none font-medium',
                isSelected
                  ? 'bg-blue-500 text-white'
                  : isToday
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              ].filter(Boolean).join(' ')}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── component ─────────────────────────────────────────────────────────────────

const DateAndTimeContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const id        = want.metadata?.id ?? '';
  const rawClockType = want.spec?.params?.clock_type;
  const clockType = typeof rawClockType === 'string' ? rawClockType : 'analog';
  const rawTimeZone = want.spec?.params?.time_zone;
  const timeZone = typeof rawTimeZone === 'string' ? rawTimeZone : '';

  const serverDate   = (want.state?.current?.date   as string  | undefined) ?? '';
  const serverHour   = (want.state?.current?.hour   as number  | undefined) ?? 0;
  const serverMinute = (want.state?.current?.minute as number  | undefined) ?? 0;
  const serverSecond = (want.state?.current?.second as number  | undefined) ?? 0;

  const [date,   setDate]   = useState(serverDate);
  const [hour,   setHour]   = useState(serverHour);
  const [minute, setMinute] = useState(serverMinute);
  const [second, setSecond] = useState(serverSecond);

  useEffect(() => { setDate(serverDate);     }, [serverDate]);
  useEffect(() => { setHour(serverHour);     }, [serverHour]);
  useEffect(() => { setMinute(serverMinute); }, [serverMinute]);
  useEffect(() => { setSecond(serverSecond); }, [serverSecond]);

  // String-based date handler — used by MiniCalendar
  const handleDateStr = useCallback(async (v: string) => {
    setDate(v);
    if (id) await putState(id, 'date', v);
  }, [id]);

  const handleDate   = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleDateStr(e.target.value);
  }, [handleDateStr]);
  const handleHour   = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = Number(e.target.value); setHour(v);
    if (id) await putState(id, 'hour', v);
  }, [id]);
  const handleMinute = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = Number(e.target.value); setMinute(v);
    if (id) await putState(id, 'minute', v);
  }, [id]);
  const handleSecond = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = Number(e.target.value); setSecond(v);
    if (id) await putState(id, 'second', v);
  }, [id]);

  // 7-segment click-to-increment handlers (+1 / +10)
  const incrHour      = useCallback(async () => { const v = (hour   +  1) % 24; setHour(v);   if (id) await putState(id, 'hour',   v); }, [hour,   id]);
  const incrHourTen   = useCallback(async () => { const v = (hour   + 10) % 24; setHour(v);   if (id) await putState(id, 'hour',   v); }, [hour,   id]);
  const incrMinute    = useCallback(async () => { const v = (minute +  1) % 60; setMinute(v); if (id) await putState(id, 'minute', v); }, [minute, id]);
  const incrMinuteTen = useCallback(async () => { const v = (minute + 10) % 60; setMinute(v); if (id) await putState(id, 'minute', v); }, [minute, id]);
  const incrSecond    = useCallback(async () => { const v = (second +  1) % 60; setSecond(v); if (id) await putState(id, 'second', v); }, [second, id]);
  const incrSecondTen = useCallback(async () => { const v = (second + 10) % 60; setSecond(v); if (id) await putState(id, 'second', v); }, [second, id]);
  // Analog drag callbacks — real-time (no PUT)
  const onDragHour   = useCallback((v: number) => setHour(v),   []);
  const onDragMinute = useCallback((v: number) => setMinute(v), []);
  const onDragSecond = useCallback((v: number) => setSecond(v), []);
  // Analog commit callbacks — PUT on pointer-up
  const onCommitHour = useCallback(async (v: number) => {
    setHour(v); if (id) await putState(id, 'hour', v);
  }, [id]);
  const onCommitMinute = useCallback(async (v: number) => {
    setMinute(v); if (id) await putState(id, 'minute', v);
  }, [id]);
  const onCommitSecond = useCallback(async (v: number) => {
    setSecond(v); if (id) await putState(id, 'second', v);
  }, [id]);

  // AM/PM toggle: flip between 0–11 ↔ 12–23
  const toggleAmPm = useCallback(async () => {
    const v = hour >= 12 ? hour - 12 : hour + 12;
    setHour(v);
    if (id) await putState(id, 'hour', v);
  }, [hour, id]);

  const clock = clockType === 'digital' ? (
    <SevenSegClock hour={hour} minute={minute} second={second}
      onIncrHour={incrHour}     onIncrHourTen={incrHourTen}
      onIncrMinute={incrMinute} onIncrMinuteTen={incrMinuteTen}
      onIncrSecond={incrSecond} onIncrSecondTen={incrSecondTen}
      onToggleAmPm={toggleAmPm} />
  ) : (
    <AnalogClock hour={hour} minute={minute} second={second}
      onDragHour={onDragHour} onDragMinute={onDragMinute} onDragSecond={onDragSecond}
      onCommitHour={onCommitHour} onCommitMinute={onCommitMinute} onCommitSecond={onCommitSecond} />
  );

  // Time selects row (shared between layouts)
  // The card's inner-focus ring. This card had none at all: its controls are
  // real widgets, so with nothing declared, Enter marked the card operated and
  // left every select out of the keyboard's reach. Hour first — it is the one
  // people change. The calendar's day grid is deliberately left out: thirty-odd
  // buttons would make Tab a slog, and the date has its own field here.
  const timeSelectsRow = (
    <div className="flex items-center gap-1">
      <select data-inner-focus data-inner-focus-default value={hour} onChange={handleHour} className={selectCls}>
        {range(0, 23).map(h => (
          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-gray-400 dark:text-gray-500 font-bold">:</span>
      <select data-inner-focus value={minute} onChange={handleMinute} className={selectCls}>
        {range(0, 59).map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-gray-400 dark:text-gray-500 font-bold">:</span>
      <select data-inner-focus value={second} onChange={handleSecond} className={selectCls}>
        {range(0, 59).map(s => (
          <option key={s} value={s}>{String(s).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );

  return (
    // The clock is the eyecatch — it is what this card is recognised by, and
    // what should get the room when the card is maximised. The calendar and the
    // time selects are the detail beside it. collapseDetail keeps the older
    // behaviour of showing the clock alone on a narrow tile: a month grid and a
    // row of selects are unusable at that width.
    <CardFrame
      collapseDetail
      eyecatch={
        <div
          className="flex items-center justify-center w-full h-full p-2"
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
        >
          {clock}
        </div>
      }
    >
      <div
        className="flex flex-col gap-3 p-3 overflow-auto h-full"
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        <MiniCalendar value={date} onChange={handleDateStr} />

        <div className="flex items-center gap-2 px-0.5">
          <span className="font-mono text-gray-500 dark:text-gray-400">📅</span>
          {date ? (
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{date}</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 italic">no date selected</span>
          )}
          {date && (
            <button data-inner-focus type="button" onClick={() => handleDateStr('')}
              className="ml-auto text-gray-400 hover:text-red-400 transition-colors" title="Clear date">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700" />

        <div className="flex flex-col gap-1.5">
          {timeSelectsRow}
          {timeZone && (
            <span className="font-mono text-gray-400 dark:text-gray-500 tracking-wide">
              🌐 {timeZone}
            </span>
          )}
        </div>
      </div>
    </CardFrame>
  );
};

registerWantCardPlugin({
  types: ['date_and_time'],
  ContentSection: DateAndTimeContentSection,
});
