import { ORG } from '../../config/org';
import type { RawDataset, RawRow } from '../types';
import type { DataSource } from './DataSource';

/**
 * נתוני דמו — פיקטיביים לחלוטין (שמות, מסגרות, מספרים).
 * מדמים רשת צהרונים: רשויות → מסגרות (גנים / בתי ספר) → תקנים,
 * עם עונתיות של שנת לימודים: קליטה בסוף אוגוסט, עזיבות בסוף יוני,
 * נשירה מוקדמת, צוות קייטנות קיץ זמני, ורשויות שהצטרפו בשנים שונות.
 */

const FIRST_F = ['נועה', 'מיכל', 'שירה', 'רונית', 'תמר', 'הדס', 'ליאת', 'רחל', 'מאיה', 'יעל', 'אורית', 'עדי', 'שני', 'אביטל', 'ליה', 'הילה', 'סיון', 'אסתר', 'מורן', 'רוני', 'נגה', 'טל', 'אפרת', 'ענבל', 'דנה'];
const FIRST_M = ['יוסי', 'אבי', 'דני', 'עומר', 'איתי', 'אלון', 'עידו', 'גיל', 'סהר', 'נדב', 'רועי', 'אריאל'];
const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'דהן', 'אזולאי', 'גבאי', 'חדד', 'בן דוד', 'אוחיון', 'גולן', 'שרעבי', 'רוזן', 'קליין'];
const GAN = ['רימון', 'חצב', 'כלנית', 'שקד', 'תאנה', 'דקל', 'אלון', 'ברוש', 'נרקיס', 'רקפת', 'סביון', 'איריס', 'אגוז', 'זית', 'ערבה', 'לילך'];
const SCHOOL = ['בי"ס הדר', 'בי"ס נופים', 'בי"ס אופק', 'בי"ס גבעולים', 'בי"ס הרימון', 'בי"ס יחדיו'];

/** רשות: [שם, מספר גנים, מספר בתי ספר, שנת הצטרפות (ספטמבר)] */
const AUTHORITIES: [string, number, number, number][] = [
  ['שערי תקווה', 8, 2, 2017],
  ['אלקנה', 5, 1, 2018],
  ['אורנית', 6, 1, 2018],
  ['רמת השרון', 10, 2, 2019],
  ['חולון', 12, 3, 2019],
  ['מ.א. דרום השרון', 7, 2, 2020],
  ['ראש העין', 9, 2, 2020],
  ['מ.א. שומרון', 6, 1, 2021],
  ['הרצליה', 8, 2, 2022],
  ['מודיעין', 4, 1, 2023],
  ['גבעתיים', 7, 1, 2024],
  ['לוד', 5, 2, 2025],
];

interface Slot {
  authority: string;
  site: string;
  program: string;
  role: string;
  employment: string;
  hours: number;
  manager: string;
  fromYear: number;
  /** הסתברות לעזוב בסוף שנה (30.6) */
  yearEndLeave: number;
  /** הסתברות חודשית לעזוב באמצע שנה */
  monthly: number;
  student: boolean;
}

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
/** ערי מגורים סמוכות לכל רשות (לנתוני הדמו) */
const NEARBY: Record<string, string[]> = {
  'שערי תקווה': ['שערי תקווה', 'אלקנה', 'ראש העין', 'פתח תקווה'],
  'אלקנה': ['אלקנה', 'שערי תקווה', 'אורנית', 'ראש העין'],
  'אורנית': ['אורנית', 'כפר סבא', 'אלקנה', 'ראש העין'],
  'רמת השרון': ['רמת השרון', 'הרצליה', 'תל אביב-יפו', 'כפר סבא'],
  'חולון': ['חולון', 'בת ים', 'ראשון לציון', 'תל אביב-יפו'],
  'מ.א. דרום השרון': ['נווה ירק', 'כפר סבא', 'הוד השרון', 'צור יצחק'],
  'ראש העין': ['ראש העין', 'פתח תקווה', 'אלעד', 'שערי תקווה'],
  'מ.א. שומרון': ['קרני שומרון', 'אריאל', 'עמנואל', 'כפר סבא'],
  'הרצליה': ['הרצליה', 'רמת השרון', 'רעננה', 'כפר שמריהו'],
  'מודיעין': ['מודיעין-מכבים-רעות', 'לוד', 'שוהם'],
  'גבעתיים': ['גבעתיים', 'רמת גן', 'תל אביב-יפו'],
  'לוד': ['לוד', 'רמלה', 'בני ברק', 'מודיעין-מכבים-רעות'],
};

