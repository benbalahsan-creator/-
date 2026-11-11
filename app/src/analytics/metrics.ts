import type { Employee } from '../data/types';
import { ORG, hebrewSchoolYear, schoolYearStart } from '../config/org';

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

/* ---------- מדדים ייעודיים לארגון צהרונים (לפי שנת לימודים) ---------- */


const NA = 'לא צוין';

export interface SchoolYearRow {
  label: string;
  /** תאריך הספירה: 15 באוקטובר (אחרי שהשנה התייצבה), או היום אם השנה הנוכחית טרם הגיעה לשם */
  countDate: Date;
  headcount: number;
  hires: number;
  leavers: number;
  /** מתוך הפעילים בסוף השנה הקודמת (15.6) — כמה פעילים בתאריך הספירה */
  retention: number | null;
  current: boolean;
}

/** השוואה בין שנות לימודים (ברירת מחדל: 4 שנים אחרונות) */
export function schoolYearComparison(emps: Employee[], years = 4, ref = new Date()): SchoolYearRow[] {
  const cur = schoolYearStart(ref);
  const rows: SchoolYearRow[] = [];
  for (let i = years - 1; i >= 0; i--) {
    const start = new Date(cur.getFullYear() - i, cur.getMonth(), 1);
    const end = new Date(start.getFullYear() + 1, start.getMonth(), 0, 23, 59);
    const isCurrent = i === 0;
    const oct15 = new Date(start.getFullYear(), start.getMonth() + 1, 15);
    const countDate = isCurrent && ref < oct15 ? ref : oct15;
    // אמצע יוני — עוד לפני סוף השנה, כך שמי שסיים ב-30.6 נכלל בבסיס
    const prevYearEnd = new Date(start.getFullYear(), start.getMonth() - 3, 15); // 15.6
    const base = emps.filter((e) => isActiveAt(e, prevYearEnd));
    const stayed = base.filter((e) => isActiveAt(e, countDate)).length;
    const until = isCurrent ? ref : end;
    rows.push({
      label: hebrewSchoolYear(start.getFullYear()),
      countDate,
      headcount: emps.filter((e) => isActiveAt(e, countDate)).length,
      hires: emps.filter((e) => within(e.startDate, new Date(start.getTime() - 1), until)).length,
      leavers: emps.filter((e) => within(e.endDate, new Date(start.getTime() - 1), until)).length,
      retention: base.length ? stayed / base.length : null,
      current: isCurrent,
    });
  }
  return rows;
}

/** נשירה מוקדמת: מבין שנקלטו ב-12 החודשים האחרונים (ושעברו כבר N ימים) — כמה עזבו תוך N ימים */
export function earlyAttrition(emps: Employee[], ref = new Date()) {
  const days = ORG.earlyAttritionDays;
  const yearAgo = monthsAgo(ref, 12);
  const cutoff = new Date(ref.getTime() - days * DAY);
  const cohort = emps.filter((e) => e.startDate && e.startDate > yearAgo && e.startDate <= cutoff);
  const early = cohort.filter((e) => e.endDate && e.endDate.getTime() - e.startDate!.getTime() <= days * DAY).length;
  return { cohort: cohort.length, early, rate: cohort.length ? early / cohort.length : null, days };
}

export interface FrameworkRow {
  name: string;
  authority: string;
  program: string;
  manager: string;
  /** אנשי צוות פעילים היום */
  staff: number;
  fte: number;
  /** תקן: מעמודת "תקן" בקובץ, או ברירת מחדל לפי סוג פעילות */
  required: number;
  /** האם התקן הגיע מהקובץ (true) או מברירת המחדל (false) */
  requiredFromFile: boolean;
  /** staff - required: שלילי = חוסר */
  gap: number;
  status: 'short' | 'full' | 'over';
  leavers12m: number;
}

export type StaffingDefaults = { match: string; required: number }[];

export function defaultRequired(program: string, defaults: StaffingDefaults): number {
  const hit = defaults.find((d) => new RegExp(d.match).test(program));
  return hit ? hit.required : 1;
}

/**
 * מצבת לפי מסגרת (גן / בית ספר) מול התקן.
 * כוללת גם מסגרות שאין בהן אף עובד/ת היום אבל היו פעילות ב-60 הימים האחרונים (חוסר מלא).
 */
