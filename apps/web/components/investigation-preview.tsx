import { Layers3 } from 'lucide-react';
import { adroDividendFixture } from '../../../packages/shared/fixtures';
import { formatEvidence } from '../lib/check-view';
import VerdictBadge from './verdict-badge';

export default function InvestigationPreview({ onExplore, disabled = false }: { onExplore: () => void; disabled?: boolean }) {
  const fixture = adroDividendFixture;
  const avg = fixture.result.evidence.find(item => item.evidenceId === 'adro-avg')!;
  const ttm = fixture.result.evidence.find(item => item.evidenceId === 'adro-ttm')!;
  return <aside className="investigation-preview" aria-label="Contoh rapor ADRO">
    <div className="preview-header"><h2>Contoh pemeriksaan</h2><span className="preview-label">Historis</span></div>
    <div className="preview-ticker">ADRO<span>Dividen</span></div>
    <blockquote>“{fixture.input.rawText}”</blockquote>
    <VerdictBadge verdict="misleading" />
    <div className="preview-values"><div><span>Angka Sectors · rata-rata</span><strong>{formatEvidence(avg)}</strong></div><div><span>Yield TTM</span><strong>{formatEvidence(ttm)}</strong></div></div>
    <div className="preview-context"><Layers3 size={17} /><div><b>Pembayaran khusus</b><p>Ada pembayaran terkait pemisahan AADI. Rata-rata historis bukan janji pembayaran berulang.</p></div></div>
    <p className="preview-provenance">Contoh berdasarkan fakta 23 Sep 2026.<br />Data historis, bukan pemeriksaan terbaru.</p>
    <button type="button" className="preview-action" disabled={disabled} onClick={onExplore}>Gunakan contoh ADRO</button>
  </aside>;
}
