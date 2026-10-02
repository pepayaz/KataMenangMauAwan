'use client';
import { useState } from 'react';
import { ArrowRight, Check, FileSearch, Layers3, Minus, TriangleAlert } from 'lucide-react';
import type { Claim, ClaimType, ClaimVerdict, Evidence } from '@cek-dulu/shared/schemas';
import { cleanText } from '../../../packages/agent/src/clean-text';
import { formatEvidence, readableSourceText, type HistoryItem } from '../lib/check-view';
import VerdictBadge from './verdict-badge';
import EvidenceExplorer from './evidence-explorer';
import EvidenceBars from './evidence-bars';
import { comparisonFor, contextTitles, explanationParts, verdictSignals } from '../lib/report-presentation';

const typeLabels: Record<ClaimType, string> = { dividend: 'Dividen', valuation: 'Valuasi', price_move: 'Perubahan harga',
  earnings_growth: 'Pertumbuhan laba', foreign_flow: 'Arus asing', accumulation: 'Akumulasi', safety: 'Risiko' };

export default function CheckReport({ item }: { item: HistoryItem }) {
  const result = item.result;
  const [selectedEvidence, setSelectedEvidence] = useState<{ evidence: Evidence[]; verdict: ClaimVerdict; claim?: Claim; initialEvidenceId?: string } | null>(null);
  const tickers = [...new Set(result.claims.map(claim => claim.ticker))];
  const normalizedText = cleanText(item.text);
  // Preserve extraction failures from the pipeline; an error is not a claim-free input.
  const failure = item.traces.find(trace => trace.stage === 'error'
    && (trace.data as { code?: unknown } | undefined)?.code === 'EXTRACTION_FAILED');
  return <>
    <div className="report-summary"><div>{item.demo && <span className="eyebrow">Demo fixture offline</span>}<strong>{tickers.join(' / ') || (failure ? 'Ekstraksi belum selesai' : 'Belum ada klaim')}<span>{result.verdicts.length} klaim diperiksa</span></strong></div><p>{failure ? 'Belum ada kesimpulan pemeriksaan.' : item.demo ? 'Angka contoh bukan data pasar terkini.' : 'Berdasarkan data dan periode yang tersedia.'}</p></div>
    {!result.verdicts.length && <div className="empty-report" role="status"><FileSearch size={26} /><div><h3>{failure ? 'Klaim belum dapat diperiksa.' : result.claims.length === 0 ? 'Belum ada klaim yang bisa diperiksa.' : 'Pemeriksaan membutuhkan informasi tambahan.'}</h3><p>{failure ? `${failure.message} Klaim belum diperiksa; tidak ada kesimpulan tentang isi konten.` : result.claims.length === 0 ? 'Sertakan pernyataan saham, angka, atau periode. Judul, daftar ticker, dan pertanyaan saja belum cukup.' : 'Lihat pilihan saham atau jejak pemeriksaan untuk mengetahui data yang belum tersedia.'}</p></div></div>}
    {result.verdicts.map((verdict, index) => {
      const claim = result.claims.find(claim => claim.claimId === verdict.claimId);
      const evidence = result.evidence.filter(record => verdict.evidenceIds.includes(record.evidenceId));
      const asserted = claim?.asserted;
      const comparison = comparisonFor(claim, verdict);
      const quote = claim ? normalizedText.slice(claim.span[0], claim.span[1]) : item.text;
      return <article className={`report-card report-${verdict.verdict}`} key={verdict.claimId}>
        <div className="claim-card-header"><span><span className="claim-index">{String(index + 1).padStart(2, '0')}</span><b>{claim?.ticker}</b><span className="claim-type">{claim ? typeLabels[claim.type] : 'Klaim'}</span></span></div>
        <div className="report-main">
          <div className="claim-conclusion"><VerdictBadge verdict={verdict.verdict} /><ul className="verdict-signals">{verdictSignals[verdict.verdict].map((signal, signalIndex) => <li key={signal}>{verdict.verdict === 'misleading' && signalIndex === 1 ? <TriangleAlert size={15} /> : verdict.verdict === 'supported' || verdict.verdict === 'misleading' ? <Check size={15} /> : <Minus size={15} />}{signal}</li>)}</ul></div>
          <blockquote>“{quote || item.text}”</blockquote>
        <div className="report-evidence">{comparison.values ? <div className="comparison-chart"><EvidenceBars label="Perbandingan angka klaim dan data" rows={[{ label: `Diklaim${asserted?.period ? ` · ${asserted.period}` : ''}`, value: comparison.values[0], display: comparison.left }, { label: 'Hasil pembanding', value: comparison.values[1], display: comparison.right }]} /></div> : <div className="metric-compare"><div><span>Diklaim{asserted?.period ? ` · ${asserted.period}` : ''}</span><strong>{comparison.left}</strong></div><ArrowRight size={18} aria-hidden="true" /><div><span>Hasil pembanding</span><strong>{comparison.right}</strong></div></div>}
          <p className="comparison-note">{verdict.computed ? readableSourceText(evidence.find(record => record.evidenceId === verdict.computed?.evidenceId)?.label ?? '') : verdict.verdict === 'out_of_scope' ? 'Prediksi tidak memiliki angka pembanding historis.' : 'Belum ada data angka yang memadai.'}</p>
          {verdict.computed && <details className="comparison-precision"><summary>Nilai sebelum pembulatan</summary><dl><div><dt>Klaim</dt><dd>{comparison.exactLeft ?? 'Tidak disebutkan'}</dd></div><div><dt>Data</dt><dd>{comparison.exactRight}</dd></div></dl></details>}
          <button className="evidence-button" disabled={!evidence.length} onClick={() => setSelectedEvidence({ evidence, verdict, claim })}><FileSearch size={16} />Lihat sumber<span>{evidence.length} bukti</span></button>
        </div>
          {verdict.missingContext.length > 0 && <div className="context-findings">{verdict.missingContext.map(context => {
            const facts = evidence.filter(record => context.evidenceIds.includes(record.evidenceId) && typeof record.value === 'number').slice(0, 2);
            return <section className="context-tile" key={context.hypId}><div className="context-tile-title"><Layers3 size={19} /><h3>{contextTitles[context.hypId] ?? 'Konteks tambahan'}</h3></div>
              {facts.length > 0 && <dl className="context-metrics">{facts.map(record => <div key={record.evidenceId}><dt>{readableSourceText(record.label)}</dt><dd>{formatEvidence(record)}</dd></div>)}</dl>}
              <details><summary>Mengapa penting?</summary><ul className="context-detail-points">{explanationParts(context.summary).map((part, partIndex) => <li key={partIndex}>{part}</li>)}</ul></details>
              {context.evidenceIds.some(id => evidence.some(record => record.evidenceId === id)) && <button type="button" className="context-source-button"
                aria-label={`Buka bukti ${contextTitles[context.hypId] ?? 'konteks tambahan'}`}
                onClick={() => setSelectedEvidence({ evidence, verdict, claim, initialEvidenceId: facts[0]?.evidenceId ?? context.evidenceIds.find(id => evidence.some(record => record.evidenceId === id)) })}>
                <FileSearch size={16} aria-hidden="true" /> Bukti konteks <ArrowRight size={16} aria-hidden="true" />
              </button>}
            </section>;
          })}</div>}
          <details className="explanation-details"><summary>Baca penjelasan lengkap</summary><ol className="explanation-parts">{explanationParts(verdict.explanation).map((part, partIndex) => <li key={partIndex}>{part}</li>)}</ol></details>
        </div>
      </article>;
    })}
    {selectedEvidence && <EvidenceExplorer {...selectedEvidence} demo={item.demo} onClose={() => setSelectedEvidence(null)} />}
  </>;
}