const REASONS_MID = ['מעבר לעבודה אחרת', 'לימודים', 'מעבר דירה', 'שכר', 'עומס / שעות לא מתאימות', 'סיבות אישיות', 'סיום העסקה ביוזמת העמותה'];
const REASONS_EARLY = ['לא התאים/ה לתפקיד', 'מעבר לעבודה אחרת', 'שעות לא מתאימות', 'לימודים'];

function workdays(from: Date, to: Date) {
  let n = 0;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (d <= to) {
    if (ORG.workDays.includes(d.getDay())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export class SampleSource implements DataSource {
  readonly name = 'נתוני דמו (פיקטיביים)';

  async load(): Promise<RawDataset> {
    const r = rng(7);
    const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
    const now = new Date();
    const FIRST_YEAR = 2021; // היסטוריה מספטמבר 2021
    const coordinators = new Map<string, string>();
    const person = (female = r() < 0.88) => ({ name: `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`, female });

    // תקנים
    const slots: Slot[] = [];
    const base = { yearEndLeave: 0.32, monthly: 0.025, student: true };
    for (const [auth, gans, schools, joined] of AUTHORITIES) {
      const coord = `${pick(FIRST_F)} ${pick(LAST)}`;
      coordinators.set(auth, coord);
      const fromYear = Math.max(joined, FIRST_YEAR);
      slots.push({ authority: auth, site: `מטה ${auth}`, program: 'ניהול ותיאום', role: 'רכזת אזור', employment: 'חודשי/ת', hours: 42, manager: 'מנהלת תפעול', fromYear, yearEndLeave: 0.08, monthly: 0.004, student: false });
      GAN.slice(0, gans).forEach((g, i) => {
        // גנים מצטרפים בהדרגה: חלק מהגנים נוספו שנה אחרי הרשות
        const y = fromYear + (i >= gans - 2 && r() < 0.5 ? 1 : 0);
        const site = `גן ${g}`;
        slots.push({ ...base, authority: auth, site, program: 'צהרון גן', role: 'גננת צהרון', employment: 'שעתי/ת', hours: 25, manager: coord, fromYear: y, yearEndLeave: 0.22, monthly: 0.015, student: false });
        slots.push({ ...base, authority: auth, site, program: 'צהרון גן', role: 'סייעת צהרון', employment: 'שעתי/ת', hours: 25, manager: coord, fromYear: y });
      });
      SCHOOL.slice(0, schools).forEach((s) => {
        slots.push({ authority: auth, site: s, program: 'צהרון בית ספר', role: 'רכזת צהרון בית ספרי', employment: 'חודשי/ת', hours: 30, manager: coord, fromYear, yearEndLeave: 0.15, monthly: 0.01, student: false });
        for (let k = 0; k < 3; k++) slots.push({ ...base, authority: auth, site: s, program: 'צהרון בית ספר', role: 'מדריך/ת צהרון', employment: 'שעתי/ת', hours: 15, manager: coord, fromYear, yearEndLeave: 0.4, monthly: 0.035 });
      });
      if (r() < 0.6) {
        const s = pick(SCHOOL.slice(0, schools));
        slots.push({ ...base, authority: auth, site: s, program: 'חוגי העשרה', role: pick(['מדריך/ת ג׳ודו', 'מורה לאנגלית']), employment: 'שעתי/ת', hours: 6, manager: coord, fromYear, yearEndLeave: 0.25, monthly: 0.015 });
      }
    }
    for (const role of ['מנכ"ל/ית', 'מנהלת תפעול', 'מנהלת משאבי אנוש', 'רכזת גיוס עובדים', 'הנהלת חשבונות', 'מזכירות והרשמה', 'מנהלת פדגוגית']) {
      slots.push({ authority: 'מטה העמותה', site: 'משרדי העמותה', program: 'מטה', role, employment: 'חודשי/ת', hours: 42, manager: role === 'מנכ"ל/ית' ? 'ועד מנהל' : 'מנכ"ל/ית', fromYear: FIRST_YEAR, yearEndLeave: 0.05, monthly: 0.004, student: false });
    }

    const rows: RawRow[] = [];
    let id = 1000;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pushEmp = (s: Slot, start: Date, end: Date | null) => {
      const p = person(s.role.startsWith('מדריך/ת ג') ? r() < 0.4 : undefined);
      const age = s.student ? 18 + Math.pow(r(), 1.6) * 12 : 30 + r() * 32;
      const left = end && end <= now ? end : null;
      const tenureY = ((left ?? now).getTime() - start.getTime()) / (365.25 * 86400000);
      // שכר: שעתי לצוות שטח (עולה מעט עם ותק ותפקיד), חודשי לרכזות ומטה
      const roleBonus = /גננת|רכזת/.test(s.role) ? 6 : /ג׳ודו|אנגלית/.test(s.role) ? 12 : 0;
      const hourly = Math.round((38 + roleBonus + Math.min(tenureY, 6) * 1.6 + r() * 5) * 2) / 2;
      const monthly = s.hours === 42 ? Math.round((11000 + r() * 9000) / 100) * 100 : Math.round((7500 + r() * 3000) / 100) * 100;
      const wage = s.employment === 'חודשי/ת' ? monthly : hourly;
      const cost = s.employment === 'חודשי/ת' ? monthly : hourly * s.hours * 4.33;
      // העלאה אחרונה: לעובדים עם ותק של מעל שנה, ב-1.9 או ב-1.1 של אחת השנתיים האחרונות
      let raiseDate: Date | null = null;
      let raise: number | null = null;
      if (tenureY > 1 && r() < 0.8) {
        const end = left ?? now;
        const cands = [0, 1, 2].flatMap((k) => [new Date(end.getFullYear() - k, 8, 1), new Date(end.getFullYear() - k, 0, 1)])
          .filter((d) => d <= end && d.getTime() - start.getTime() > 300 * 86400000);
        if (cands.length) {
          raiseDate = cands.sort((a, b) => b.getTime() - a.getTime())[0];
          raise = s.employment === 'חודשי/ת' ? Math.round((250 + r() * 750) / 50) * 50 : Math.round((2 + r() * 6) * 10) / 10;
        }
      }
      // שעות בפועל מתחילת החודש (לפעילים החודש)
      let hours: number | '' = '';
      if (start <= today && (!left || left >= monthStart)) {
        const from = start > monthStart ? start : monthStart;
        const to = left && left < today ? left : today;
        const planned = (s.hours / ORG.workDays.length) * workdays(from, to);
        const factor = r() < 0.08 ? 0.45 + r() * 0.3 : 0.85 + r() * 0.22; // היעדרויות / שעות נוספות
        hours = Math.round(planned * factor * 2) / 2;
      }
      let reason = '';
      if (left) {
        const days = (left.getTime() - start.getTime()) / 86400000;
        reason = days <= ORG.earlyAttritionDays ? pick(REASONS_EARLY)
          : left.getMonth() === 5 && left.getDate() === 30 ? (r() < 0.6 ? 'סיום שנת לימודים' : pick(REASONS_MID))
          : /קייטנ/.test(s.program) ? 'סיום קייטנה' : pick(REASONS_MID);
      }
      rows.push({
        'מספר עובד': String(id++),
        'שם מלא': p.name,
        'רשות': s.authority,
        'מסגרת': s.site,
        'סוג פעילות': s.program,
        'תפקיד': s.role,
        'רכזת': s.manager,
        'סוג העסקה': s.employment,
        'שעות שבועיות': s.hours,
        'תאריך תחילת עבודה': fmt(start),
        'תאריך סיום עבודה': left ? fmt(left) : '',
        'סיבת עזיבה': reason,
        // טלפון פיקטיבי בתבנית ברורה (054-000XXXX) כדי לא להיראות כמספר אמיתי
        'טלפון': `0540${String(id).padStart(6, '0')}`,
        'עיר מגורים': pick(NEARBY[s.authority] ?? ['פתח תקווה', 'תל אביב-יפו', 'רמת גן', 'שערי תקווה']),
        'מגדר': p.female ? 'נ' : 'ז',
        'תאריך לידה': fmt(new Date(start.getTime() - age * 365.25 * 86400000)),
        'שכר': wage,
        'תאריך העלאה אחרונה': raiseDate ? fmt(raiseDate) : '',
        'העלאה אחרונה': raise ?? '',
        'שעות בפועל החודש': hours,
        'עלות חודשית': Math.round(cost * 1.25),
      });
    };

    // סימולציה לכל תקן: שרשרת עובדים לאורך זמן
    for (const s of slots) {
      let start = addDays(new Date(s.fromYear, 7, 25), Math.floor(r() * 10));
      if (s.fromYear <= FIRST_YEAR) start = addDays(start, -Math.floor(r() * 365 * 3)); // ותיקים מלפני תחילת ההיסטוריה
      while (start <= now) {
        let end: Date | null = null;
        // נשירה מוקדמת
        if (r() < (s.student ? 0.12 : 0.05)) end = addDays(start, 10 + Math.floor(r() * 75));
        // עזיבה חודשית או בסוף שנה
        let d = new Date(start);
        while (!end && d <= now) {
          const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const isJune = d.getMonth() === 5;
          if (isJune && r() < s.yearEndLeave) end = new Date(d.getFullYear(), 5, 30);
          else if (!isJune && d.getMonth() !== 6 && d.getMonth() !== 7 && r() < s.monthly) end = addDays(d, Math.floor(r() * 27));
          d = next;
        }
        pushEmp(s, start, end);
        if (!end || end > now) break;
        // מחליף/ה: אחרי עזיבה בסוף שנה — סוף אוגוסט; אחרת אחרי 1–3 שבועות, ולפעמים התקן נשאר פתוח 1–2 חודשים
        const delay = r() < 0.18 ? 25 + Math.floor(r() * 45) : 5 + Math.floor(r() * 16);
        start = end.getMonth() === 5 && end.getDate() === 30 ? addDays(new Date(end.getFullYear(), 7, 22), Math.floor(r() * (r() < 0.12 ? 60 : 10))) : addDays(end, delay);
      }
    }

    // צוות קייטנות קיץ: יולי–אוגוסט כל שנה
    for (let y = FIRST_YEAR + 1; y <= now.getFullYear(); y++) {
      const st = new Date(y, 6, 1);
      if (st > now) break;
      const n = 25 + (y - FIRST_YEAR) * 8;
      for (let i = 0; i < n; i++) {
        const [auth] = pick(AUTHORITIES.filter((a) => a[3] <= y));
        const slot: Slot = { authority: auth, site: `קייטנת קיץ ${auth}`, program: 'קייטנה', role: 'מדריך/ת קייטנה', employment: 'שעתי/ת', hours: 35, manager: coordinators.get(auth)!, fromYear: y, yearEndLeave: 0, monthly: 0, student: true };
        pushEmp(slot, addDays(st, Math.floor(r() * 3)), new Date(y, 7, 10 + Math.floor(r() * 10)));
      }
    }

    return { sourceName: `${this.name} · ${ORG.name}`, columns: Object.keys(rows[0]), rows, loadedAt: now };
  }
}
