import { FIELDS, missingRequired } from '../data/fields';
import type { ColumnMapping, RawDataset } from '../data/types';

interface Props {
  dataset: RawDataset;
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function ColumnMapper({ dataset, mapping, onChange, onConfirm, onBack }: Props) {
  const missing = missingRequired(mapping);
  const sample = (col?: string) => {
    if (!col) return '';
    const vals = dataset.rows
      .map((r) => r[col])
      .filter((v) => v != null && v !== '')
      .slice(0, 3)
      .map((v) => (v instanceof Date ? v.toLocaleDateString('he-IL') : String(v)));
    return vals.join(' · ');
  };

  return (
    <div className="mapper card">
      <h2>התאמת עמודות</h2>
      <div className="sub">
        {dataset.sourceName} — {dataset.rows.length.toLocaleString('he-IL')} שורות. זיהינו אוטומטית את מה שאפשר; בדקו ותקנו
        במידת הצורך. המיפוי נשמר לפעם הבאה.
      </div>
      <table>
        <tbody>
          {FIELDS.map((f) => (
            <tr key={f.key}>
              <td style={{ width: '30%' }}>
                {f.label} {f.required && <span className="req">*</span>}
              </td>
              <td style={{ width: '30%' }}>
                <select
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => onChange({ ...mapping, [f.key]: e.target.value || undefined })}
                >
                  <option value="">— לא קיים —</option>
                  {dataset.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="preview">{sample(mapping[f.key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {missing.length > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          חסרים שדות חובה: {missing.map((f) => f.label).join(', ')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn primary" disabled={missing.length > 0} onClick={onConfirm}>
          הצג דשבורד
        </button>
        <button className="btn" onClick={onBack}>
          קובץ אחר
        </button>
      </div>
    </div>
  );
}
