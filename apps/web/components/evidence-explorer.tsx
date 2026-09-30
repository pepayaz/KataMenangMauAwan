'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Search, X } from 'lucide-react';
import type { ClaimVerdict, Evidence } from '@cek-dulu/shared/schemas';
import { formatEvidence, readableSourceText } from '../lib/check-view';
import { evidenceSeries, verdictSummaries } from '../lib/report-presentation';
import EvidenceBars from './evidence-bars';
import VerdictBadge from './verdict-badge';

const sourceParamLabels: Record<string, string> = { formula: 'Rumus', period: 'Periode', symbol: 'Saham', start: 'Mulai', end: 'Sampai', year: 'Tahun', window: 'Rentang' };
export default function EvidenceExplorer({ evidence, verdict, demo, onClose }: {
  evidence: Evidence[]; verdict: ClaimVerdict; demo: boolean; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<'summary' | 'all'>('summary');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); trigger?.focus({ preventScroll: true }); };
  }, []);
  const important = new Set([verdict.computed?.evidenceId, ...verdict.missingContext.flatMap(context => context.evidenceIds)]);
  const highlights = evidence.filter(record => important.has(record.evidenceId) && typeof record.value === 'number').slice(0, 6);
  const series = evidenceSeries(evidence);
  const filtered = evidence.filter(record => readableSourceText(record.label).toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID')));
  return <dialog ref={ref} className="evidence-drawer" aria-labelledby="evidence-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="drawer-head"><h2 id="evidence-title">Sumber pemeriksaan</h2><button className="icon-button" aria-label="Tutup sumber" onClick={onClose}><X size={22} /></button></div>
    <div className="source-conclusion"><VerdictBadge verdict={verdict.verdict} /><p>{verdictSummaries[verdict.verdict]}</p></div>
    <div className="source-view-switch" role="group" aria-label="Tampilan sumber">
      <button aria-pressed={view === 'summary'} onClick={() => setView('summary')}>Ringkasan bukti</button>
      <button aria-pressed={view === 'all'} onClick={() => setView('all')}>Semua sumber <span>{evidence.length}</span></button>
    </div>
    {view === 'summary' ? <div className="source-overview">
      {demo && <p className="source-demo-note">Fixture contoh, bukan data pasar terkini.</p>}
      {highlights.length > 0 && <section><h3>Angka yang mendasari hasil</h3><div className="source-highlights">
        {highlights.map(record => <article key={record.evidenceId}><span>{readableSourceText(record.label)}</span><strong>{formatEvidence(record)}</strong></article>)}
      </div></section>}
      {series.map(group => <section className="source-series" key={group.key}><h3>{group.label} <span>{group.symbol}</span></h3>
        <EvidenceBars label={`${group.label} ${group.symbol} per periode`} rows={group.points.map(point => ({ label: point.period, value: point.value, display: formatEvidence({ value: point.value, unit: group.unit }) }))} />
      </section>)}
      <p className="source-rounding-note">Angka diringkas untuk dibaca. Nilai lengkap, waktu pengambilan, dan rumus tersedia di setiap sumber.</p>
      <button className="secondary-button source-all-button" onClick={() => setView('all')}>Telusuri {evidence.length} sumber</button>
    </div> : <div className="source-all">
      <label className="search-field"><Search size={18} aria-hidden="true" /><input aria-label="Cari sumber" placeholder="Cari metrik atau saham" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <p className="source-count" role="status">{filtered.length} dari {evidence.length} sumber</p>
      {filtered.map(record => <details className="evidence-record" key={record.evidenceId}>
        <summary><span>{readableSourceText(record.label)}</span><strong>{formatEvidence(record)}</strong><ChevronDown size={16} aria-hidden="true" /></summary>
        <dl><div><dt>Nilai lengkap</dt><dd>{formatEvidence(record, 20)}</dd></div>
          <div><dt>Diambil</dt><dd>{new Date(record.fetchedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB</dd></div>
          <div><dt>Asal</dt><dd>{demo || record.tool.startsWith('fixture:') ? 'Fixture contoh, bukan data pasar terkini' : record.cached ? 'Data tersimpan' : 'Sectors API'}</dd></div>
          {Object.entries(record.params).filter(([key]) => key in sourceParamLabels).map(([key, value]) => <div key={key}><dt>{sourceParamLabels[key]}</dt><dd>{readableSourceText(String(value))}</dd></div>)}
        </dl>
      </details>)}
      {!filtered.length && <p className="empty-source">Tidak ada sumber yang cocok. Coba kata lain.</p>}
    </div>}
    <a className="text-button" href="https://docs.sectors.app" target="_blank" rel="noreferrer">Dokumentasi sumber Sectors <ExternalLink size={14} /></a>
  </dialog>;
}
