import { useMemo, useState } from 'react';
import {
  ageBuckets,
  computeKpis,
  earlyAttrition,
  fmt1,
  fmtDate,
  fmtInt,
  fmtMoney,
  fmtPct,
  fmtRaise,
  fmtTenure,
  fmtWage,
  frameworks,
  monthPay,
  requiredByGroup,
  tenureTable,
  tenureYears,
  wageMedianByRole,
  type StaffingDefaults,
  groupActive,
  isActiveAt,
  monthlyTrend,
  recentMovements,
  schoolYearComparison,
  turnoverByGroup,
} from '../analytics/metrics';
import { ORG } from '../config/org';
import type { ColumnMapping, Employee } from '../data/types';
import { Distribution, HBar, HeadcountTrend, HiresLeavers } from './Charts';
import { LeaversTable, MonthHoursTable, Phone, StaffingTable, TenureTable } from './Tables';

interface Props {
  employees: Employee[];
  mapping: ColumnMapping;
}

type FilterKey = 'department' | 'program' | 'manager' | 'employmentType';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'department', label: 'רשות' },
  { key: 'program', label: 'סוג פעילות' },
  { key: 'manager', label: 'רכזת' },
  { key: 'employmentType', label: 'סוג העסקה' },
];

const BREAKDOWNS: { key: 'department' | 'program' | 'role'; label: string }[] = [
  { key: 'department', label: 'רשות' },
  { key: 'program', label: 'סוג פעילות' },
  { key: 'role', label: 'תפקיד' },
];

const STD_KEY = 'hr-dashboard:staffing-defaults';
function loadDefaults(): StaffingDefaults {
  try {
    const v = JSON.parse(localStorage.getItem(STD_KEY) ?? 'null');
    if (Array.isArray(v) && v.length === ORG.defaultStaffing.length) return v;
  } catch {
    /* ignore */
  }
  return ORG.defaultStaffing;
}

const isSeasonal = (e: Employee) => ORG.seasonalPattern.test(e.program) || ORG.seasonalPattern.test(e.role);

