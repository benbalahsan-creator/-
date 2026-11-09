import type { Employee } from '../data/types';

const DAY = 86400000;
const YEAR = 365.25 * DAY;

export function isActiveAt(e: Employee, at: Date): boolean {
  const t = at.getTime();
  if (e.startDate && e.startDate.getTime() > t) return false;
  if (e.endDate && e.endDate.getTime() <= t) return false;
  return true;
}

const monthsAgo = (ref: Date, n: number) => new Date(ref.getFullYear(), ref.getMonth() - n, ref.getDate());
const within = (d: Date | null, from: Date, to: Date) => !!d && d > from && d <= to;

export interface Kpis {
  active: number;
  fte: number;
  hires12m: number;
  leavers12m: number;
  /** שיעור תחלופה שנתי: עוזבים / ממוצע מצבת (תחילת+סוף תקופה) */
  turnover12m: number | null;
  avgTenureYears: number | null;
  avgAge: number | null;
  monthlyCost: number | null;
  headcountYearAgo: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeKpis(emps: Employee[], ref = new Date()): Kpis {
  const yearAgo = monthsAgo(ref, 12);
  const active = emps.filter((e) => isActiveAt(e, ref));
  const headcountYearAgo = emps.filter((e) => isActiveAt(e, yearAgo)).length;
  const leavers12m = emps.filter((e) => within(e.endDate, yearAgo, ref)).length;
  const avgHc = (active.length + headcountYearAgo) / 2;
  const costs = active.map((e) => e.monthlyCost).filter((c): c is number => c != null);
  return {
    active: active.length,
    fte: active.reduce((s, e) => s + e.scopePercent / 100, 0),
    hires12m: emps.filter((e) => within(e.startDate, yearAgo, ref)).length,
    leavers12m,
    turnover12m: avgHc > 0 ? leavers12m / avgHc : null,
    avgTenureYears: avg(active.filter((e) => e.startDate).map((e) => (ref.getTime() - e.startDate!.getTime()) / YEAR)),
    avgAge: avg(active.filter((e) => e.birthDate).map((e) => (ref.getTime() - e.birthDate!.getTime()) / YEAR)),
    monthlyCost: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
    headcountYearAgo,
  };
}

export interface TrendPoint {
  key: string;
  label: string;
  headcount: number;
  hires: number;
  leavers: number;
}

const HE_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

/** מגמה חודשית: מצבת בסוף כל חודש + קליטות ועזיבות בחודש */
export function monthlyTrend(emps: Employee[], months = 24, ref = new Date()): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const mStart = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const mEnd = i === 0 ? ref : new Date(ref.getFullYear(), ref.getMonth() - i + 1, 0, 23, 59);
    const prev = new Date(mStart.getTime() - 1);
    out.push({
      key: `${mStart.getFullYear()}-${mStart.getMonth() + 1}`,
      label: `${HE_MONTHS[mStart.getMonth()]} ${String(mStart.getFullYear()).slice(2)}`,
      headcount: emps.filter((e) => isActiveAt(e, mEnd)).length,
      hires: emps.filter((e) => within(e.startDate, prev, mEnd)).length,
      leavers: emps.filter((e) => within(e.endDate, prev, mEnd)).length,
    });
  }
  return out;
}

export interface GroupRow {
  name: string;
  count: number;
  fte: number;
  share: number;
}

