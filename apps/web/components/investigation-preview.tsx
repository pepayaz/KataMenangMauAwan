import { ArrowDown, ArrowUpRight, Layers3 } from 'lucide-react';
import { adroDividendFixture } from '../../../packages/shared/fixtures';
import { formatEvidence } from '../lib/check-view';
import VerdictBadge from './verdict-badge';

export default function InvestigationPreview({ onExplore, disabled = false }: { onExplore: () => void; disabled?: boolean }) {
  const fixture = adroDividendFixture;
  const avg = fixture.result.evidence.find(item => item.evidenceId === 'adro-avg')!;
  const ttm = fixture.result.evidence.find(item => item.evidenceId === 'adro-ttm')!;
  return <aside className="investigation-preview" aria-label="Contoh rapor ADRO">
    <div className="preview-header"><span className="eyebrow">BERKAS CONTOH / 001</span><span className="preview-label">DEMO</span></div>
    <div className="preview-ticker">ADRO<span>DIVIDEN</span></div>
    <blockquote>“{fixture.input.rawText}”</blockquote>
    <div className="preview-connector"><span /><ArrowDown size={14} /><span /></div>
    <VerdictBadge verdict="misleading" />
    <div className="preview-values"><div><span>Angka Sectors · rata-rata</span><strong>{formatEvidence(avg)}</strong></div><div><span>Yield TTM</span><strong>{formatEvidence(ttm)}</strong></div></div>
    <div className="preview-context"><Layers3 size={17} /><div><b>Konteks yang mengubah makna</b><p>Ada pembayaran khusus terkait pemisahan AADI. Rata-rata historis bukan janji pembayaran berulang.</p></div></div>
    <p className="preview-provenance">Contoh berdasarkan fakta 23 Sep 2026.<br />Data historis, bukan pemeriksaan terbaru.</p>
    <button type="button" className="preview-action" disabled={disabled} onClick={onExplore}>Isi contoh ini <ArrowUpRight size={17} /></button>
  </aside>;
}
