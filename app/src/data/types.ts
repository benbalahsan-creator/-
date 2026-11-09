/**
 * המודל הקנוני של עובד/ת במערכת.
 * כל מקור נתונים (אקסל, API של Be360 בעתיד) מתורגם למבנה הזה,
 * כך שהדשבורד לא תלוי במקור.
 */
export interface Employee {
  id: string;
  fullName: string;
  /** רשות / יישוב (בעמותה: היחידה הארגונית העיקרית — כל רשות היא התקשרות) */
  department: string;
  role: string;
  /** מסגרת: שם הגן / בית הספר / הצהרון */
  site: string;
  /** סוג פעילות: צהרון גן, צהרון בי"ס, חוג, קייטנה, מטה */
  program: string;
  /** שעתי/ת, חודשי/ת, פרילנס וכו' */
  employmentType: string;
  /** היקף משרה באחוזים (0-100). מחושב משעות שבועיות אם יש; ברירת מחדל 100 אם חסר */
  scopePercent: number;
  /** שעות שבועיות (אם קיים בקובץ) */
  weeklyHours: number | null;
  startDate: Date | null;
  endDate: Date | null;
  gender: string;
  birthDate: Date | null;
  manager: string;
  /** עלות חודשית (אופציונלי) */
  monthlyCost: number | null;
}

/** שורה גולמית ממקור נתונים: כותרת עמודה → ערך */
export type RawRow = Record<string, unknown>;

export interface RawDataset {
  /** שם המקור לתצוגה (שם קובץ / "Be360 API") */
  sourceName: string;
  columns: string[];
  rows: RawRow[];
  loadedAt: Date;
}

/** מיפוי: שדה קנוני → שם העמודה במקור */
export type ColumnMapping = Partial<Record<keyof Employee, string>>;
