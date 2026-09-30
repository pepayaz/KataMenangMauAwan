import { resolve } from 'node:path';
import { webCacheDirectory } from '../lib/web-cache';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkFixtures } from '../../../packages/shared/fixtures/index.js';
import { formatEvidence, readableSourceText, readHistory, historyMatches, HistoryItemSchema, examples, type HistoryItem } from '../lib/check-view';
import { restoreStoredCheck, storedTimestamp } from '../lib/stored-check';
import { fetchRemoteHistory, fetchRemoteReport, sessionHeaders } from '../lib/history-client';
import CheckReport from '../components/check-report';
import Workspace from '../components/workspace';
import TraceTimeline from '../components/trace-timeline';
import { explanationParts } from '../lib/report-presentation';

const fixture = checkFixtures[0]!;
const item: HistoryItem = { id: fixture.result.checkId, text: fixture.input.rawText, createdAt: fixture.input.createdAt,
  demo: true, saved: false, result: fixture.result, traces: fixture.traces };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function sqlFixture() {
  return { check: { id: item.id, credits_used: 0, finished_at: item.result.finishedAt },
    claims: item.result.claims.map(c => ({ id: c.claimId, type: c.type, ticker: c.ticker, asserted: c.asserted, in_scope: c.inScope, span: `[${c.span[0]},${c.span[1]})` })),
    evidence: item.result.evidence.map(e => ({ id: e.evidenceId, claim_id: e.claimId, tool: e.tool, params: e.params, value: e.value, unit: e.unit,
      credits: e.credits, cached: e.cached, fetched_at: e.fetchedAt, label: e.label })),
    verdicts: item.result.verdicts.map(v => ({ claim_id: v.claimId, verdict: v.verdict, computed: v.computed,
      missing_context: v.missingContext, explanation: v.explanation, evidence_ids: v.evidenceIds })),
    hypotheses: item.result.hypothesisRuns.map(h => ({ claim_id: h.claimId, hyp_id: h.hypId, triggered: h.triggered, strength: h.strength, evidence_ids: h.evidenceIds, note: h.note })),
    trace: [{ ts: fixture.input.createdAt, stage: 'normalize', message: 'Saham dikenali', data: { entities: item.result.entities }, credits: 0 }],
  };
}
describe('rapor dan riwayat UI memakai hasil shared', () => {
  it.each(checkFixtures)('menampilkan verdict backend $input.checkId tanpa fixture UI sendiri', fixture => {
    const html = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, id: fixture.result.checkId, text: fixture.input.rawText, result: fixture.result, traces: fixture.traces } }));
    explanationParts(fixture.result.verdicts[0]!.explanation).forEach(part => expect(html).toContain(part));
    expect(html).toContain('Demo fixture offline');
  });
  it('menampilkan semua klaim, bukan hanya hasil pertama', () => {
    const result = { ...item.result, claims: [...item.result.claims, ...checkFixtures[1]!.result.claims], verdicts: [...item.result.verdicts, ...checkFixtures[1]!.result.verdicts] };
    const html = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, result } }));
    expect(html).toContain('Benar tapi menyesatkan'); expect(html).toContain('Didukung');
  });
  it('memisahkan kutipan berdasarkan span teks bersih dan menormalisasi persen hanya sekali', () => {
    const second = checkFixtures[1]!;
    const text = `${item.text}\n${second.input.rawText}`;
    const offset = item.text.length + 1;
    const result = { ...item.result, claims: [...item.result.claims, { ...second.result.claims[0]!, span: [offset, text.length] as [number, number] }],
      verdicts: [...item.result.verdicts, ...second.result.verdicts], evidence: [...item.result.evidence, ...second.result.evidence] };
    const html = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, text: `  ${text.replace(' ', '\t\u200b')}  `, result } }));
    expect(html).toContain('<blockquote>“ADRO yield 25,5% setahun”</blockquote>');
    expect(html).toContain('<blockquote>“BBCA PER cuma 3x”</blockquote>');
    expect(html).toContain('<strong>25,5%</strong>'); expect(html).not.toContain('2.550%');
  });
  it('prediksi tanpa evidence tidak menawarkan pembanding atau tombol sumber aktif', () => {
    const prediction = checkFixtures[2]!;
    const html = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, text: prediction.input.rawText, result: prediction.result } }));
    expect(html).toContain('Di luar cakupan'); expect(html).toContain('<strong>Belum tersedia</strong>');
    expect(html).toContain('class="evidence-button" disabled=""');
  });
  it('jejak hanya memuat event aktual, error dan kredit yang diterima', () => {
    const html = renderToStaticMarkup(createElement(TraceTimeline, { events: [
      { checkId: 'c', ts: fixture.input.createdAt, stage: 'verify', message: 'Data ditemukan', credits: 2 },
      { checkId: 'c', ts: fixture.input.createdAt, stage: 'error', message: 'Data kedua kosong', credits: 0 },
    ] }));
    expect(html).toContain('Memeriksa angka'); expect(html).toContain('Ada kendala');
    expect(html).toContain('2 kredit Sectors'); expect(html).not.toContain('Memisahkan klaim');
    expect(html).not.toContain('trace-active');
  });
  it('contoh UI sama dengan input fixture pipeline dan SSR tanpa localStorage', () => {
    expect(examples.map(example => example.text)).toEqual(checkFixtures.map(fixture => fixture.input.rawText));
    expect(renderToStaticMarkup(createElement(Workspace, { fixtureDemo: true }))).toContain('Cek klaim ini');
    expect(readHistory()).toEqual([]);
  });
  it('validasi riwayat menolak id lain, JSON rusak dan riwayat demo lama', () => {
    expect(HistoryItemSchema.safeParse({ ...item, id: 'other' }).success).toBe(false);
    expect(readHistory({ getItem: () => 'broken' })).toEqual([]);
    expect(readHistory({ getItem: () => JSON.stringify([{ demoId: 'dividend', text: 'old' }, item]) })).toEqual([item]);
  });
  it('riwayat tersimpan memuat hasil lengkap setelah reload dan filter semua verdict', () => {
    const restored = readHistory({ getItem: () => JSON.stringify([item]) });
    expect(restored[0]?.result.evidence).toEqual(item.result.evidence);
    expect(historyMatches(item, 'adro', 'Benar tapi menyesatkan', false)).toBe(true);
    expect(historyMatches(item, '', 'Semua', true)).toBe(false);
    expect(historyMatches({ ...item, saved: true }, '', 'Semua', true)).toBe(true);
    expect(historyMatches(item, '', 'Dibantah', false)).toBe(false);
  });
  it.each([[0.255, '%', '25,5%'], [1358.18, 'IDR', 'Rp1.358,18'], [3, 'x', '3×']])('format unit %s %s', (value, unit, text) => {
    expect(formatEvidence({ value, unit: unit as string })).toBe(text);
  });
});
it('data kosong diberi label eksplisit', () => {
  expect(formatEvidence({value: 'empty'})).toBe('Data belum tersedia');
});
it('nama field dan rumus fixture menjadi teks terbaca tanpa mengubah angka atau label lain', () => {
  expect(readableSourceText('Angka Sectors dividend_yield_avg.avg_yield')).toBe('Rata-rata yield dividen menurut Sectors');
  expect(readableSourceText('sum(total_yield per tahun) / jumlah tahun')).toBe('Jumlah yield tahunan dibagi jumlah tahun');
  expect(readableSourceText('PER sintetis untuk pengujian')).toBe('PER sintetis untuk pengujian');
  expect(readableSourceText('2021–2025')).toBe('2021–2025');
  expect(readableSourceText('dividend.cash_payout_ratio ADRO')).toBe('Rasio pembayaran dividen terhadap kas ADRO');
  expect(readableSourceText('dividend.year_coverage ADRO 2026')).toBe('Ketersediaan data dividen ADRO 2026');
  expect(readableSourceText('valuation.pe BBCA 2025')).toBe('PER BBCA 2025');
  expect(formatEvidence({ value: 'unknown' })).toBe('Belum diketahui');
  expect(formatEvidence({ value: 'available' })).toBe('Data tersedia');
});
describe('rekonstruksi riwayat SQL', () => {
  it('timestamp Postgres dengan offset dinormalisasi ke UTC shared', () => {
    expect(storedTimestamp('2026-09-26T12:00:00+07:00')).toBe('2026-09-26T05:00:00.000Z');
    expect(() => storedTimestamp('invalid')).toThrow();
    const raw = sqlFixture(); raw.trace[0]!.ts = '2026-09-26T12:00:00+07:00';
    expect(restoreStoredCheck(raw).trace[0]!.ts).toBe('2026-09-26T05:00:00.000Z');
  });
  it('memulihkan kontrak shared, span dan trace dengan checkId', () => {
    const restored = restoreStoredCheck(sqlFixture());
    expect(restored.result).toEqual(item.result); expect(restored.trace[0]?.checkId).toBe(item.id);
  });
  it('span rusak dan data kosong tidak dianggap rapor lengkap', () => {
    const raw = sqlFixture(); raw.claims[0]!.span = 'bad';
    expect(() => restoreStoredCheck(raw)).toThrow();
    expect(() => restoreStoredCheck({ ...sqlFixture(), check: { id: item.id, credits_used: 0, finished_at: null } })).toThrow();
  });
});
describe('riwayat backend di browser', () => {
  it('401 mempertahankan fungsi riwayat anonim tanpa autentikasi palsu', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status: 401 }));
    expect((await fetchRemoteHistory()).message).toContain('Belum ada sesi');
    expect(network).toHaveBeenCalledWith('/api/history', { headers: {} });
    expect(await sessionHeaders()).toEqual({});
  });
  it('mengambil dan membuka rapor backend sesuai kontrak', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', ''); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const network = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ checks: [{ checkId: item.id, excerpt: item.text, claimCount: 1, createdAt: item.createdAt, tickers: ['ADRO'] }], changes: [] }))
      .mockResolvedValueOnce(Response.json({ check: { rawText: item.text, createdAt: item.createdAt }, result: item.result, trace: item.traces }));
    expect((await fetchRemoteHistory()).checks).toHaveLength(1);
    const report = await fetchRemoteReport(item.id); expect(report.result).toEqual(item.result); expect(report.demo).toBe(false);
    expect(network).toHaveBeenCalledTimes(2);
  });
});

it('server Next dan CLI memakai direktori cache root yang sama, override dihormati', () => {
  const root = process.cwd();
  expect(webCacheDirectory(root, '')).toBe(resolve(root, '.cache/sectors'));
  expect(webCacheDirectory(resolve(root, 'apps/web'), '')).toBe(resolve(root, '.cache/sectors'));
  expect(webCacheDirectory(root, 'my-cache')).toBe(resolve(root, 'my-cache'));
});