export function frameworks(emps: Employee[], defaults: StaffingDefaults = ORG.defaultStaffing, ref = new Date()): FrameworkRow[] {
  const yearAgo = monthsAgo(ref, 12);
  const recent = new Date(ref.getTime() - 60 * DAY);
  const m = new Map<string, Employee[]>();
  for (const e of emps) {
    if (e.site === NA || ORG.nonFrameworkPattern.test(e.program) || ORG.nonFrameworkPattern.test(e.site)) continue;
    // מפתח כולל סוג פעילות: חוג שפועל בתוך בית ספר הוא "מסגרת" נפרדת מהצהרון באותו מקום
    const k = `${e.department}|${e.site}|${e.program}`;
    const list = m.get(k);
    if (list) list.push(e);
    else m.set(k, [e]);
  }
  const out: FrameworkRow[] = [];
  for (const [, list] of m) {
    const active = list.filter((e) => isActiveAt(e, ref));
    if (!active.length && !list.some((e) => isActiveAt(e, recent))) continue;
    const pool = active.length ? active : list;
    const top = (key: keyof Employee) => {
      const c = new Map<string, number>();
      pool.forEach((e) => c.set(String(e[key]), (c.get(String(e[key])) ?? 0) + 1));
      return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    const program = top('program');
    const fileReq = Math.max(0, ...list.map((e) => e.requiredStaff ?? 0));
    const required = fileReq > 0 ? fileReq : defaultRequired(program, defaults);
    const gap = active.length - required;
    out.push({
      name: list[0].site,
      authority: list[0].department,
      program: list[0].program !== NA ? list[0].program : program,
      manager: top('manager'),
      staff: active.length,
      fte: active.reduce((s, e) => s + e.scopePercent / 100, 0),
      required,
      requiredFromFile: fileReq > 0,
      gap,
      status: gap < 0 ? 'short' : gap > 0 ? 'over' : 'full',
      leavers12m: list.filter((e) => within(e.endDate, yearAgo, ref)).length,
    });
  }
  // חוסרים קודם (הגדולים ביותר), אחר כך עודף, ואז מלאות
  const rank = { short: 0, over: 1, full: 2 } as const;
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.gap - b.gap || a.authority.localeCompare(b.authority, 'he'));
}

/* ---------- ותק ---------- */

/** ותק בשנים: עד היום, או עד תאריך העזיבה */
export function tenureYears(e: Employee, ref = new Date()): number | null {
  if (!e.startDate) return null;
  const end = e.endDate && e.endDate < ref ? e.endDate : ref;
  return Math.max(0, (end.getTime() - e.startDate.getTime()) / YEAR);
}

export const fmtTenure = (y: number | null) => {
  if (y == null) return '—';
  if (y < 0.25) return `${Math.max(0, Math.round(y * 365.25))} ימים`;
  if (y < 1) return `${Math.round(y * 12)} ח׳`;
  return `${fmt1(y)} שנ׳`;
};

const TENURE_BANDS: [number, string][] = [
  [0.25, 'עד 3 חודשים'],
  [1, '3–12 חודשים'],
  [2, '1–2 שנים'],
  [3, '2–3 שנים'],
  [5, '3–5 שנים'],
  [Infinity, '5 שנים ומעלה'],
];
const bandOf = (y: number) => TENURE_BANDS.findIndex(([max]) => y < max);

export const isHourlyWage = (w: number | null): w is number => w != null && w > 0 && w < ORG.hourlyWageMax;

export interface TenureRow {
  name: string;
  active: number;
  share: number;
  /** שכר שעתי ממוצע (רק עובדים שעתיים) */
  avgHourly: number | null;
  /** עזבו ב-12 החודשים האחרונים, לפי הוותק ביום העזיבה */
  leavers12m: number;
}

export function tenureTable(emps: Employee[], ref = new Date()): TenureRow[] {
  const yearAgo = monthsAgo(ref, 12);
  const rows = TENURE_BANDS.map(([, name]) => ({ name, active: 0, share: 0, wages: [] as number[], leavers12m: 0 }));
  let total = 0;
  for (const e of emps) {
    const y = tenureYears(e, ref);
    if (y == null) continue;
    const r = rows[bandOf(y)];
    if (isActiveAt(e, ref)) {
      r.active++;
      total++;
      if (isHourlyWage(e.wage)) r.wages.push(e.wage);
    } else if (within(e.endDate, yearAgo, ref)) r.leavers12m++;
  }
  return rows.map(({ wages, ...r }) => ({ ...r, share: total ? r.active / total : 0, avgHourly: avg(wages) }));
}

