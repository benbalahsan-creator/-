import type { RawDataset } from '../types';

/**
 * ממשק אחיד לכל מקור נתונים.
 * היום: קובץ אקסל/CSV. בעתיד: Be360 API — יש לממש את אותו ממשק
 * (ראו be360ApiSource.ts) והדשבורד יעבוד בלי שינוי.
 */
export interface DataSource {
  readonly name: string;
  load(): Promise<RawDataset>;
}
