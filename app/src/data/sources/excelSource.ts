import readXlsxFile from 'read-excel-file/browser';
import Papa from 'papaparse';
import type { RawDataset, RawRow } from '../types';
import type { DataSource } from './DataSource';

/** מוצא את שורת הכותרות: השורה הראשונה עם לפחות 3 תאים מלאים */
function findHeaderRow(data: unknown[][]): number {
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const filled = data[i].filter((c) => c != null && String(c).trim() !== '').length;
    if (filled >= 3) return i;
  }
  return 0;
}

function tableToDataset(data: unknown[][], sourceName: string): RawDataset {
  const h = findHeaderRow(data);
  const header = data[h] ?? [];
  const columns: string[] = [];
  const seen = new Map<string, number>();
  header.forEach((c, i) => {
    let name = c == null || String(c).trim() === '' ? `עמודה ${i + 1}` : String(c).trim();
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n) name = `${name} (${n + 1})`;
    columns.push(name);
  });
  const rows: RawRow[] = data.slice(h + 1).map((r) => {
    const row: RawRow = {};
    columns.forEach((c, i) => (row[c] = r[i] ?? null));
    return row;
  });
  return { sourceName, columns, rows, loadedAt: new Date() };
}

export async function listSheets(file: File): Promise<string[]> {
  if (!/\.xlsx$/i.test(file.name)) return [];
  const sheets = await readXlsxFile(file);
  return sheets.map((s) => s.sheet);
}

export class ExcelFileSource implements DataSource {
  readonly name: string;
  private file: File;
  private sheet?: string;
  constructor(file: File, sheet?: string) {
    this.file = file;
    this.sheet = sheet;
    this.name = file.name;
  }

  async load(): Promise<RawDataset> {
    const { file } = this;
    if (/\.csv$/i.test(file.name)) {
      const text = await file.text();
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      return tableToDataset(parsed.data, file.name);
    }
    if (/\.xls$/i.test(file.name)) {
      throw new Error('קבצי ‎.xls‎ ישנים אינם נתמכים. יש לשמור את הקובץ באקסל בפורמט ‎.xlsx‎ או ‎.csv‎.');
    }
    const sheets = await readXlsxFile(file);
    const sheet = (this.sheet && sheets.find((s) => s.sheet === this.sheet)) || sheets[0];
    if (!sheet) throw new Error('הקובץ ריק');
    return tableToDataset(sheet.data as unknown[][], `${file.name} › ${sheet.sheet}`);
  }
}
