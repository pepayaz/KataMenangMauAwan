'use client';
import { useState } from 'react';
import { ArrowRight, ChartNoAxesCombined, Layers3, MessageSquareQuote } from 'lucide-react';
import { adroDividendFixture } from '../../../packages/shared/fixtures';
import { formatEvidence } from '../lib/check-view';
import VerdictBadge from './verdict-badge';
import SourceChart from './source-chart';

const layers = [
  { id: 'claim', label: 'Klaim', icon: MessageSquareQuote },
  { id: 'data', label: 'Data', icon: ChartNoAxesCombined },
  { id: 'context', label: 'Konteks', icon: Layers3 },
] as const;

export default function InvestigationPreview({ onExplore, disabled = false }: { onExplore: () => void; disabled?: boolean }) {
  const [layer, setLayer] = useState<'claim' | 'data' | 'context'>('data');
  const fixture = adroDividendFixture;
  const avg = fixture.result.evidence.find(item => item.evidenceId === 'adro-avg')!;
  const ownAvg = fixture.result.evidence.find(item => item.evidenceId === 'adro-own-avg')!;
  const ttm = fixture.result.evidence.find(item => item.evidenceId === 'adro-ttm')!;
  const payment = fixture.result.evidence.find(item => item.evidenceId === 'adro-payment')!;
  const specialYield = fixture.result.evidence.find(item => item.evidenceId === 'adro-payment-yield')!;
  return <aside className="investigation-preview" aria-label="Contoh rapor ADRO">
    <div className="preview-header"><h2>Contoh ADRO</h2><span className="preview-label">Historis</span></div>
    <div className="preview-outcome"><VerdictBadge verdict="misleading" /><span className="preview-provenance">Angka contoh bukan data pasar terkini.</span><span className="preview-provenance">23 Sep 2026 · data contoh</span></div>
    <blockquote>“{fixture.input.rawText}”</blockquote>
    <div className="preview-layer-switch" role="group" aria-label="Jelajahi contoh rapor">
      {layers.map(({ id, label, icon: Icon }, index) => <button type="button" key={id} aria-pressed={layer === id}
        onClick={() => setLayer(id)}><Icon size={16} aria-hidden="true" /><span>{label}</span><small>{index + 1}</small></button>)}
    </div>
    <div className="preview-deck" data-layer={layer}>
      <div className="preview-sheet" key={layer} aria-live="polite" aria-atomic="true">
        {layer === 'claim' ? <>
          <span className="sheet-caption"><MessageSquareQuote size={18} aria-hidden="true" /> Klaim dividen</span>
          <div className="preview-statement"><strong>{formatEvidence(avg)}</strong><span>Angka yang dirujuk<br />dalam contoh klaim</span></div>
        </> : layer === 'data' ? <SourceChart chart={{ key: 'example-yield', title: 'Yield dividen', note: 'Definisi berbeda · bukan urutan waktu', rows: [
      { label: 'Rata-rata penyedia', value: avg.value as number, display: formatEvidence(avg), detail: 'Angka Sectors; tidak sama dengan hitungan mandiri' },
      { label: 'Rata-rata mandiri', value: ownAvg.value as number, display: `≈ ${formatEvidence(ownAvg)}`, detail: '2021–2025; jumlah yield tahunan dibagi jumlah tahun. Ringkasan fixture, bukan penghitungan ulang seri mentah.' },
      { label: '12 bulan terakhir', value: ttm.value as number, display: formatEvidence(ttm), detail: 'Yield dividen 12 bulan terakhir' },
        ] }} /> : <>
          <span className="sheet-caption"><Layers3 size={18} aria-hidden="true" /> Pembayaran khusus</span>
          <strong className="preview-context-value">{formatEvidence(specialYield)}</strong>
          <span className="preview-context-label">{formatEvidence(payment)} per saham</span>
          <p className="preview-context-note">Terkait pemisahan AADI. Pembayaran ini tidak mewakili dividen rutin.</p>
        </>}
      </div>
    </div>
    <button type="button" className="preview-action" disabled={disabled} onClick={onExplore}>Gunakan contoh ADRO <ArrowRight size={18} aria-hidden="true" /></button>
  </aside>;
}
