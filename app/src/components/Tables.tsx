import { useMemo, useState } from 'react';
import {
  fmt1,
  fmtDate,
  fmtInt,
  fmtPct,
  fmtTenure,
  monthPay,
  tenureYears,
  WEEKS_PER_MONTH,
  type FrameworkRow,
  type PayRow,
  type StaffingDefaults,
  type TenureRow,
} from '../analytics/metrics';
import { ORG } from '../config/org';
import type { Employee } from '../data/types';

/* ---------- מצבת מסגרות היום מול תקן ---------- */

type StaffFilter = 'all' | 'short' | 'full' | 'over';

export function StaffingTable({
  rows,
  defaults,
  onDefaultsChange,
}: {
  rows: FrameworkRow[];
  defaults: StaffingDefaults;
  onDefaultsChange: (d: StaffingDefaults) => void;
}) {
  const [filter, setFilter] = useState<StaffFilter>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const count = (s: StaffFilter) => (s === 'all' ? rows.length : rows.filter((r) => r.status === s).length);
  const missing = rows.reduce((s, r) => s + Math.max(0, -r.gap), 0);
  const staffToday = rows.reduce((s, r) => s + r.staff, 0);
  const requiredTotal = rows.reduce((s, r) => s + r.required, 0);
  const usesDefaults = rows.some((r) => !r.requiredFromFile);
  const list = rows.filter(
    (r) => (filter === 'all' || r.status === filter) && (!q.trim() || [r.name, r.authority, r.manager].some((v) => v.includes(q.trim()))),
  );

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>מצבת מסגרות היום</h2>
          <div className="sub" style={{ marginBottom: 0 }}>אנשי צוות פעילים היום בכל מסגרת, מול התקן</div>
        </div>
        <input className="search" placeholder="חיפוש מסגרת / רשות / רכזת…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="summary">
        <div className={`sum ${count('short') ? 'bad' : 'ok'}`}>
          <strong>{count('short') ? `${fmtInt(count('short'))} מסגרות בחוסר` : 'כל המסגרות מאוישות'}</strong>
          <span>{count('short') ? `${fmtInt(missing)} תקנים פתוחים` : 'אין חוסרים היום'}</span>
        </div>
        <div className="sum">
          <strong>{fmtInt(count('full'))} מתוך {fmtInt(rows.length)}</strong>
          <span>במצבה מלאה</span>
        </div>
        <div className="sum">
          <strong>{fmtInt(staffToday)} / {fmtInt(requiredTotal)}</strong>
          <span>אנשי צוות היום / תקן ({fmtPct(requiredTotal ? staffToday / requiredTotal : null)})</span>
        </div>
        {count('over') > 0 && (
          <div className="sum">
            <strong>{fmtInt(count('over'))}</strong>
            <span>מסגרות מעל התקן</span>
          </div>
        )}
      </div>

      <div className="tabs">
        {([['all', 'הכל'], ['short', 'בחוסר'], ['full', 'מצבה מלאה'], ['over', 'מעל התקן']] as [StaffFilter, string][]).map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l} ({fmtInt(count(k))})</button>
        ))}
      </div>

      <div className="tbl-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr><th>מסגרת</th><th>רשות</th><th>סוג פעילות</th><th>רכזת</th><th>תקן</th><th>עובדים היום</th><th>פער</th><th>מצב</th><th>עזבו (12 ח׳)</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={`${r.authority}|${r.name}|${r.program}`}>
                <td>{r.name}</td>
                <td>{r.authority}</td>
                <td>{r.program}</td>
                <td>{r.manager}</td>
                <td>{fmtInt(r.required)}{r.requiredFromFile ? '' : '*'}</td>
                <td>{fmtInt(r.staff)}</td>
                <td>{r.gap > 0 ? `+${r.gap}` : r.gap}</td>
                <td><StatusPill status={r.status} gap={r.gap} /></td>
                <td>{r.leavers12m >= 3 ? <span className="pill warn">{fmtInt(r.leavers12m)}</span> : fmtInt(r.leavers12m)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} className="empty">אין מסגרות בסינון הזה</td></tr>}
          </tbody>
        </table>
      </div>

      {usesDefaults && (
        <div className="foot">
          * תקן ברירת מחדל לפי סוג פעילות, כי בקובץ אין עמודת "תקן".{' '}
          {!editing ? (
            <button className="btn link" onClick={() => setEditing(true)}>עריכת התקנים</button>
          ) : (
            <span className="std-edit">
              {defaults.map((d, i) => (
                <label key={d.match}>
                  {d.match.split('|')[0]}
                  <input
                    id={`std-${i}`}
                    type="number"
                    min={0}
                    max={20}
                    value={d.required}
                    onChange={(e) => onDefaultsChange(defaults.map((x, j) => (j === i ? { ...x, required: Math.max(0, Number(e.target.value) || 0) } : x)))}
                  />
                </label>
              ))}
              <button className="btn link" onClick={() => setEditing(false)}>סגירה</button>
              <button className="btn link" onClick={() => onDefaultsChange(ORG.defaultStaffing)}>איפוס</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, gap }: { status: FrameworkRow['status']; gap: number }) {
  if (status === 'short') return <span className="pill bad">⚠ חסר {fmtInt(-gap)}</span>;
  if (status === 'over') return <span className="pill info">מעל התקן</span>;
  return <span className="pill ok">✓ מלא</span>;
}

/* ---------- ותק ---------- */

export function TenureTable({ rows, hasWage }: { rows: TenureRow[]; hasWage: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.active));
  const total = rows.reduce((s, r) => s + r.active, 0);
  const leavers = rows.reduce((s, r) => s + r.leavers12m, 0);
  return (
    <div className="card">
      <h2>טבלת ותק</h2>
      <div className="sub">עובדים פעילים לפי ותק בעמותה; עוזבים לפי הוותק ביום העזיבה</div>
      <div className="tbl-wrap">
        <table className="data">
          <thead>
            <tr><th>ותק</th><th>עובדים פעילים</th><th style={{ width: '30%' }}>שיעור</th>{hasWage && <th>שכר שעתי ממוצע</th>}<th>עזבו (12 ח׳)</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{fmtInt(r.active)}</td>
                <td>
                  <div className="inline-bar">
                    <i style={{ width: `${(r.active / max) * 100}%` }} />
                    <span>{fmtPct(r.share)}</span>
                  </div>
                </td>
                {hasWage && <td>{r.avgHourly == null ? '—' : `₪${fmt1(r.avgHourly)}`}</td>}
                <td>{fmtInt(r.leavers12m)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>סה״כ</td>
              <td>{fmtInt(total)}</td>
              <td />
              {hasWage && <td />}
              <td>{fmtInt(leavers)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- עזיבות אחרונות ---------- */

export function LeaversTable({ employees }: { employees: Employee[] }) {
  const [days, setDays] = useState(90);
  const now = useMemo(() => new Date(), []);
  const list = useMemo(() => {
    const from = new Date(now.getTime() - days * 86400000);
    return employees
      .filter((e) => e.endDate && e.endDate > from && e.endDate <= now)
      .sort((a, b) => b.endDate!.getTime() - a.endDate!.getTime());
  }, [employees, days, now]);
  const hasReason = list.some((e) => e.leaveReason);
  const early = list.filter((e) => (tenureYears(e, now) ?? 99) * 365.25 <= ORG.earlyAttritionDays).length;
  const topReasons = useMemo(() => {
    const c = new Map<string, number>();
    list.forEach((e) => e.leaveReason && c.set(e.leaveReason, (c.get(e.leaveReason) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [list]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>עזיבות אחרונות ({fmtInt(list.length)})</h2>
          <div className="sub" style={{ marginBottom: 0 }}>
            {early > 0 && <>{fmtInt(early)} מהם עזבו תוך {ORG.earlyAttritionDays} יום מהקליטה. </>}
            {topReasons.length > 0 && <>סיבות מובילות: {topReasons.map(([r, n]) => `${r} (${n})`).join(' · ')}</>}
          </div>
        </div>
        <div className="seg" role="group" aria-label="תקופה">
          {[30, 90, 180, 365].map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d === 365 ? 'שנה' : `${d} יום`}</button>
          ))}
        </div>
      </div>
      <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr><th>שם</th><th>טלפון</th><th>עיר מגורים</th><th>רשות</th><th>מסגרת</th><th>תפקיד</th><th>תחילת עבודה</th><th>תאריך עזיבה</th><th>ותק בעזיבה</th>{hasReason && <th>סיבת עזיבה</th>}</tr>
          </thead>
          <tbody>
            {list.map((e) => {
              const t = tenureYears(e, now);
              const isEarly = t != null && t * 365.25 <= ORG.earlyAttritionDays;
              return (
                <tr key={e.id}>
                  <td>{e.fullName}</td>
                  <td><Phone v={e.phone} /></td>
                  <td>{e.residenceCity || '—'}</td>
                  <td>{e.department}</td>
                  <td>{e.site}</td>
                  <td>{e.role}</td>
                  <td>{fmtDate(e.startDate)}</td>
                  <td>{fmtDate(e.endDate)}</td>
                  <td>{isEarly ? <span className="pill warn">{fmtTenure(t)}</span> : fmtTenure(t)}</td>
                  {hasReason && <td>{e.leaveReason || '—'}</td>}
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={10} className="empty">אין עזיבות בתקופה</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- שעות ומשכורת מתחילת החודש, לפי עובד/ת ---------- */

const HE_MONTH = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const money = (n: number | null) => (n == null ? '—' : `₪${Math.round(n).toLocaleString('he-IL')}`);
const rate = (n: number | null) => (n == null ? '—' : `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

type PaySort = 'name' | 'hours' | 'rate' | 'pay';

export function MonthHoursTable({ employees, hasHours, hasWage }: { employees: Employee[]; hasHours: boolean; hasWage: boolean }) {
  const data = useMemo(() => monthPay(employees), [employees]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: PaySort; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const rows = useMemo(() => {
    const s = q.trim();
    const v = (r: PayRow): number | string =>
      sort.key === 'name' ? r.employee.fullName : (sort.key === 'hours' ? r.hours : sort.key === 'rate' ? r.rate : r.pay) ?? -1;
    return data.rows
      .filter((r) => !s || [r.employee.fullName, r.employee.site, r.employee.department].some((x) => x.includes(s)))
      .sort((a, b) => {
        const va = v(a), vb = v(b);
        return (typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb), 'he')) * sort.dir;
      });
  }, [data, q, sort]);
  const th = (k: PaySort, label: string) => (
    <th onClick={() => setSort({ key: k, dir: sort.key === k ? (-sort.dir as 1 | -1) : k === 'name' ? 1 : -1 })}>
      {label} {sort.key === k ? (sort.dir === 1 ? '▲' : '▼') : ''}
    </th>
  );
  const d = (x: Date) => `${x.getDate()}.${x.getMonth() + 1}`;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>שעות ומשכורת {HE_MONTH[data.from.getMonth()]} עד היום</h2>
          <div className="sub" style={{ marginBottom: 0 }}>{d(data.from)}–{d(data.to)} · לפי עובד/ת</div>
        </div>
        <input className="search" placeholder="חיפוש עובד/ת / מסגרת…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!hasHours ? (
        <div className="notice" style={{ marginTop: 12 }}>
          כדי להציג שעות ומשכורת, יש למפות בהתאמת העמודות את "שעות בפועל החודש" (מדוח הנוכחות של Be360){hasWage ? '' : ' ואת "שכר"'}.
        </div>
      ) : (
        <>
          <div className="summary">
            <div className="sum">
              <strong>{data.totalHours == null ? '—' : fmt1(data.totalHours)}</strong>
              <span>שעות בפועל מתחילת החודש</span>
            </div>
            {hasWage && (
              <div className="sum">
                <strong>{money(data.totalPay)}</strong>
                <span>משכורת מצטברת עד היום</span>
              </div>
            )}
            <div className="sum">
              <strong>{fmtInt(data.worked)}</strong>
              <span>עובדים שעבדו החודש</span>
            </div>
          </div>

          <div className="tbl-wrap" style={{ maxHeight: 460, overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  {th('name', 'שם')}
                  {th('hours', 'שעות עד היום (בפועל)')}
                  {hasWage && th('rate', 'שכר שעתי')}
                  {hasWage && th('pay', 'משכורת עד היום')}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employee.id}>
                    <td>{r.employee.fullName}</td>
                    <td>{r.hours == null ? '—' : fmt1(r.hours)}</td>
                    {hasWage && <td>{rate(r.rate)}{r.rateDerived && <span className="cell-sub" title="מחושב משכר חודשי"> *</span>}</td>}
                    {hasWage && <td>{money(r.pay)}</td>}
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} className="empty">אין עובדים בסינון הזה</td></tr>}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="total">
                    <td>סה״כ ({fmtInt(rows.length)})</td>
                    <td>{fmt1(rows.reduce((t, r) => t + (r.hours ?? 0), 0))}</td>
                    {hasWage && <td />}
                    {hasWage && <td>{money(rows.reduce((t, r) => t + (r.pay ?? 0), 0))}</td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {hasWage && (
            <div className="foot">
              משכורת עד היום = שעות בפועל × שכר שעתי (ברוטו, לפני תוספות וניכויים).
              {rows.some((r) => r.rateDerived) && <> * לעובדים בשכר חודשי: שכר שעתי מחושב = שכר חודשי ÷ (שעות שבועיות × {WEEKS_PER_MONTH.toFixed(2)}).</>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** מספר טלפון: מוצג כטקסט לבחירה והעתקה (קישורי tel: לא תמיד עובדים בכל סביבה) */
export function Phone({ v }: { v: string }) {
  if (!v) return <span className="cell-sub">—</span>;
  return <span className="phone" dir="ltr">{v}</span>;
}
