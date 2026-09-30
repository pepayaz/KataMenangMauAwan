'use client';
import { useState } from 'react';
import { ArrowRight, FileSearch, Layers3 } from 'lucide-react';
import type { ClaimType, ClaimVerdict, Evidence } from '@cek-dulu/shared/schemas';
import { cleanText } from '../../../packages/agent/src/clean-text';
import { readableSourceText, type HistoryItem } from '../lib/check-view';
import VerdictBadge from './verdict-badge';
import EvidenceExplorer from './evidence-explorer';
import EvidenceBars from './evidence-bars';
import { comparisonFor, explanationParts, verdictSummaries } from '../lib/report-presentation';

const typeLabels: Record<ClaimType, string> = { dividend: 'Dividen', valuation: 'Valuasi', price_move: 'Perubahan harga',
  earnings_growth: 'Pertumbuhan laba', foreign_flow: 'Arus asing', accumulation: 'Akumulasi', safety: 'Risiko' };

export default function CheckReport({ item }: { item: HistoryItem }) {
  const result = item.result;
  const [selectedEvidence, setSelectedEvidence] = useState<{ evidence: Evidence[]; verdict: ClaimVerdict } | null>(null);
  const tickers = [...new Set(result.claims.map(claim => claim.ticker))];
  const normalizedText = cleanText(item.text);
  return <>
    <div className="report-summary"><div>{item.demo && <span className="eyebrow">Demo fixture offline</span>}<strong>{tickers.join(' / ') || 'Belum ada klaim'}<span>{result.verdicts.length} klaim diperiksa</span></strong></div><p>{item.demo ? 'Angka contoh bukan data pasar terkini.' : 'Berdasarkan data dan periode yang tersedia.'}</p></div>
    {!result.verdicts.length && <div className="empty-report" role="status"><FileSearch size={26} /><div><h3>{result.claims.length === 0 ? 'Belum ada klaim yang bisa diperiksa.' : 'Pemeriksaan membutuhkan informasi tambahan.'}</h3><p>{result.claims.length === 0 ? 'Sertakan pernyataan saham, angka, atau periode. Judul, daftar ticker, dan pertanyaan saja belum cukup.' : 'Lihat pilihan saham atau jejak pemeriksaan untuk mengetahui data yang belum tersedia.'}</p></div></div>}
    {result.verdicts.map((verdict, index) => {
      const claim = result.claims.find(claim => claim.claimId === verdict.claimId);
      const evidence = result.evidence.filter(record => verdict.evidenceIds.includes(record.evidenceId));
      const asserted = claim?.asserted;
      const comparison = comparisonFor(claim, verdict);
      const quote = claim ? normalizedText.slice(claim.span[0], claim.span[1]) : item.text;
      return <article className={`report-card report-${verdict.verdict}`} key={verdict.claimId}>
        <div className="claim-card-header"><span><span className="claim-index">{String(index + 1).padStart(2, '0')}</span><b>{claim?.ticker}</b><span className="claim-type">{claim ? typeLabels[claim.type] : 'Klaim'}</span></span></div>
        <div className="report-main"><blockquote>“{quote || item.text}”</blockquote>
          <div className="claim-conclusion"><VerdictBadge verdict={verdict.verdict} /><p>{verdictSummaries[verdict.verdict]}</p></div>
          {verdict.missingContext.length > 0 && <div className="context-finding"><div className="context-finding-title"><Layers3 size={17} /><h3>Konteks yang hilang</h3></div>{verdict.missingContext.map(context => <p key={context.hypId}>{context.summary}</p>)}</div>}
          <details className="explanation-details"><summary>Baca penjelasan lengkap</summary><div className="explanation-parts">{explanationParts(verdict.explanation).map((part, partIndex) => <p className="claim-explanation" key={partIndex}>{part}</p>)}</div></details>
        </div>
        <div className="report-evidence">{comparison.values ? <div className="comparison-chart"><EvidenceBars label="Perbandingan angka klaim dan data" rows={[{ label: `Diklaim${asserted?.period ? ` · ${asserted.period}` : ''}`, value: comparison.values[0], display: comparison.left }, { label: 'Hasil pembanding', value: comparison.values[1], display: comparison.right }]} /></div> : <div className="metric-compare"><div><span>Diklaim{asserted?.period ? ` · ${asserted.period}` : ''}</span><strong>{comparison.left}</strong></div><ArrowRight size={18} aria-hidden="true" /><div><span>Hasil pembanding</span><strong>{comparison.right}</strong></div></div>}
          <p className="comparison-note">{verdict.computed ? readableSourceText(evidence.find(record => record.evidenceId === verdict.computed?.evidenceId)?.label ?? '') : verdict.verdict === 'out_of_scope' ? 'Prediksi tidak memiliki angka pembanding historis.' : 'Belum ada data angka yang memadai.'}</p>
          {verdict.computed && <details className="comparison-precision"><summary>Nilai sebelum pembulatan</summary><dl><div><dt>Klaim</dt><dd>{comparison.exactLeft ?? 'Tidak disebutkan'}</dd></div><div><dt>Data</dt><dd>{comparison.exactRight}</dd></div></dl></details>}
          <button className="evidence-button" disabled={!evidence.length} onClick={() => setSelectedEvidence({ evidence, verdict })}><FileSearch size={16} />Lihat sumber<span>{evidence.length} bukti</span></button>
        </div>
      </article>;
    })}
    {selectedEvidence && <EvidenceExplorer {...selectedEvidence} demo={item.demo} onClose={() => setSelectedEvidence(null)} />}
  </>;
}
