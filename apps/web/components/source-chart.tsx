'use client';
import { useState } from 'react';
import { barScale, type SourceChart as ChartData } from '../lib/report-presentation';

/** SVG plot plus visible values: keyboard, touch and hover select the same actual observation. */
export default function SourceChart({ chart }: { chart: ChartData }) {
  const [selected, setSelected] = useState<number | null>(null);
  const scale = barScale(chart.rows.map(row => row.value));
  const height = chart.rows.length * 64 + 16;
  return <figure className="source-chart" aria-label={chart.title}>
    <figcaption><strong>{chart.title}</strong><span>{chart.note}</span></figcaption>
    <div className="source-chart-scroll"><div className="source-chart-plot" style={{ height }}>
      <svg viewBox={`0 0 500 ${height}`} aria-hidden="true" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map(tick => <line key={tick} x1={tick * 5} x2={tick * 5} y1="0" y2={height} className="chart-grid" />)}
        <line x1={scale.zero * 5} x2={scale.zero * 5} y1="0" y2={height} className="chart-axis" />
        {chart.rows.map((row, index) => <rect key={index} x={scale.bar(row.value).left * 5} y={index * 64 + 36} width={scale.bar(row.value).width * 5} height="15" rx="3"
          className={`chart-column chart-color-${index % 4} ${row.value < 0 ? 'is-negative' : ''} ${selected === index ? 'is-selected' : ''}`} />)}
      </svg>
      <div className="source-chart-rows">{chart.rows.map((row, index) => <button type="button" className="chart-observation" key={`${row.label}-${index}`}
        aria-pressed={selected === index} onClick={() => setSelected(index)}
        onFocus={() => setSelected(index)} onMouseEnter={() => setSelected(index)} onMouseLeave={event => { if (!event.currentTarget.matches(':focus')) setSelected(null); }}>
        <span>{row.label}</span><strong>{row.display}</strong>
      </button>)}</div>
    </div></div>
    <div className="chart-detail" role="status">{selected !== null ? chart.rows[selected]?.detail : 'Sentuh batang untuk melihat nilai lengkap'}</div>
  </figure>;
}
