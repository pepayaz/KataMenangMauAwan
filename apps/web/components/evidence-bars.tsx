import { barScale } from '../lib/report-presentation';

export default function EvidenceBars({ rows, label }: { rows: { label: string; value: number; display: string }[]; label: string }) {
  const scale = barScale(rows.map(row => row.value));
  return <figure className="evidence-bars" aria-label={label}>
    <figcaption className="sr-only">{label}. Panjang batang menggunakan skala yang sama, dimulai dari nol.</figcaption>
    {rows.map((row, index) => <div className="bar-row" key={`${row.label}-${index}`}>
      <div className="bar-caption"><span>{row.label}</span><strong>{row.display}</strong></div>
      <div className="bar-track" aria-hidden="true"><span className="bar-zero" style={{ left: `${scale.zero}%` }} />
        <span className={`bar-fill ${row.value < 0 ? 'negative' : ''}`} style={{ left: `${scale.bar(row.value).left}%`, width: `${scale.bar(row.value).width}%` }} />
      </div>
    </div>)}
  </figure>;
}
