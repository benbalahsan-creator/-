import { useRef, useState } from 'react';
import { ExcelFileSource, listSheets } from '../data/sources/excelSource';
import { SampleSource } from '../data/sources/sampleSource';
import type { DataSource } from '../data/sources/DataSource';
import type { RawDataset } from '../data/types';

interface Props {
  onLoaded: (ds: RawDataset) => void;
}

export function DataLoader({ onLoaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; sheets: string[] } | null>(null);

  async function run(src: DataSource) {
    setBusy(true);
    setError(null);
    try {
      const ds = await src.load();
      if (!ds.rows.length) throw new Error('לא נמצאו שורות נתונים בקובץ');
      onLoaded(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const sheets = await listSheets(file);
      if (sheets.length > 1) {
        setPending({ file, sheets });
        return;
      }
    } catch {
      /* ייטופל ב-load */
    }
    run(new ExcelFileSource(file));
  }

  return (
    <div className="loader">
      <div>
        <h1>דשבורד כוח אדם להנהלה</h1>
        <p>טענו קובץ אקסל (‎.xlsx‎) או CSV שיוצא מ-Be360. הנתונים מעובדים בדפדפן בלבד ואינם נשלחים לשום שרת.</p>
      </div>

      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <strong>{busy ? 'טוען…' : 'גררו לכאן קובץ או לחצו לבחירה'}</strong>
        <p>‎.xlsx‎ / ‎.csv‎</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {pending && (
        <div className="card">
          <h2>בחרו גיליון</h2>
          <div className="sub">בקובץ {pending.file.name} יש כמה גיליונות</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pending.sheets.map((s) => (
              <button
                key={s}
                className="btn"
                onClick={() => {
                  const p = pending;
                  setPending(null);
                  run(new ExcelFileSource(p.file, s));
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="notice error">{error}</div>}

      <div>
        <button className="btn" disabled={busy} onClick={() => run(new SampleSource())}>
          הצגה עם נתוני דמו
        </button>
        <p style={{ fontSize: '0.8rem' }}>חיבור ישיר ל-Be360 API יתווסף כשיתקבלו פרטי הגישה.</p>
      </div>
    </div>
  );
}
