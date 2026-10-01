'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Search, X } from 'lucide-react';
import type { Claim, ClaimVerdict, Evidence } from '@cek-dulu/shared/schemas';
import { formatEvidence, readableSourceText } from '../lib/check-view';
import { sourceCharts } from '../lib/report-presentation';
import SourceChart from './source-chart';
import VerdictBadge from './verdict-badge';

const sourceParamLabels: Record<string, string> = { formula: 'Rumus', period: 'Periode', symbol: 'Saham', start: 'Mulai', end: 'Sampai', year: 'Tahun', window: 'Rentang' };
export default function EvidenceExplorer({ evidence, verdict, claim, demo, onClose }: {
  evidence: Evidence[]; verdict: ClaimVerdict; claim?: Claim; demo: boolean; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<'summary' | 'all'>('summary');
  const [query, setQuery] = useState('');
  const [chartKey, setChartKey] = useState('');
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); trigger?.focus({ preventScroll: true }); };
  }, []);
  const charts = sourceCharts(evidence, claim, verdict);
  const chart = charts.find(item => item.key === chartKey) ?? charts[0];
  const filtered = evidence.filter(record => readableSourceText(record.label).toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID')));
  return <dialog ref={ref} className="evidence-drawer" aria-labelledby="evidence-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className="source-sticky-head"><div className="drawer-head"><h2 id="evidence-title">Sumber pemeriksaan</h2><button className="icon-button" aria-label="Tutup sumber" onClick={onClose}><X size={22} /></button></div>
    <div className="source-conclusion"><VerdictBadge verdict={verdict.verdict} /></div></header>
    <div className="source-view-switch" role="group" aria-label="Tampilan sumber">
      <button aria-pressed={view === 'summary'} onClick={() => setView('summary')}>Grafik</button>
      <button aria-pressed={view === 'all'} onClick={() => setView('all')}>Semua sumber <span>{evidence.length}</span></button>
    </div>
    {view === 'summary' ? <div className="source-overview">
      {demo && <span className="source-demo-note">Contoh historis · bukan data terkini</span>}
      {charts.length > 1 && <label className="chart-picker"><span className="sr-only">Pilih grafik</span><select aria-label="Pilih grafik" value={chart?.key} onChange={event => setChartKey(event.target.value)}>{charts.map(option => <option value={option.key} key={option.key}>{option.title}</option>)}</select></label>}
      {chart ? <SourceChart key={chart.key} chart={chart} /> : <div className="chart-empty"><Search size={30} /><strong>Belum ada angka yang sebanding</strong><span>Bukti teks tersedia di semua sumber.</span></div>}
      <details className="source-rounding-note"><summary>Tentang grafik</summary><p>Nilai dibulatkan untuk tampilan. Setiap batang memakai satuan yang sama. Yield dari definisi berbeda bukan riwayat tahunan; nilai lengkap dan asal data tersedia di semua sumber.</p></details>
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
