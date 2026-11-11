import { useMemo, useState } from 'react';
import { ColumnMapper } from './components/ColumnMapper';
import { Dashboard } from './components/Dashboard';
import { DataLoader } from './components/DataLoader';
import { Logo } from './components/Logo';
import { guessMapping } from './data/fields';
import { ORG } from './config/org';
import { normalize } from './data/normalize';
import type { ColumnMapping, RawDataset } from './data/types';

const MAPPING_KEY = 'hr-dashboard:mapping';

/** טוען מיפוי שמור — רק אם כל העמודות שבו קיימות בקובץ הנוכחי */
function loadSavedMapping(columns: string[]): ColumnMapping | null {
  try {
    const saved = JSON.parse(localStorage.getItem(MAPPING_KEY) ?? 'null') as ColumnMapping | null;
    if (saved && Object.values(saved).every((c) => !c || columns.includes(c))) return saved;
  } catch {
    /* אין גישה ל-localStorage */
  }
  return null;
}

export default function App() {
  const [dataset, setDataset] = useState<RawDataset | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [step, setStep] = useState<'load' | 'map' | 'dash'>('load');

  const result = useMemo(
    () => (dataset && step === 'dash' ? normalize(dataset.rows, mapping) : null),
    [dataset, mapping, step],
  );

  function onLoaded(ds: RawDataset) {
    setDataset(ds);
    // מיפוי שמור גובר, אבל שדות חדשים שלא היו בו (למשל טלפון, עיר מגורים) מתווספים מהזיהוי האוטומטי
    const guessed = guessMapping(ds.columns);
    const saved = loadSavedMapping(ds.columns);
    setMapping(saved ? { ...guessed, ...saved } : guessed);
    setStep('map');
  }

  function confirmMapping() {
    try {
      localStorage.setItem(MAPPING_KEY, JSON.stringify(mapping));
    } catch {
      /* לא קריטי */
    }
    setStep('dash');
  }

  return (
    <div className="app" dir="rtl">
      <header className="appbar">
        <Logo />
        <div className="titles">
          <h1>דשבורד כוח אדם</h1>
          <div className="meta">
            {step === 'dash' && dataset
              ? <>מקור: {dataset.sourceName} · עודכן {dataset.loadedAt.toLocaleString('he-IL')}</>
              : ORG.fullName}
          </div>
        </div>
        {step === 'dash' && (
          <div className="actions">
            <button className="btn" onClick={() => setStep('map')}>התאמת עמודות</button>
            <button className="btn" onClick={() => setStep('load')}>טעינת קובץ חדש</button>
          </div>
        )}
      </header>

      {step === 'load' && <DataLoader onLoaded={onLoaded} />}

      {step === 'map' && dataset && (
        <ColumnMapper dataset={dataset} mapping={mapping} onChange={setMapping} onConfirm={confirmMapping} onBack={() => setStep('load')} />
      )}

      {step === 'dash' && dataset && result && (
        <>
          {result.warnings.map((w) => (
            <div key={w} className="notice">{w}</div>
          ))}
          <Dashboard employees={result.employees} mapping={mapping} />
        </>
      )}
    </div>
  );
}
