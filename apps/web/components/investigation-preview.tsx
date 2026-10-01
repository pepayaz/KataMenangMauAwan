import { adroDividendFixture } from '../../../packages/shared/fixtures';
import { formatEvidence } from '../lib/check-view';
import VerdictBadge from './verdict-badge';
import SourceChart from './source-chart';

export default function InvestigationPreview({ onExplore, disabled = false }: { onExplore: () => void; disabled?: boolean }) {
  const fixture = adroDividendFixture;
  const avg = fixture.result.evidence.find(item => item.evidenceId === 'adro-avg')!;
  const ttm = fixture.result.evidence.find(item => item.evidenceId === 'adro-ttm')!;
  return <aside className="investigation-preview" aria-label="Contoh rapor ADRO">
    <div className="preview-header"><h2>Contoh ADRO</h2><span className="preview-label">Historis</span></div>
    <blockquote>“{fixture.input.rawText}”</blockquote>
    <VerdictBadge verdict="misleading" />
    <SourceChart chart={{ key: 'example-yield', title: 'Yield dividen', note: 'Definisi berbeda · bukan urutan waktu', rows: [
      { label: 'Rata-rata Sectors', value: avg.value as number, display: formatEvidence(avg), detail: 'Rata-rata historis menurut Sectors' },
      { label: '12 bulan terakhir', value: ttm.value as number, display: formatEvidence(ttm), detail: 'Yield TTM menurut Sectors' },
    ] }} />
    <span className="preview-provenance">23 Sep 2026 · data contoh</span>
    <button type="button" className="preview-action" disabled={disabled} onClick={onExplore}>Gunakan contoh ADRO</button>
  </aside>;
}