export function Dashboard({ employees, mapping }: Props) {
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [withSeasonal, setWithSeasonal] = useState(false);
  const [breakdown, setBreakdown] = useState<'department' | 'program' | 'role'>('department');
  const [measure, setMeasure] = useState<'staff' | 'required'>('staff');
  const [stdDefaults, setStdDefaults] = useState<StaffingDefaults>(loadDefaults);
  const updateDefaults = (d: StaffingDefaults) => {
    setStdDefaults(d);
    try {
      localStorage.setItem(STD_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  };

  const hasSeasonal = useMemo(() => employees.some(isSeasonal), [employees]);
  const base = useMemo(() => (withSeasonal ? employees : employees.filter((e) => !isSeasonal(e))), [employees, withSeasonal]);

  const options = useMemo(() => {
    const o = {} as Record<FilterKey, string[]>;
    for (const f of FILTERS) o[f.key] = [...new Set(base.map((e) => e[f.key]))].sort((a, b) => a.localeCompare(b, 'he'));
    return o;
  }, [base]);

  const data = useMemo(
    () => base.filter((e) => FILTERS.every((f) => !filters[f.key] || e[f.key] === filters[f.key])),
    [base, filters],
  );

  const kpis = useMemo(() => computeKpis(data), [data]);
  const years = useMemo(() => schoolYearComparison(data, 4), [data]);
  const early = useMemo(() => earlyAttrition(data), [data]);
  const fw = useMemo(() => frameworks(data, stdDefaults), [data, stdDefaults]);
  const pay = useMemo(() => monthPay(data), [data]);
  const trend = useMemo(() => monthlyTrend(data, 24), [data]);
  const groups = useMemo(() => groupActive(data, breakdown, 12), [data, breakdown]);
  const reqGroups = useMemo(
    () => (breakdown === 'role' ? null : requiredByGroup(fw, breakdown === 'department' ? 'authority' : 'program')),
    [fw, breakdown],
  );
  const tenure = useMemo(() => tenureTable(data), [data]);
  const ages = useMemo(() => ageBuckets(data), [data]);
  const turnover = useMemo(() => turnoverByGroup(data, 'department'), [data]);
  const moves = useMemo(() => recentMovements(data, 90), [data]);

  const has = (k: keyof Employee) => !!mapping[k];
  const visibleFilters = FILTERS.filter((f) => has(f.key) && options[f.key].length > 1);
  const visibleBreakdowns = BREAKDOWNS.filter((b) => has(b.key));
  const delta = kpis.active - kpis.headcountYearAgo;
  const cur = years[years.length - 1];
  const short = fw.filter((f) => f.status === 'short');
  const fullCount = fw.filter((f) => f.status !== 'short').length;
  const missing = short.reduce((s, f) => s - f.gap, 0);

  return (
    <>
      <div className="filters">
        {visibleFilters.map((f) => (
          <label key={f.key}>
            {f.label}
            <select value={filters[f.key] ?? ''} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value || undefined })}>
              <option value="">הכל</option>
              {options[f.key].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        {hasSeasonal && (
          <label className="check">
            <span>
              <input type="checkbox" checked={withSeasonal} onChange={(e) => setWithSeasonal(e.target.checked)} /> כולל צוות קייטנות
            </span>
          </label>
        )}
        {Object.values(filters).some(Boolean) && (
          <button className="btn link" onClick={() => setFilters({})}>ניקוי סינון</button>
        )}
      </div>

      <div className="grid kpis">
        <Kpi label="עובדים פעילים" value={fmtInt(kpis.active)}
          hint={<span className={delta >= 0 ? 'delta-up' : 'delta-down'}>{delta >= 0 ? '▲' : '▼'} {fmtInt(Math.abs(delta))} לעומת לפני שנה</span>} />
        <Kpi label="משרות מלאות (FTE)" value={fmt1(kpis.fte)} hint={has('weeklyHours') && !has('scopePercent') ? `לפי ${ORG.fullTimeWeeklyHours} ש"ש למשרה` : 'סכום היקפי המשרה'} />
        {has('site') && (
          <Kpi label="מסגרות במצבה מלאה" value={`${fmtInt(fullCount)}/${fmtInt(fw.length)}`}
            hint={short.length ? <span className="delta-down">⚠ {fmtInt(short.length)} בחוסר · {fmtInt(missing)} תקנים פתוחים</span> : <span className="delta-up">✓ אין חוסרים היום</span>} />
        )}
        {has('hoursThisMonth') && pay.totalHours != null && (
          <Kpi label="שעות בפועל החודש" value={fmt1(pay.totalHours)} hint={has('wage') && pay.totalPay != null ? `משכורת מצטברת: ₪${fmtInt(pay.totalPay)}` : `${fmtInt(pay.worked)} עובדים`} />
        )}
        <Kpi label={`שימור צוות לשנה"ל ${cur.label}`} value={fmtPct(cur.retention)} hint="מהפעילים ב-15.6 — פעילים כעת" />
        <Kpi label={`נקלטו בשנה"ל ${cur.label}`} value={fmtInt(cur.hires)} hint={`עזבו: ${fmtInt(cur.leavers)}`} />
        <Kpi label="תחלופה שנתית" value={fmtPct(kpis.turnover12m)} hint="עוזבים ב-12 ח׳ ÷ ממוצע מצבת" />
        <Kpi label="נשירה מוקדמת" value={fmtPct(early.rate)} hint={`עזבו תוך ${early.days} יום (${fmtInt(early.early)} מתוך ${fmtInt(early.cohort)})`} />
        <Kpi label="ותק ממוצע" value={kpis.avgTenureYears == null ? '—' : `${fmt1(kpis.avgTenureYears)} שנים`} />
        {has('birthDate') && <Kpi label="גיל ממוצע" value={kpis.avgAge == null ? '—' : fmt1(kpis.avgAge)} />}
        {has('monthlyCost') && <Kpi label="עלות שכר חודשית" value={fmtMoney(kpis.monthlyCost)} hint="עובדים פעילים" />}
      </div>

      <div className="stack">
        <EmployeeTable employees={data} mapping={mapping} />
        {has('site') && <StaffingTable rows={fw} defaults={stdDefaults} onDefaultsChange={updateDefaults} />}
        <MonthHoursTable employees={data} hasHours={has('hoursThisMonth')} hasWage={has('wage')} />
      </div>

      <div className="grid charts">
        <div className="card">
          <h2>מצבת עובדים לאורך זמן</h2>
          <div className="sub">עובדים פעילים בסוף כל חודש. הירידה ביולי–אוגוסט היא סיום שנת הלימודים והקליטה לקראת ספטמבר</div>
          <HeadcountTrend data={trend} />
        </div>
        <div className="card">
          <h2>קליטות ועזיבות</h2>
          <div className="sub">לפי חודש — שימו לב לעונתיות סביב תחילת וסוף שנת הלימודים</div>
          <HiresLeavers data={trend} />
        </div>

        <div className="card">
          <h2>השוואה בין שנות לימודים</h2>
          <div className="sub">מצבת ב-15.10 של כל שנה; שימור = מהפעילים ב-15.6 שקדם לה</div>
          <div className="tbl-wrap">
            <table className="data">
              <thead>
                <tr><th>שנה"ל</th><th>מצבת</th><th>נקלטו</th><th>עזבו</th><th>שימור מהשנה הקודמת</th></tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y.label}>
                    <td>{y.label}{y.current ? ' (נוכחית)' : ''}</td>
                    <td>{fmtInt(y.headcount)}</td>
                    <td>{fmtInt(y.hires)}</td>
                    <td>{fmtInt(y.leavers)}</td>
                    <td>{fmtPct(y.retention)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cur.current && <div className="preview" style={{ marginTop: 8 }}>בשנה הנוכחית: קליטות ועזיבות מתחילת השנה ועד היום</div>}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>פילוח עובדים ותקנים</h2>
            <div className="seg" role="group" aria-label="מדד">
              <button className={measure === 'staff' ? 'on' : ''} onClick={() => setMeasure('staff')}>עובדים</button>
              <button className={measure === 'required' ? 'on' : ''} onClick={() => setMeasure('required')} disabled={!has('site')}>תקנים</button>
            </div>
          </div>
          <div className="tabs">
            {visibleBreakdowns.map((b) => (
              <button key={b.key} className={breakdown === b.key ? 'on' : ''} onClick={() => setBreakdown(b.key)}>{b.label}</button>
            ))}
          </div>
          {measure === 'staff' ? (
            <HBar data={groups} valueKey="count" name="עובדים" />
          ) : reqGroups ? (
            <>
              <div className="sub">תקני צוות במסגרות (לפי מצבת המסגרות){fw.some((f) => !f.requiredFromFile) ? ', כולל תקני ברירת מחדל' : ''}</div>
              <HBar data={reqGroups} valueKey="count" name="תקנים" />
            </>
          ) : (
            <div className="notice" style={{ marginTop: 8 }}>
              אין תקן לפי תפקיד בנתונים — התקן מוגדר לכל מסגרת. בחרו "רשות" או "סוג פעילות", או הוסיפו לקובץ עמודת תקן לפי תפקיד.
            </div>
          )}
        </div>

        <div className="card">
          <h2>תחלופה לפי רשות</h2>
          <div className="sub">12 חודשים אחרונים, מהגבוהה לנמוכה</div>
          <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr><th>רשות</th><th>פעילים</th><th>עזבו</th><th>תחלופה</th></tr>
              </thead>
              <tbody>
                {turnover.map((t) => (
                  <tr key={t.name}>
                    <td>{t.name}</td>
                    <td>{fmtInt(t.active)}</td>
                    <td>{fmtInt(t.leavers)}</td>
                    <td>{fmtPct(t.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <TenureTable rows={tenure} hasWage={has('wage')} />
        {has('birthDate') && (
          <div className="card">
            <h2>התפלגות גילאים</h2>
            <div className="sub">עובדים פעילים</div>
            <Distribution data={ages} />
          </div>
        )}

        <div className="card">
          <h2>קליטות אחרונות ({fmtInt(moves.hires.length)})</h2>
          <div className="sub">90 הימים האחרונים</div>
          <RecentHires hires={moves.hires} />
        </div>
      </div>

      <div className="stack">
        <LeaversTable employees={data} />
      </div>
    </>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function RecentHires({ hires }: { hires: Employee[] }) {
  return (
    <div className="tbl-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
      <table className="data">
        <thead><tr><th>שם</th><th>טלפון</th><th>עיר מגורים</th><th>רשות</th><th>מסגרת</th><th>תפקיד</th><th>תחילת עבודה</th></tr></thead>
        <tbody>
          {hires.map((e) => (
            <tr key={e.id}>
              <td>{e.fullName}</td>
              <td><Phone v={e.phone} /></td>
              <td>{e.residenceCity || '—'}</td>
              <td>{e.department}</td>
              <td>{e.site}</td>
              <td>{e.role}</td>
              <td>{fmtDate(e.startDate)}</td>
            </tr>
          ))}
          {!hires.length && <tr><td colSpan={7} className="empty">אין קליטות בתקופה</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

type SortKey = 'phone' | 'residenceCity' | 'fullName' | 'department' | 'role' | 'site' | 'employmentType' | 'weeklyHours' | 'startDate' | 'tenure' | 'wage' | 'lastRaiseDate' | 'hoursThisMonth';
const COLS: { key: SortKey; label: string; field?: keyof Employee }[] = [
  { key: 'fullName', label: 'שם' },
  { key: 'phone', label: 'טלפון' },
  { key: 'residenceCity', label: 'עיר מגורים' },
  { key: 'department', label: 'רשות' },
  { key: 'site', label: 'מסגרת' },
  { key: 'role', label: 'תפקיד' },
  { key: 'employmentType', label: 'סוג העסקה' },
  { key: 'weeklyHours', label: 'היקף' },
  { key: 'startDate', label: 'תחילת עבודה' },
  { key: 'tenure', label: 'ותק', field: 'startDate' },
  { key: 'wage', label: 'רמת שכר', field: 'wage' },
  { key: 'lastRaiseDate', label: 'העלאה אחרונה', field: 'lastRaiseDate' },
  { key: 'hoursThisMonth', label: 'שעות החודש', field: 'hoursThisMonth' },
];

function EmployeeTable({ employees, mapping }: { employees: Employee[]; mapping: ColumnMapping }) {
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'fullName', dir: 1 });
  const now = useMemo(() => new Date(), []);
  const medians = useMemo(() => wageMedianByRole(employees, now), [employees, now]);
  const cols = COLS.filter((c) => !c.field || mapping[c.field]);

  const sortVal = (e: Employee, k: SortKey): number | string => {
    switch (k) {
      case 'tenure': return tenureYears(e, now) ?? -1;
      case 'weeklyHours': return e.weeklyHours ?? e.scopePercent;
      case 'startDate': case 'lastRaiseDate': return e[k]?.getTime() ?? 0;
      case 'wage': case 'hoursThisMonth': return e[k] ?? -1;
      default: return e[k];
    }
  };

  const rows = useMemo(() => {
    const s = q.trim();
    const list = employees.filter(
      (e) =>
        (!onlyActive || isActiveAt(e, now)) &&
        (!s || [e.fullName, e.department, e.role, e.site, e.manager, e.id, e.phone, e.residenceCity].some((v) => v.includes(s))),
    );
    return list.sort((a, b) => {
      const va = sortVal(a, sort.key), vb = sortVal(b, sort.key);
      const c = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb), 'he');
      return c * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, q, onlyActive, sort, now]);

  const level = (e: Employee) => {
    const med = medians.get(e.role);
    if (e.wage == null || !med) return null;
    const d = e.wage / med - 1;
    if (d >= 0.07) return <span className="lvl up" title={`מעל חציון התפקיד (${fmtWage(med)})`}>▲ מעל</span>;
    if (d <= -0.07) return <span className="lvl down" title={`מתחת לחציון התפקיד (${fmtWage(med)})`}>▼ מתחת</span>;
    return <span className="lvl mid" title={`חציון התפקיד: ${fmtWage(med)}`}>בחציון</span>;
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>רשימת עובדים ({fmtInt(rows.length)})</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem' }}>
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> פעילים בלבד
          </label>
          <input className="search" placeholder="חיפוש שם / טלפון / עיר / מסגרת…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {mapping.wage && <div className="sub">רמת שכר: ביחס לחציון השכר של אותו תפקיד (±7%). העבירו את העכבר לפרטים.</div>}
      <div className="tbl-wrap" style={{ maxHeight: 520, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? (-sort.dir as 1 | -1) : 1 })}>
                  {c.label} {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : ''}
                </th>
              ))}
              {!onlyActive && <th>סיום</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((e) => (
              <tr key={e.id}>
                <td>{e.fullName}</td>
                <td><Phone v={e.phone} /></td>
                <td>{e.residenceCity || '—'}</td>
                <td>{e.department}</td>
                <td>{e.site}</td>
                <td>{e.role}</td>
                <td>{e.employmentType}</td>
                <td>{e.weeklyHours != null ? `${fmtInt(e.weeklyHours)} ש"ש` : `${Math.round(e.scopePercent)}%`}</td>
                <td>{fmtDate(e.startDate)}</td>
                <td>{fmtTenure(tenureYears(e, now))}</td>
                {mapping.wage && <td>{fmtWage(e.wage)} {level(e)}</td>}
                {mapping.lastRaiseDate && <td>{e.lastRaiseDate ? <>{fmtDate(e.lastRaiseDate)} <span className="cell-sub">({fmtRaise(e.lastRaise)})</span></> : <span className="cell-sub">אין</span>}</td>}
                {mapping.hoursThisMonth && <td>{e.hoursThisMonth == null ? '—' : fmt1(e.hoursThisMonth)}</td>}
                {!onlyActive && <td>{fmtDate(e.endDate)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 500 && <div className="preview" style={{ padding: 8 }}>מוצגות 500 שורות ראשונות — צמצמו בחיפוש</div>}
      </div>
    </div>
  );
}
