import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Bucket, GroupRow, TrendPoint } from '../analytics/metrics';
import { fmt1, fmtInt } from '../analytics/metrics';
import { usePalette } from './theme';

interface TipItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
}
function Tip({ active, label, payload, fmt = (v: number) => fmtInt(v) }: {
  active?: boolean;
  label?: string | number;
  payload?: TipItem[];
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip" dir="rtl">
      <div className="t">{label}</div>
      {payload.map((p, i) => (
        <div key={i}>
          <i style={{ background: p.color }} />
          {p.name}: <strong>{fmt(Number(p.value))}</strong>
        </div>
      ))}
    </div>
  );
}

const axisProps = { tickLine: false, axisLine: false } as const;

export function HeadcountTrend({ data }: { data: TrendPoint[] }) {
  const pal = usePalette();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" reversed {...axisProps} interval="preserveStartEnd" minTickGap={24} />
        <YAxis orientation="right" {...axisProps} width={40} allowDecimals={false} domain={['auto', 'auto']} />
        <Tooltip content={<Tip />} cursor={{ stroke: pal.axis }} />
        <Line type="monotone" dataKey="headcount" name="עובדים פעילים" stroke={pal.s1} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: pal.surface, strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HiresLeavers({ data }: { data: TrendPoint[] }) {
  const pal = usePalette();
  return (
    <>
      <div className="legend">
        <span><i style={{ background: pal.s1 }} />נקלטו</span>
        <span><i style={{ background: pal.s2 }} />עזבו</span>
      </div>
      <ResponsiveContainer width="100%" height={236}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" reversed {...axisProps} interval="preserveStartEnd" minTickGap={24} />
          <YAxis orientation="right" {...axisProps} width={32} allowDecimals={false} />
          <Tooltip content={<Tip />} cursor={{ fill: pal.grid, opacity: 0.5 }} />
          <Bar dataKey="hires" name="נקלטו" fill={pal.s1} radius={[4, 4, 0, 0]} />
          <Bar dataKey="leavers" name="עזבו" fill={pal.s2} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/** עמודות אופקיות (RTL: התוויות מימין, העמודות גדלות שמאלה) */
export function HBar({ data, valueKey = 'count', name = 'עובדים', fmt }: {
  data: (GroupRow | Bucket)[];
  valueKey?: 'count' | 'fte';
  name?: string;
  fmt?: (v: number) => string;
}) {
  const pal = usePalette();
  const f = fmt ?? (valueKey === 'fte' ? (v: number) => fmt1(v) : fmtInt);
  const height = Math.max(120, data.length * 34 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 32, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" reversed hide />
        <YAxis type="category" dataKey="name" orientation="right" {...axisProps} width={130} />
        <Tooltip content={<Tip fmt={f} />} cursor={{ fill: pal.grid, opacity: 0.5 }} />
        <Bar
          dataKey={valueKey}
          name={name}
          fill={pal.s1}
          radius={[4, 0, 0, 4]}
          maxBarSize={28}
        >
          <LabelList
            dataKey={valueKey}
            content={(p) => {
              const x = Number(p.x), w = Number(p.width), y = Number(p.y), h = Number(p.height);
              // ציר הפוך: קצה העמודה הוא הנקודה השמאלית מבין x ו-x+width
              return (
                <text x={Math.min(x, x + w) - 6} y={y + h / 2} dy="0.35em" textAnchor="end" fill="var(--text-2)" fontSize={12}>
                  {f(Number(p.value))}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** התפלגות (עמודות אנכיות) — ותק / גיל */
export function Distribution({ data }: { data: Bucket[] }) {
  const pal = usePalette();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" reversed {...axisProps} interval={0} />
        <YAxis orientation="right" {...axisProps} width={32} allowDecimals={false} />
        <Tooltip content={<Tip />} cursor={{ fill: pal.grid, opacity: 0.5 }} />
        <Bar dataKey="count" name="עובדים" fill={pal.s1} radius={[4, 4, 0, 0]} maxBarSize={64} />
      </BarChart>
    </ResponsiveContainer>
  );
}