/** פילוח עובדים פעילים לפי שדה. קבוצות מעבר ל-maxGroups מקובצות ל"אחר" */
export function groupActive(emps: Employee[], key: keyof Employee, maxGroups = 8, ref = new Date()): GroupRow[] {
  const active = emps.filter((e) => isActiveAt(e, ref));
  const m = new Map<string, { count: number; fte: number }>();
  for (const e of active) {
    const k = String(e[key]);
    const g = m.get(k) ?? { count: 0, fte: 0 };
    g.count++;
    g.fte += e.scopePercent / 100;
    m.set(k, g);
  }
  let rows = [...m.entries()].map(([name, g]) => ({ name, ...g, share: g.count / (active.length || 1) }));
  rows.sort((a, b) => b.count - a.count);
  if (rows.length > maxGroups) {
    const rest = rows.slice(maxGroups - 1);
    rows = rows.slice(0, maxGroups - 1);
    rows.push({
      name: 'אחר',
      count: rest.reduce((s, r) => s + r.count, 0),
      fte: rest.reduce((s, r) => s + r.fte, 0),
      share: rest.reduce((s, r) => s + r.share, 0),
    });
  }
  return rows;
}

export interface Bucket {
  name: string;
  count: number;
}

function bucketize(values: number[], edges: [number, string][]): Bucket[] {
  const out = edges.map(([, name]) => ({ name, count: 0 }));
  for (const v of values) {
    let idx = edges.findIndex(([max]) => v < max);
    if (idx === -1) idx = edges.length - 1;
    out[idx].count++;
  }
  return out;
}

export function tenureBuckets(emps: Employee[], ref = new Date()): Bucket[] {
  const vals = emps
    .filter((e) => isActiveAt(e, ref) && e.startDate)
    .map((e) => (ref.getTime() - e.startDate!.getTime()) / YEAR);
  return bucketize(vals, [[1, 'עד שנה'], [3, '1–3 שנים'], [5, '3–5 שנים'], [10, '5–10 שנים'], [Infinity, '10+ שנים']]);
}

export function ageBuckets(emps: Employee[], ref = new Date()): Bucket[] {
  const vals = emps
    .filter((e) => isActiveAt(e, ref) && e.birthDate)
    .map((e) => (ref.getTime() - e.birthDate!.getTime()) / YEAR);
  return bucketize(vals, [[25, 'עד 25'], [35, '25–34'], [45, '35–44'], [55, '45–54'], [65, '55–64'], [Infinity, '65+']]);
}

export interface DeptTurnover {
  name: string;
  active: number;
  leavers: number;
  rate: number;
}

export function turnoverByGroup(emps: Employee[], key: keyof Employee, ref = new Date()): DeptTurnover[] {
  const yearAgo = monthsAgo(ref, 12);
  const names = [...new Set(emps.map((e) => String(e[key])))];
  return names
    .map((name) => {
      const g = emps.filter((e) => String(e[key]) === name);
      const active = g.filter((e) => isActiveAt(e, ref)).length;
      const before = g.filter((e) => isActiveAt(e, yearAgo)).length;
      const leavers = g.filter((e) => within(e.endDate, yearAgo, ref)).length;
      const avgHc = (active + before) / 2;
      return { name, active, leavers, rate: avgHc > 0 ? leavers / avgHc : 0 };
    })
    .filter((r) => r.active + r.leavers > 0)
    .sort((a, b) => b.rate - a.rate);
}

/** קליטות / עזיבות אחרונות (ב-N הימים האחרונים) */
export function recentMovements(emps: Employee[], days = 90, ref = new Date()) {
  const from = new Date(ref.getTime() - days * DAY);
  const hires = emps.filter((e) => within(e.startDate, from, ref)).sort((a, b) => b.startDate!.getTime() - a.startDate!.getTime());
  const leavers = emps.filter((e) => within(e.endDate, from, ref)).sort((a, b) => b.endDate!.getTime() - a.endDate!.getTime());
  return { hires, leavers };
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('he-IL');
export const fmt1 = (n: number | null) => (n == null ? '—' : n.toLocaleString('he-IL', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
export const fmtPct = (n: number | null) => (n == null ? '—' : `${(n * 100).toLocaleString('he-IL', { maximumFractionDigits: 1 })}%`);
export const fmtMoney = (n: number | null) => (n == null ? '—' : `₪${Math.round(n).toLocaleString('he-IL')}`);
export const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString('he-IL') : '—');
