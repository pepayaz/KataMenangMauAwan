// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ResultView } from '../../../frontend/src/App';
import { checkFixtures } from '../../../packages/shared/fixtures';
import type { HistoryItem } from '../lib/check-view';

const sample = checkFixtures[0]!;
const active: HistoryItem = { id: sample.result.checkId, text: sample.input.rawText,
  createdAt: sample.input.createdAt, saved: false, demo: false, result: sample.result, traces: [] };
const noop = () => {};
const props = { active, onSave: noop, onDownloadPdf: noop, pdfBusy: false, claimIndex: 0,
  onSelectClaim: noop, traceOpen: true, setTraceOpen: noop, reset: noop, onRetry: noop, onEdit: noop };
afterEach(cleanup);
it('keeps main evidence search and reports actual missing backend stages', () => {
  const fixture = { ticker: 'ADRO', category: 'Dividen', status: 'Didukung', shortStatus: 'Didukung', tone: 'green',
    headline: 'Angka cocok', summary: 'Cocok.', claimed: '25%', verified: '25%', delta: '0',
    context: '', detail: 'Angka cocok.', evidenceCount: 2, duration: '0 kredit',
    evidence: [{ evidenceId: 'yield', label: 'Yield tahunan', value: '25%' },
      { evidenceId: 'payout', label: 'Rasio pembayaran', value: '40%' }], hypotheses: [], source: 'Sectors' };
  render(createElement(ResultView, { ...props, fixture }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Cari evidence' }), { target: { value: 'pembayaran' } });
  expect(screen.queryByText('Yield tahunan')).toBeNull();
  expect(screen.getByText('Rasio pembayaran')).toBeTruthy();
  expect(screen.getAllByText('Belum dijalankan')).toHaveLength(5);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Cari evidence' }), { target: { value: 'tidak ada' } });
  expect(screen.getByText('Data yang dicari tidak ditemukan.')).toBeTruthy();
});
it('can switch between completed and interrupted reports without changing hook order', () => {
  const view = render(createElement(ResultView, props));
  const interrupted: HistoryItem = { ...active, result: { ...sample.result, claims: [], verdicts: [], evidence: [] },
    traces: [{ checkId: active.id, ts: active.createdAt, stage: 'error', message: 'Kuota habis', data: { code: 'EXTRACTION_FAILED' } }] };
  view.rerender(createElement(ResultView, { ...props, active: interrupted }));
  expect(screen.getByText('Pemeriksaan terhenti.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Coba lagi/ })).toBeTruthy();
  view.rerender(createElement(ResultView, props));
  expect(screen.queryByText('Pemeriksaan terhenti.')).toBeNull();
});

it('keeps repeated backend diagnostics out of the compact stage cards', () => {
  const traces: HistoryItem['traces'] = Array.from({ length: 20 }, (_, index) => ({
    checkId: active.id, ts: active.createdAt, stage: 'verify', message: 'Verifikasi angka selesai.',
    data: { evidenceIds: [], note: `Periode klaim ${index} belum tersedia.` },
  }));
  const { container } = render(createElement(ResultView, { ...props, active: { ...active, traces } }));
  const grid = container.querySelector('.trace-summary-grid')!;
  expect(grid.children).toHaveLength(5);
  expect(grid.textContent).not.toContain('Periode klaim');
  expect(grid.textContent).toContain('Cek data');
  expect(grid.textContent).toContain('Belum ada bukti');
  const disclosure = container.querySelector('details')!;
  expect(disclosure.hasAttribute('open')).toBe(false);
  expect(disclosure.textContent).toContain('Periode klaim 19 belum tersedia.');
});
