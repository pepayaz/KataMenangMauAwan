import { resolve } from 'node:path';
import { webCacheDirectory } from '../lib/web-cache';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkFixtures } from '../../../packages/shared/fixtures/index.js';
import { formatEvidence, readHistory, historyMatches, HistoryItemSchema, examples, type HistoryItem } from '../lib/check-view';
import { restoreStoredCheck, storedTimestamp } from '../lib/stored-check';
import { fetchRemoteHistory, fetchRemoteReport, sessionHeaders } from '../lib/history-client';
import CheckReport from '../components/check-report';
import Workspace from '../components/workspace';

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
    expect(html).toContain(fixture.result.verdicts[0]!.explanation);
    expect(html).toContain('Demo fixture offline');
  });
  it('menampilkan semua klaim, bukan hanya hasil pertama', () => {
    const result = { ...item.result, claims: [...item.result.claims, ...checkFixtures[1]!.result.claims], verdicts: [...item.result.verdicts, ...checkFixtures[1]!.result.verdicts] };
    const html = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, result } }));
    expect(html).toContain('Benar tapi menyesatkan'); expect(html).toContain('Didukung');
  });
  it('ekstraksi gagal tidak ditampilkan sebagai "konten tanpa klaim"', () => {
    const result = { ...item.result, claims: [], verdicts: [], evidence: [], hypothesisRuns: [] };
    const traces = [{ checkId: item.id, ts: fixture.input.createdAt, stage: 'error' as const, credits: 0,
      message: 'Kuota layanan LLM sedang habis, jadi klaim belum dapat diekstrak. Coba lagi nanti.',
      data: { code: 'EXTRACTION_FAILED', llmCode: 'QUOTA' } }];
    const html = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, result, traces } }));
    expect(html).toContain('Kuota layanan LLM sedang habis');
    expect(html).not.toContain('Konten sudah dibaca');
    const empty = renderToStaticMarkup(createElement(CheckReport, { item: { ...item, result, traces: [] } }));
    expect(empty).toContain('Konten sudah dibaca');
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
