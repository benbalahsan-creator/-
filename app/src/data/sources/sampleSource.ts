import type { RawDataset, RawRow } from '../types';
import type { DataSource } from './DataSource';

/** נתוני דמו (פיקטיביים לחלוטין) — להצגת הדשבורד לפני שמגיע קובץ אמיתי */
const FIRST = ['נועה', 'יוסי', 'מיכל', 'אבי', 'שירה', 'דני', 'רונית', 'עומר', 'תמר', 'איתי', 'הדס', 'משה', 'ליאת', 'אלון', 'רחל', 'עידו', 'מאיה', 'גיל', 'סהר', 'יעל'];
const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'דהן', 'אזולאי', 'גבאי', 'חדד'];
const DEPTS: [string, string[], number][] = [
  ['שירותים חברתיים', ['עו"ס', 'רכז/ת תוכנית', 'מדריך/ה'], 0.35],
  ['חינוך והדרכה', ['מדריך/ה', 'רכז/ת חינוך', 'מורה'], 0.25],
  ['גיוס משאבים', ['מגייס/ת', 'מנהל/ת קשרי תורמים'], 0.08],
  ['מתנדבים', ['רכז/ת מתנדבים'], 0.1],
  ['כספים ומנהלה', ['חשב/ת', 'מנהלת חשבונות', 'מזכיר/ה'], 0.1],
  ['הנהלה', ['מנכ"ל/ית', 'סמנכ"ל/ית', 'עוזר/ת אישי/ת'], 0.05],
  ['תפעול ולוגיסטיקה', ['אב בית', 'נהג/ת', 'אחראי/ת לוגיסטיקה'], 0.07],
];
const SITES = ['ירושלים', 'תל אביב', 'באר שבע', 'חיפה', 'מרכז ארצי'];
const TYPES: [string, number][] = [['שכיר/ה', 0.72], ['שעתי/ת', 0.13], ['פרילנס', 0.05], ['שירות לאומי', 0.1]];

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
function weighted<T>(r: () => number, items: [T, ...unknown[]][], wIdx: number): T {
  const x = r();
  let acc = 0;
  for (const it of items) {
    acc += it[wIdx] as number;
    if (x < acc) return it[0];
  }
  return items[items.length - 1][0];
}
const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

export class SampleSource implements DataSource {
  readonly name = 'נתוני דמו';
  async load(): Promise<RawDataset> {
    const r = rng(42);
    const now = new Date();
    const rows: RawRow[] = [];
    for (let i = 0; i < 240; i++) {
      const dept = weighted(r, DEPTS, 2);
      const roles = DEPTS.find((d) => d[0] === dept)![1];
      const type = weighted(r, TYPES, 1);
      const yearsAgo = Math.pow(r(), 1.8) * 14;
      const start = new Date(now.getTime() - yearsAgo * 365 * 86400000);
      const tenure = (now.getTime() - start.getTime()) / (365 * 86400000);
      const leftChance = type === 'שירות לאומי' ? 0.6 : 0.28;
      let end: Date | null = null;
      if (r() < leftChance && tenure > 0.3) {
        end = new Date(start.getTime() + r() * (now.getTime() - start.getTime()));
        if (now.getTime() - end.getTime() > 3 * 365 * 86400000) end = null; // עזיבות ישנות פחות רלוונטיות
      }
      const age = type === 'שירות לאומי' ? 18 + r() * 2 : 23 + Math.pow(r(), 1.3) * 42;
      const scope = type === 'שירות לאומי' ? 100 : [100, 100, 100, 75, 50, 80, 60][Math.floor(r() * 7)];
      rows.push({
        'מספר עובד': String(1000 + i),
        'שם מלא': `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
        'מחלקה': dept,
        'תפקיד': roles[Math.floor(r() * roles.length)],
        'סניף': SITES[Math.floor(r() * SITES.length)],
        'סוג העסקה': type,
        'היקף משרה': scope,
        'תאריך תחילת עבודה': fmt(start),
        'תאריך סיום עבודה': end ? fmt(end) : '',
        'מגדר': r() < 0.68 ? 'נ' : 'ז',
        'תאריך לידה': fmt(new Date(now.getTime() - age * 365 * 86400000)),
        'עלות חודשית': type === 'שירות לאומי' ? 1800 : Math.round((9000 + r() * 16000) * (scope / 100)),
      });
    }
    return { sourceName: this.name, columns: Object.keys(rows[0]), rows, loadedAt: now };
  }
}
