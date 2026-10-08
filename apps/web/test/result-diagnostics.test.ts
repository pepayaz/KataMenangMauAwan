import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultView } from '../../../frontend/src/App';
import { checkFixtures } from '../../../packages/shared/fixtures';
import type { HistoryItem } from '../lib/check-view';
import type { TraceEvent } from '@cek-dulu/shared';
const sample = checkFixtures[0]!;
const noAction = () => {};
function render(traces: TraceEvent[], complete = false) {
  const active: HistoryItem = { id: sample.result.checkId, text: 'BBTN laba naik 40%', createdAt: sample.input.createdAt,
    saved: false, demo: false, result: complete ? sample.result : { ...sample.result, claims: [], verdicts: [], evidence: [] }, traces };
  return renderToStaticMarkup(createElement(ResultView, { active, onSave: noAction, onDownloadPdf: noAction, pdfBusy: false,
    claimIndex: 0, onSelectClaim: noAction, onEvidence: noAction, traceOpen: false, setTraceOpen: noAction, reset: noAction,
    onRetry: noAction, onEdit: noAction }));
}
const trace = (stage: TraceEvent['stage'], message: string, data?: unknown): TraceEvent => ({ stage, message, data,
  checkId: sample.result.checkId, ts: sample.input.createdAt });
describe('real result diagnostics', () => {
  it('shows timeout and unreached stages instead of an unverifiable verdict', () => {
    const html = render([trace('normalize', 'Resolusi saham selesai.', { status: 'ready', entities: [{ ticker: 'BBTN' }] }),
      trace('error', 'LLM terlalu lama merespons.', { code: 'EXTRACTION_FAILED', llmCode: 'TIMEOUT' })]);
    expect(html).toContain('Pemeriksaan terhenti.');
    expect(html).toContain('LLM terlalu lama merespons.');
    expect(html).toContain('Belum dijalankan');
    expect(html).toContain('Saham dikenali: BBTN');
    expect(html).not.toContain('UNVERIFIABLE');
    expect(html).not.toContain('Jejak backend selesai');
  });
  it('offers confirmation rather than automatically retrying unresolved stocks', () => {
    const html = render([trace('normalize', 'Pilihan diperlukan', { status: 'needs_user_choice' })]);
    expect(html).toContain('Konfirmasi saham diperlukan.');
    expect(html).not.toContain('Coba lagi');
  });
  it('explains zero claims and rejected candidates without inventing evidence', () => {
    const html = render([trace('extract', 'Ekstraksi klaim selesai.', { claimIds: [], rejected: [{ reason: 'PERIOD_NOT_WRITTEN' }] })]);
    expect(html).toContain('Belum ada klaim terdeteksi.');
    expect(html).toContain('0 klaim diterima · 1 kandidat ditolak');
    expect(html).toContain('Periode tidak tertulis');
    expect(html).not.toContain('NO EVIDENCE AVAILABLE');
  });
});

it('shows the exact missing fields and requested period in the claim report', () => {
  const html = render([trace('verify', 'Belum ada pembanding NIM', { claimId: sample.result.claims[0]!.claimId,
    note: 'Rata-rata aset produktif tidak tersedia.', coverage: { status: 'RATIO_INPUTS_MISSING', requestedPeriod: 'Semester I 2026',
      missingFields: ['NIM terlapor', 'rata-rata tertimbang aset produktif'], availableDates: ['2026-06-30'] } })], true);
  expect(html).toContain('NIM terlapor'); expect(html).toContain('rata-rata tertimbang aset produktif');
  expect(html).toContain('Semester I 2026'); expect(html).toContain('2026-06-30');
});
