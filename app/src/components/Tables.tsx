import { useMemo, useState } from 'react';
import {
  fmt1,
  fmtDate,
  fmtInt,
  fmtPct,
  fmtTenure,
  monthHours,
  tenureYears,
  type FrameworkRow,
  type HoursGroup,
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
            <tr><th>שם</th><th>רשות</th><th>מסגרת</th><th>תפקיד</th><th>תחילת עבודה</th><th>תאריך עזיבה</th><th>ותק בעזיבה</th>{hasReason && <th>סיבת עזיבה</th>}</tr>
          </thead>
          <tbody>
            {list.map((e) => {
              const t = tenureYears(e, now);
              const isEarly = t != null && t * 365.25 <= ORG.earlyAttritionDays;
              return (
                <tr key={e.id}>
                  <td>{e.fullName}</td>
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
            {!list.length && <tr><td colSpan={8} className="empty">אין עזיבות בתקופה</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- שעות החודש הנוכחי ---------- */

const HE_MONTH = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function MonthHoursTable({ employees }: { employees: Employee[] }) {
  const [group, setGroup] = useState<HoursGroup>('department');
  const data = useMemo(() => monthHours(employees, group), [employees, group]);
  const pct = (a: number | null, p: number) => (a == null || p <= 0 ? null : a / p);
  const rows = useMemo(() => {
    const r = [...data.rows];
    // כשיש נתוני בפועל: הפערים הגדולים קודם
    if (data.anyActual) r.sort((a, b) => (pct(a.actual, a.planned) ?? 9) - (pct(b.actual, b.planned) ?? 9));
    return r;
  }, [data]);
  const totalPct = pct(data.total.actual, data.total.planned);
  const d = (x: Date) => `${x.getDate()}.${x.getMonth() + 1}`;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>שעות {HE_MONTH[data.from.getMonth()]} עד היום</h2>
          <div className="sub" style={{ marginBottom: 0 }}>
            {d(data.from)}–{d(data.to)} · {data.daysSoFar} ימי עבודה מתוך {data.daysInMonth} בחודש · מתוכנן = שעות שבועיות ÷ {ORG.workDays.length} × ימי עבודה
          </div>
        </div>
        <div className="seg" role="group" aria-label="קיבוץ">
          {([['department', 'לפי רשות'], ['site', 'לפי מסגרת'], ['employee', 'לפי עובד/ת']] as [HoursGroup, string][]).map(([k, l]) => (
            <button key={k} className={group === k ? 'on' : ''} onClick={() => setGroup(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="summary">
        <div className="sum">
          <strong>{fmtInt(data.total.planned)}</strong>
          <span>שעות מתוכננות עד היום</span>
        </div>
        {data.anyActual && (
          <>
            <div className="sum">
              <strong>{fmtInt(data.total.actual ?? 0)}</strong>
              <span>שעות בפועל</span>
            </div>
            <div className={`sum ${totalPct != null && totalPct < 0.9 ? 'bad' : 'ok'}`}>
              <strong>{fmtPct(totalPct)}</strong>
              <span>ביצוע מול תכנון</span>
            </div>
          </>
        )}
        <div className="sum">
          <strong>{fmtInt(data.total.employees)}</strong>
          <span>עובדים שעבדו החודש</span>
        </div>
      </div>

      <div className="tbl-wrap" style={{ maxHeight: 440, overflowY: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>{group === 'department' ? 'רשות' : group === 'site' ? 'מסגרת' : 'עובד/ת'}</th>
              {group !== 'employee' && <th>עובדים</th>}
              <th>מתוכנן עד היום</th>
              {data.anyActual && <><th>בפועל</th><th>פער</th><th>ביצוע</th></>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = pct(r.actual, r.planned);
              return (
                <tr key={r.key}>
                  <td>{r.name}{r.sub && <span className="cell-sub"> · {r.sub}</span>}</td>
                  {group !== 'employee' && <td>{fmtInt(r.employees)}</td>}
                  <td>{fmt1(r.planned)}</td>
                  {data.anyActual && (
                    <>
                      <td>{r.actual == null ? '—' : fmt1(r.actual)}</td>
                      <td>{r.actual == null ? '—' : fmt1(r.actual - r.planned)}</td>
                      <td>{p == null ? '—' : p < 0.85 ? <span className="pill bad">{fmtPct(p)}</span> : p > 1.1 ? <span className="pill info">{fmtPct(p)}</span> : <span className="pill ok">{fmtPct(p)}</span>}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="foot">
        {data.anyActual
          ? 'ביצוע מתחת ל-85% מסומן באדום (היעדרויות / חוסר בשעות), מעל 110% בכחול (שעות נוספות).'
          : 'כדי להשוות לשעות בפועל, יש למפות עמודה "שעות בפועל החודש" מדוח הנוכחות של Be360.'}
      </div>
    </div>
  );
}