/* ---------- שכר ---------- */

/** חציון שכר לכל תפקיד (בקרב פעילים) — לסימון "רמת שכר" ביחס לתפקיד */
export function wageMedianByRole(emps: Employee[], ref = new Date()): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const e of emps) {
    if (e.wage == null || !isActiveAt(e, ref)) continue;
    const list = by.get(e.role);
    if (list) list.push(e.wage);
    else by.set(e.role, [e.wage]);
  }
  const out = new Map<string, number>();
  for (const [role, ws] of by) {
    ws.sort((a, b) => a - b);
    const mid = Math.floor(ws.length / 2);
    out.set(role, ws.length % 2 ? ws[mid] : (ws[mid - 1] + ws[mid]) / 2);
  }
  return out;
}

export const fmtWage = (w: number | null) =>
  w == null ? '—' : isHourlyWage(w) ? `₪${w.toLocaleString('he-IL', { maximumFractionDigits: 2 })}/ש׳` : `₪${Math.round(w).toLocaleString('he-IL')}/ח׳`;

/** העלאה: ≤1 → שבר (0.05 = 5%), ≤30 → אחוזים, אחרת סכום בש"ח */
export const fmtRaise = (v: number | null) => {
  if (v == null) return '—';
  if (v > 0 && v <= 1) return `${(v * 100).toLocaleString('he-IL', { maximumFractionDigits: 1 })}%`;
  if (v <= 30) return `${v.toLocaleString('he-IL', { maximumFractionDigits: 1 })}%`;
  return `₪${Math.round(v).toLocaleString('he-IL')}`;
};

/* ---------- שעות החודש ---------- */

/** ימי עבודה (לפי ORG.workDays) בין שני תאריכים, כולל שניהם */
export function workdaysBetween(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (d <= end) {
    if (ORG.workDays.includes(d.getDay())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

export interface HoursRow {
  key: string;
  name: string;
  sub: string;
  employees: number;
  /** שעות מתוכננות מתחילת החודש ועד היום (לפי שעות שבועיות ותקופת העסקה) */
  planned: number;
  /** שעות בפועל (null אם אין בקובץ) */
  actual: number | null;
}

export type HoursGroup = 'department' | 'site' | 'employee';

export function monthHours(emps: Employee[], group: HoursGroup, ref = new Date()) {
  const mStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const daysSoFar = workdaysBetween(mStart, today);
  const perDay = ORG.workDays.length;
  const m = new Map<string, HoursRow>();
  let anyActual = false;
  for (const e of emps) {
    if (e.startDate && e.startDate > today) continue;
    if (e.endDate && e.endDate < mStart) continue;
    const from = e.startDate && e.startDate > mStart ? e.startDate : mStart;
    const to = e.endDate && e.endDate < today ? new Date(e.endDate.getTime() - DAY) : today;
    const days = to >= from ? workdaysBetween(from, to) : 0;
    const weekly = e.weeklyHours ?? (e.scopePercent / 100) * ORG.fullTimeWeeklyHours;
    const planned = (weekly / perDay) * days;
    const [key, name, sub] =
      group === 'employee' ? [e.id, e.fullName, `${e.site} · ${e.department}`]
      : group === 'site' ? [`${e.department}|${e.site}`, e.site, e.department]
      : [e.department, e.department, ''];
    const r = m.get(key) ?? { key, name, sub, employees: 0, planned: 0, actual: null };
    r.employees++;
    r.planned += planned;
    if (e.hoursThisMonth != null) {
      anyActual = true;
      r.actual = (r.actual ?? 0) + e.hoursThisMonth;
    }
    m.set(key, r);
  }
  const rows = [...m.values()].sort((a, b) => b.planned - a.planned);
  const total = rows.reduce(
    (t, r) => ({ planned: t.planned + r.planned, actual: r.actual == null ? t.actual : (t.actual ?? 0) + r.actual, employees: t.employees + r.employees }),
    { planned: 0, actual: null as number | null, employees: 0 },
  );
  return { rows, total, anyActual, from: mStart, to: today, daysSoFar, daysInMonth: workdaysBetween(mStart, new Date(ref.getFullYear(), ref.getMonth() + 1, 0)) };
}
