import type { ColumnMapping, Employee } from './types';

export interface FieldDef {
  key: keyof Employee;
  label: string;
  required: boolean;
  /** שמות עמודות אפשריים (עברית/אנגלית) לזיהוי אוטומטי */
  aliases: string[];
}

export const FIELDS: FieldDef[] = [
  { key: 'id', label: 'מספר עובד / ת.ז.', required: false, aliases: ['מספר עובד', 'מס עובד', 'מס\' עובד', 'ת.ז', 'תז', 'תעודת זהות', 'id', 'employee id', 'employeeid'] },
  { key: 'fullName', label: 'שם מלא', required: true, aliases: ['שם מלא', 'שם העובד', 'שם עובד', 'שם', 'name', 'full name', 'fullname'] },
  { key: 'department', label: 'מחלקה / אגף', required: true, aliases: ['מחלקה', 'אגף', 'תחום', 'יחידה', 'department', 'dept'] },
  { key: 'role', label: 'תפקיד', required: false, aliases: ['תפקיד', 'הגדרת תפקיד', 'משרה', 'role', 'title', 'job title', 'position'] },
  { key: 'site', label: 'סניף / מיקום', required: false, aliases: ['סניף', 'מיקום', 'אתר', 'מסגרת', 'עיר', 'site', 'location', 'branch'] },
  { key: 'employmentType', label: 'סוג העסקה', required: false, aliases: ['סוג העסקה', 'סוג עובד', 'מעמד', 'סטטוס העסקה', 'employment type', 'type'] },
  { key: 'scopePercent', label: 'היקף משרה (%)', required: false, aliases: ['היקף משרה', 'אחוז משרה', '% משרה', 'היקף', 'scope', 'fte', 'percent'] },
  { key: 'startDate', label: 'תאריך תחילת עבודה', required: true, aliases: ['תאריך תחילת עבודה', 'תחילת עבודה', 'תאריך התחלה', 'תאריך קליטה', 'תאריך כניסה', 'start date', 'hire date', 'startdate'] },
  { key: 'endDate', label: 'תאריך סיום עבודה', required: false, aliases: ['תאריך סיום עבודה', 'סיום עבודה', 'תאריך סיום', 'תאריך עזיבה', 'end date', 'termination date', 'enddate'] },
  { key: 'gender', label: 'מגדר', required: false, aliases: ['מגדר', 'מין', 'gender', 'sex'] },
  { key: 'birthDate', label: 'תאריך לידה', required: false, aliases: ['תאריך לידה', 'ת. לידה', 'birth date', 'birthdate', 'dob'] },
  { key: 'manager', label: 'מנהל/ת ישיר/ה', required: false, aliases: ['מנהל ישיר', 'מנהל', 'מנהלת', 'אחראי', 'manager'] },
  { key: 'monthlyCost', label: 'עלות חודשית', required: false, aliases: ['עלות חודשית', 'עלות מעביד', 'עלות', 'שכר', 'שכר ברוטו', 'monthly cost', 'cost', 'salary'] },
];

const norm = (s: string) =>
  s.toLowerCase().replace(/["'׳״`]/g, '').replace(/[\s_\-.:]+/g, ' ').trim();

/** מנחש מיפוי עמודות לפי שמות הכותרות */
export function guessMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normCols = columns.map((c) => ({ raw: c, n: norm(c) }));

  // סבב 1: התאמה מדויקת. סבב 2: הכלה.
  for (const exact of [true, false]) {
    for (const f of FIELDS) {
      if (mapping[f.key]) continue;
      for (const alias of f.aliases) {
        const a = norm(alias);
        const hit = normCols.find(
          (c) => !used.has(c.raw) && (exact ? c.n === a : c.n.includes(a)),
        );
        if (hit) {
          mapping[f.key] = hit.raw;
          used.add(hit.raw);
          break;
        }
      }
    }
  }
  return mapping;
}

export function missingRequired(mapping: ColumnMapping): FieldDef[] {
  return FIELDS.filter((f) => f.required && !mapping[f.key]);
}
