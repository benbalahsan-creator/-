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
  frameworks,
  groupActive,
  isActiveAt,
  monthlyTrend,
  recentMovements,
  schoolYearComparison,
  tenureBuckets,
  turnoverByGroup,
} from '../analytics/metrics';
import { ORG } from '../config/org';
import type { ColumnMapping, Employee } from '../data/types';
import { Distribution, HBar, HeadcountTrend, HiresLeavers } from './Charts';

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

const BREAKDOWNS: { key: keyof Employee; label: string }[] = [
  { key: 'department', label: 'רשות' },
  { key: 'program', label: 'סוג פעילות' },
  { key: 'role', label: 'תפקיד' },
  { key: 'manager', label: 'רכזת' },
  { key: 'employmentType', label: 'סוג העסקה' },
  { key: 'gender', label: 'מגדר' },
];

const isSeasonal = (e: Employee) => ORG.seasonalPattern.test(e.program) || ORG.seasonalPattern.test(e.role);

export function Dashboard({ employees, mapping }: Props) {
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [withSeasonal, setWithSeasonal] = useState(false);
  const [breakdown, setBreakdown] = useState<keyof Employee>('department');
  const [measure, setMeasure] = useState<'count' | 'fte'>('count');

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
  const fw = useMemo(() => frameworks(data), [data]);
  const trend = useMemo(() => monthlyTrend(data, 24), [data]);
  const groups = useMemo(() => groupActive(data, breakdown, 12), [data, breakdown]);
  const tenure = useMemo(() => tenureBuckets(data), [data]);
  const ages = useMemo(() => ageBuckets(data), [data]);
  const turnover = useMemo(() => turnoverByGroup(data, 'department'), [data]);
  const moves = useMemo(() => recentMovements(data, 90), [data]);

  const has = (k: keyof Employee) => !!mapping[k];
  const visibleFilters = FILTERS.filter((f) => has(f.key) && options[f.key].length > 1);
  const visibleBreakdowns = BREAKDOWNS.filter((b) => has(b.key));
  const delta = kpis.active - kpis.headcountYearAgo;
  const cur = years[years.length - 1];
  const thin = fw.filter((f) => f.staff <= 1);
  const atRisk = fw.filter((f) => f.staff <= 1 || f.leavers12m >= 3).slice(0, 15);

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
        {has('site') && <Kpi label="מסגרות פעילות" value={fmtInt(fw.length)} hint={thin.length ? <span className="delta-down">{fmtInt(thin.length)} עם איש צוות אחד בלבד</span> : 'לכל המסגרות 2+ אנשי צוות'} />}
        <Kpi label={`שימור צוות לשנה"ל ${cur.label}`} value={fmtPct(cur.retention)} hint="מהפעילים ב-15.6 — פעילים כעת" />
        <Kpi label={`נקלטו בשנה"ל ${cur.label}`} value={fmtInt(cur.hires)} hint={`עזבו: ${fmtInt(cur.leavers)}`} />
        <Kpi label="תחלופה שנתית" value={fmtPct(kpis.turnover12m)} hint="עוזבים ב-12 ח׳ ÷ ממוצע מצבת" />
        <Kpi label="נשירה מוקדמת" value={fmtPct(early.rate)} hint={`עזבו תוך ${early.days} יום (${fmtInt(early.early)} מתוך ${fmtInt(early.cohort)})`} />
        <Kpi label="ותק ממוצע" value={kpis.avgTenureYears == null ? '—' : `${fmt1(kpis.avgTenureYears)} שנים`} />
        {has('birthDate') && <Kpi label="גיל ממוצע" value={kpis.avgAge == null ? '—' : fmt1(kpis.avgAge)} />}
        {has('monthlyCost') && <Kpi label="עלות שכר חודשית" value={fmtMoney(kpis.monthlyCost)} hint="עובדים פעילים" />}
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
            <h2>פילוח עובדים פעילים</h2>
            <div className="seg" role="group" aria-label="מדד">
              <button className={measure === 'count' ? 'on' : ''} onClick={() => setMeasure('count')}>ראשים</button>
              <button className={measure === 'fte' ? 'on' : ''} onClick={() => setMeasure('fte')}>משרות</button>
            </div>
          </div>
          <div className="tabs">
            {visibleBreakdowns.map((b) => (
              <button key={b.key} className={breakdown === b.key ? 'on' : ''} onClick={() => setBreakdown(b.key)}>{b.label}</button>
            ))}
          </div>
          <HBar data={groups} valueKey={measure} name={measure === 'fte' ? 'משרות' : 'עובדים'} />
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

        {has('site') && (
          <div className="card">
            <h2>מסגרות שדורשות תשומת לב</h2>
            <div className="sub">איש צוות אחד בלבד, או 3+ עזיבות ב-12 חודשים</div>
            <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="data">
                <thead>
                  <tr><th>מסגרת</th><th>רשות</th><th>רכזת</th><th>צוות</th><th>עזבו (12 ח׳)</th></tr>
                </thead>
                <tbody>
                  {atRisk.map((f) => (
                    <tr key={`${f.authority}|${f.name}`}>
                      <td>{f.name}</td>
                      <td>{f.authority}</td>
                      <td>{f.manager}</td>
                      <td>{f.staff <= 1 ? <span className="pill warn">⚠ {fmtInt(f.staff)}</span> : fmtInt(f.staff)}</td>
                      <td>{f.leavers12m >= 3 ? <span className="pill warn">⚠ {fmtInt(f.leavers12m)}</span> : fmtInt(f.leavers12m)}</td>
                    </tr>
                  ))}
                  {!atRisk.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>אין מסגרות חריגות</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <h2>התפלגות ותק</h2>
          <div className="sub">עובדים פעילים</div>
          <Distribution data={tenure} />
        </div>
        {has('birthDate') && (
          <div className="card">
            <h2>התפלגות גילאים</h2>
            <div className="sub">עובדים פעילים</div>
            <Distribution data={ages} />
          </div>
        )}

        <div className="card">
          <h2>תנועות אחרונות</h2>
          <div className="sub">90 הימים האחרונים</div>
          <Movements hires={moves.hires} leavers={moves.leavers} />
        </div>
      </div>

      <EmployeeTable employees={data} />
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

function Movements({ hires, leavers }: { hires: Employee[]; leavers: Employee[] }) {
  const [tab, setTab] = useState<'h' | 'l'>('h');
  const list = tab === 'h' ? hires : leavers;
  return (
    <>
      <div className="tabs">
        <button className={tab === 'h' ? 'on' : ''} onClick={() => setTab('h')}>נקלטו ({hires.length})</button>
        <button className={tab === 'l' ? 'on' : ''} onClick={() => setTab('l')}>עזבו ({leavers.length})</button>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
        <table className="data">
          <thead><tr><th>שם</th><th>רשות</th><th>תפקיד</th><th>תאריך</th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{e.fullName}</td>
                <td>{e.department}</td>
                <td>{e.role}</td>
                <td>{fmtDate(tab === 'h' ? e.startDate : e.endDate)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>אין תנועות בתקופה</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

type SortKey = 'fullName' | 'department' | 'role' | 'site' | 'employmentType' | 'scopePercent' | 'startDate';
const COLS: { key: SortKey; label: string }[] = [
  { key: 'fullName', label: 'שם' },
  { key: 'department', label: 'רשות' },
  { key: 'site', label: 'מסגרת' },
  { key: 'role', label: 'תפקיד' },
  { key: 'employmentType', label: 'סוג העסקה' },
  { key: 'scopePercent', label: 'היקף' },
  { key: 'startDate', label: 'תחילת עבודה' },
];

function EmployeeTable({ employees }: { employees: Employee[] }) {
  const [q, setQ] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'fullName', dir: 1 });
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const s = q.trim();
    const list = employees.filter(
      (e) =>
        (!onlyActive || isActiveAt(e, now)) &&
        (!s || [e.fullName, e.department, e.role, e.site, e.manager, e.id].some((v) => v.includes(s))),
    );
    return list.sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key];
      let c: number;
      if (va instanceof Date || vb instanceof Date) c = ((va as Date | null)?.getTime() ?? 0) - ((vb as Date | null)?.getTime() ?? 0);
      else if (typeof va === 'number') c = va - (vb as number);
      else c = String(va).localeCompare(String(vb), 'he');
      return c * sort.dir;
    });
  }, [employees, q, onlyActive, sort, now]);

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <h2 style={{ flex: 1 }}>רשימת עובדים ({fmtInt(rows.length)})</h2>
        <label style={{ fontSize: '0.85rem' }}>
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> פעילים בלבד
        </label>
        <input className="search" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              {COLS.map((c) => (
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
                <td>{e.department}</td>
                <td>{e.site}</td>
                <td>{e.role}</td>
                <td>{e.employmentType}</td>
                <td>{e.weeklyHours != null ? `${fmtInt(e.weeklyHours)} ש"ש` : `${Math.round(e.scopePercent)}%`}</td>
                <td>{fmtDate(e.startDate)}</td>
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
