import type { ColumnMapping, Employee, RawRow } from './types';

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // מספר סידורי של אקסל
    if (v > 1000 && v < 100000) return new Date(EXCEL_EPOCH + v * 86400000);
    return null;
  }
  const s = String(v).trim();
  // dd/mm/yyyy, dd.mm.yy, dd-mm-yyyy (פורמט ישראלי)
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > 50 ? 1900 : 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

export function parseNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[,₪%\s]/g, ''));
  return isFinite(n) ? n : null;
}

const str = (v: unknown, fallback = 'לא צוין') => {
  const s = v == null ? '' : String(v).trim();
  return s || fallback;
};

function normalizeGender(v: unknown): string {
  const s = str(v, '').toLowerCase();
  if (!s) return 'לא צוין';
  if (['ז', 'זכר', 'גבר', 'm', 'male'].includes(s)) return 'גבר';
  if (['נ', 'נקבה', 'אישה', 'אשה', 'f', 'female'].includes(s)) return 'אישה';
  return str(v);
}

export interface NormalizeResult {
  employees: Employee[];
  warnings: string[];
}

export function normalize(rows: RawRow[], mapping: ColumnMapping): NormalizeResult {
  const warnings: string[] = [];
  let badStart = 0;
  const get = (row: RawRow, key: keyof Employee) => {
    const col = mapping[key];
    return col ? row[col] : undefined;
  };

  const employees: Employee[] = [];
  rows.forEach((row, i) => {
    const fullName = str(get(row, 'fullName'), '');
    if (!fullName) return; // שורה ריקה / שורת סיכום
    const startDate = parseDate(get(row, 'startDate'));
    if (mapping.startDate && !startDate) badStart++;
    let scope = parseNumber(get(row, 'scopePercent'));
    if (scope != null && scope > 0 && scope <= 1.5) scope = scope * 100; // 0.5 → 50%
    employees.push({
      id: str(get(row, 'id'), `row-${i + 2}`),
      fullName,
      department: str(get(row, 'department')),
      role: str(get(row, 'role')),
      site: str(get(row, 'site')),
      employmentType: str(get(row, 'employmentType')),
      scopePercent: scope ?? 100,
      startDate,
      endDate: parseDate(get(row, 'endDate')),
      gender: normalizeGender(get(row, 'gender')),
      birthDate: parseDate(get(row, 'birthDate')),
      manager: str(get(row, 'manager')),
      monthlyCost: parseNumber(get(row, 'monthlyCost')),
    });
  });

  if (badStart) warnings.push(`ל-${badStart} שורות אין תאריך תחילת עבודה תקין — הן נספרות כפעילות אך לא נכללות במגמות.`);
  return { employees, warnings };
}
