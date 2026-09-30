'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ExternalLink, FileSearch, Layers3, X } from 'lucide-react';
import type { ClaimType, Evidence } from '@cek-dulu/shared/schemas';
import { cleanText } from '../../../packages/agent/src/clean-text';
import { formatEvidence, type HistoryItem } from '../lib/check-view';
import VerdictBadge from './verdict-badge';

const typeLabels: Record<ClaimType, string> = { dividend: 'Dividen', valuation: 'Valuasi', price_move: 'Perubahan harga',
  earnings_growth: 'Pertumbuhan laba', foreign_flow: 'Arus asing', accumulation: 'Akumulasi', safety: 'Risiko' };
const sourceParamLabels: Record<string, string> = { formula: 'Rumus', period: 'Periode', symbol: 'Saham', start: 'Mulai', end: 'Sampai', year: 'Tahun', window: 'Rentang' };

function EvidenceDrawer({ evidence, demo, onClose }: { evidence: Evidence[]; demo: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="evidence-drawer" aria-labelledby="evidence-title" onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="drawer-head"><div><span className="eyebrow">CATATAN SUMBER</span><h2 id="evidence-title">Telusuri buktinya.</h2></div><button className="icon-button" aria-label="Tutup sumber" onClick={onClose}><X size={22} /></button></div>
    <p className="drawer-intro">Nilai, periode, dan asal data yang digunakan dalam rapor ini.</p>
    {evidence.map(record => <article className="evidence-record" key={record.evidenceId}>
      <h3>{record.label}</h3><strong className="evidence-value">{formatEvidence(record)}</strong>
      <dl><div><dt>Diambil</dt><dd>{new Date(record.fetchedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })} WIB</dd></div><div><dt>Asal</dt><dd>{demo || record.tool.startsWith('fixture:') ? 'Fixture contoh, bukan data pasar terkini' : record.cached ? 'Data tersimpan' : 'Sectors API'}</dd></div>
        {Object.entries(record.params).filter(([key]) => key in sourceParamLabels).map(([key, value]) => <div key={key}><dt>{sourceParamLabels[key]}</dt><dd>{String(value)}</dd></div>)}
      </dl>
      <details className="trace-detail"><summary>Detail teknis sumber</summary><pre>{JSON.stringify({ tool: record.tool, params: record.params, evidenceId: record.evidenceId }, null, 2)}</pre></details>
    </article>)}
    <a className="text-button" href="https://docs.sectors.app" target="_blank" rel="noreferrer">Dokumentasi sumber Sectors <ExternalLink size={14} /></a>
  </dialog>;
}

export default function CheckReport({ item }: { item: HistoryItem }) {
  const result = item.result;
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence[] | null>(null);
  const tickers = [...new Set(result.claims.map(claim => claim.ticker))];
  const normalizedText = cleanText(item.text);
  return <>
    <div className="report-summary"><div><span className="eyebrow">{item.demo ? 'Demo fixture offline' : 'Hasil pemeriksaan'}</span><strong>{tickers.join(' / ') || 'Belum ada klaim'}<span>{result.verdicts.length} klaim diperiksa</span></strong></div><p>{item.demo ? 'Angka contoh bukan data pasar terkini.' : 'Status berlaku untuk data dan periode yang tersedia.'}</p></div>
    {!result.verdicts.length && <div className="empty-report" role="status"><FileSearch size={26} /><div><h3>{result.claims.length === 0 ? 'Belum ada klaim yang bisa diperiksa.' : 'Pemeriksaan membutuhkan informasi tambahan.'}</h3><p>{result.claims.length === 0 ? 'Sertakan pernyataan saham, angka, atau periode. Judul, daftar ticker, dan pertanyaan saja belum cukup.' : 'Lihat pilihan saham atau jejak pemeriksaan untuk mengetahui data yang belum tersedia.'}</p></div></div>}
    {result.verdicts.map((verdict, index) => {
      const claim = result.claims.find(claim => claim.claimId === verdict.claimId);
      const evidence = result.evidence.filter(record => verdict.evidenceIds.includes(record.evidenceId));
      const asserted = claim?.asserted;
      const assertedValue = asserted?.value !== undefined ? formatEvidence({ value: asserted.unit === '%' ? asserted.value / 100 : asserted.value, unit: asserted.unit }) : 'Tidak disebutkan';
      const quote = claim ? normalizedText.slice(claim.span[0], claim.span[1]) : item.text;
      return <article className={`report-card report-${verdict.verdict}`} key={verdict.claimId}>
        <div className="claim-card-header"><span><span className="claim-index">{String(index + 1).padStart(2, '0')}</span><b>{claim?.ticker}</b><span className="claim-type">{claim ? typeLabels[claim.type] : 'Klaim'}</span></span><VerdictBadge verdict={verdict.verdict} /></div>
        <div className="report-main"><blockquote>“{quote || item.text}”</blockquote>
          <p className="claim-explanation">{verdict.explanation}</p>
          {verdict.missingContext.length > 0 && <div className="context-finding"><div className="context-finding-title"><Layers3 size={17} /><h3>Konteks yang hilang</h3></div>{verdict.missingContext.map(context => <p key={context.hypId}>{context.summary}</p>)}</div>}
        </div>
        <div className="report-evidence"><div className="metric-compare"><div><span>Diklaim{asserted?.period ? ` · ${asserted.period}` : ''}</span><strong>{assertedValue}</strong></div><ArrowRight size={18} aria-hidden="true" /><div><span>Hasil pembanding</span><strong>{verdict.computed ? formatEvidence(verdict.computed) : '—'}</strong></div></div>
          <p className="comparison-note">{verdict.computed ? evidence.find(record => record.evidenceId === verdict.computed?.evidenceId)?.label : verdict.verdict === 'out_of_scope' ? 'Prediksi tidak memiliki angka pembanding historis.' : 'Belum ada evidence numerik yang memadai.'}</p>
          <button className="evidence-button" disabled={!evidence.length} onClick={() => setSelectedEvidence(evidence)}><FileSearch size={16} />Lihat sumber<span>{evidence.length} bukti</span><ArrowRight size={16} /></button>
        </div>
      </article>;
    })}
    {selectedEvidence && <EvidenceDrawer evidence={selectedEvidence} demo={item.demo} onClose={() => setSelectedEvidence(null)} />}
  </>;
}
