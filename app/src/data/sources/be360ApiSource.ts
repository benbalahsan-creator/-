import type { RawDataset, RawRow } from '../types';
import type { DataSource } from './DataSource';

/**
 * מקור נתונים עתידי: Be360 API.
 *
 * עדיין לא מחובר — ממתינים לפרטי ה-API (כתובת, אימות, מבנה התשובה).
 * כשיתקבלו:
 *  1. לעדכן את baseUrl / endpoint / אופן האימות.
 *  2. לוודא שהשדות בתשובה ממופים (אפשר להשתמש ב-guessMapping או במיפוי קבוע).
 *  3. מומלץ לא לקרוא ל-API ישירות מהדפדפן עם מפתח סודי — אלא דרך
 *     שרת ביניים קטן (proxy) שמחזיק את המפתח. ראו README.
 */
export interface Be360Config {
  /** כתובת השרת / ה-proxy שלנו, למשל https://hr-api.example.org */
  baseUrl: string;
  /** נתיב רשימת העובדים — לעדכן לפי התיעוד של Be360 */
  employeesPath?: string;
  /** טוקן (רק אם עובדים דרך proxy שמנפיק טוקן קצר-מועד) */
  token?: string;
}

export class Be360ApiSource implements DataSource {
  readonly name = 'Be360 API';
  private config: Be360Config;
  constructor(config: Be360Config) {
    this.config = config;
  }

  async load(): Promise<RawDataset> {
    const url = new URL(this.config.employeesPath ?? '/employees', this.config.baseUrl);
    const res = await fetch(url, {
      headers: this.config.token ? { Authorization: `Bearer ${this.config.token}` } : {},
    });
    if (!res.ok) throw new Error(`Be360 API: ${res.status} ${res.statusText}`);
    const body = await res.json();
    // TODO: להתאים למבנה התשובה האמיתי (pagination, עטיפה ב-data וכו')
    const rows: RawRow[] = Array.isArray(body) ? body : body.data ?? body.items ?? [];
    const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    return { sourceName: this.name, columns, rows, loadedAt: new Date() };
  }
}
