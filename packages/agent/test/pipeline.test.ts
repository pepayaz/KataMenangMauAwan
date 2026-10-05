import { describe, expect, it, vi } from 'vitest';
import { ClaimVerdictSchema, CheckResultSchema, TraceEventSchema, type Claim, type CheckInput, type Evidence, type TraceEvent } from '@cek-dulu/shared';
import { MemoryCacheStore, SectorsClient, cacheKey } from '@cek-dulu/sectors';
import { runCheck, displayEvidenceValues, normalizeVerifierEvidence, type PipelineDeps } from '../src/pipeline.js';
import { isOutputAllowed } from '../src/output-policy.js';
import { LlmAdapter, type LlmProvider, type LlmRequest, LlmError } from '../src/llm.js';
import { validateGrounding, withGrounding } from '../src/grounding.js';
import type { ExtractedClaim } from '../src/extractor.js';
import { checkFixtures } from '../../shared/fixtures/index.js';
import { fixtureCheckDeps } from '../../../scripts/check-fixture.js';
import { checkMain } from '../../../scripts/check.js';

const today = '2026-09-26', now = () => new Date(`${today}T00:00:00.000Z`);
const input = (text: string): CheckInput => ({ checkId: 'check1', source: 'paste', rawText: text, createdAt: now().toISOString() });
function candidate(text: string, ticker = 'ADRO'): ExtractedClaim {
  return { quote: text, span: { start: 0, end: text.length }, tickers: [ticker], type: 'valuation',
    asserted: { metric: 'PER', value: 3, unit: 'x', window: null, period: null }, inScope: true };
}
function ev(claim: Claim, value = 3, unit = 'x'): Evidence {
  return { evidenceId: `${claim.claimId}-e`, claimId: claim.claimId, tool: 'fixture:synthetic', params: {},
    credits: 0, cached: true, fetchedAt: now().toISOString(), label: 'Pembanding sintetis', value, unit };
}
function setup(text: string, claims = [candidate(text)], explanations: readonly (string | Error)[] = []) {
  const requests: LlmRequest[] = [];
  let writes = 0;
  const provider: LlmProvider = { name: 'mock', async complete(request) {
    requests.push(request);
    if (request.format.name === 'extracted_claims') return { claims };
    if (request.format.name === 'context_hypotheses') return { hypotheses: [] };
    const explicit = explanations[writes++];
    if (explicit instanceof Error) throw explicit;
    const data = JSON.parse(request.input) as { displayEvidence: Array<{ text: string }> };
    return { explanation: explicit ?? (data.displayEvidence[0] ? `Data pembanding menunjukkan ${data.displayEvidence[0].text}.` : 'Data belum cukup untuk pemeriksaan.') };
  } };
  const client = new SectorsClient({ config: { mode: 'cache_only' }, fetchImpl: vi.fn() });
  const deps: PipelineDeps = { client, llm: new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'uji' }, provider }), now,
    verifiers: { valuation: async (claim) => ({ evidence: [ev(claim)], computed: { value: 3, unit: 'x', evidenceId: ev(claim).evidenceId }, matches: true, tolerance: '10%', note: '' }) } };
  const traces: TraceEvent[] = [];
  return { deps, traces, requests, run: () => runCheck(input(text), deps, (event) => { traces.push(event); }) };
}

describe('end-to-end tiga fixture shared', () => {
  it.each(checkFixtures)('$input.checkId', async (fixture) => {
    const { deps } = fixtureCheckDeps(fixture.input.rawText);
    const traces: TraceEvent[] = [];
    const result = await runCheck(fixture.input, { ...deps, now }, (event) => { traces.push(event); });
    expect(result.verdicts[0]?.verdict).toBe(fixture.result.verdicts[0]?.verdict);
    expect(CheckResultSchema.safeParse(result).success).toBe(true);
    expect(result.verdicts.every((v) => ClaimVerdictSchema.safeParse(v).success && isOutputAllowed(v.explanation)
      && validateGrounding(v.explanation, result.evidence).ok)).toBe(true);
    expect(traces.every((t) => TraceEventSchema.safeParse(t).success && t.credits !== undefined)).toBe(true);
    expect([...new Set(traces.map((t) => t.stage))]).toEqual(['normalize', 'extract', 'route', 'verify', 'hunt', 'adjudicate', 'done']);
    expect(result.creditsUsed).toBe(0);
  });
  it('menjalankan verifier B asli dan hunter dari cache ADRO, tanpa jaringan', async () => {
    const text = checkFixtures[0]!.input.rawText, { deps } = fixtureCheckDeps(text);
    const cache = new MemoryCacheStore(), fetchImpl = vi.fn();
    await cache.set({ key: cacheKey('fetchCompanyReport', { symbol: 'ADRO', sections: ['dividend'] }), endpoint: 'fetchCompanyReport',
      params: {}, fetchedAt: new Date().toISOString(), ttlSeconds: 86400, response: { symbol: 'ADRO', company_name: 'ADRO',
        dividend: { historical_dividends: {}, yield_ttm: 0.0556, dividend_yield_avg: { period: 5, avg_yield: 0.255 }, cash_payout_ratio: -0.897 } } });
    const result = await runCheck(input(text), { ...deps, verifiers: undefined, hunterGateway: undefined,
      client: new SectorsClient({ config: { mode: 'cache_only' }, cache, fetchImpl }), now }, () => {});
    expect(result.verdicts[0]?.verdict).toBe('misleading');
    expect(result.hypothesisRuns[0]?.hypId).toBe('DIV_CASH_PAYOUT');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('nominal dividen melewati verifier asli tanpa diberi hipotesis yield', async () => {
    const text = 'UNVR dividen interim Rp87 per saham tahun buku 2025';
    const test = setup(text, [{ ...candidate(text, 'UNVR'), type: 'dividend',
      asserted: { metric: 'dividen interim per saham', value: 87, unit: 'IDR', window: null, period: 'tahun buku 2025' } }]);
    const cache = new MemoryCacheStore(), fetchImpl = vi.fn();
    // Fixture minimal sintetis; rasio kas tinggi sengaja menguji bahwa hipotesis yield tidak diterapkan.
    await cache.set({ key: cacheKey('fetchCompanyReport', { symbol: 'UNVR', sections: ['dividend'] }), endpoint: 'fetchCompanyReport',
      params: {}, fetchedAt: new Date().toISOString(), ttlSeconds: 86400, response: { symbol: 'UNVR', company_name: 'Unilever Indonesia',
        dividend: { historical_dividends: { '2025': { breakdown: [{ date: '2025-12-15', total: 87, yield: 0.0483 }],
          total_dividend: 87, total_yield: 0.0483 } }, yield_ttm: 0.1233, cash_payout_ratio: 2.26 } } });
    test.deps.client = new SectorsClient({ config: { mode: 'cache_only' }, cache, fetchImpl });
    test.deps.verifiers = undefined;
    const result = await test.run();
    expect(result.verdicts[0]).toMatchObject({ verdict: 'supported', computed: { value: 87, unit: 'IDR' }, missingContext: [] });
    expect(result.evidence.every(record => record.unit === 'IDR')).toBe(true);
    expect(result.hypothesisRuns).toEqual([]);
    expect(test.requests.some(request => request.format.name === 'context_hypotheses')).toBe(false);
    expect(result.creditsUsed).toBe(0); expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('konkurensi dan isolasi error', () => {
  it('batas dua klaim aktif dan urutan hasil sesuai ekstraksi', async () => {
    // Saham lain benar-benar tertulis supaya validator extractor menerimanya.
    const fullText = 'ADRO BBRI BBCA BMRI PER 3x';
    const many = setup(fullText, [{ ...candidate(fullText), tickers: ['ADRO', 'BBRI', 'BBCA', 'BMRI'] }]);
    let active = 0, peak = 0;
    many.deps.concurrency = 2;
    many.deps.verifiers = { valuation: async (claim) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, claim.ticker === 'ADRO' ? 20 : 5));
      active -= 1;
      return { evidence: [ev(claim)], matches: true, tolerance: '10%', note: '' };
    } };
    const result = await many.run();
    expect(peak).toBe(2); expect(active).toBe(0);
    expect(result.verdicts.map((v) => v.claimId)).toEqual(result.claims.map((c) => c.claimId));
    expect(result.verdicts).toHaveLength(4);
  });
  it('verifier satu klaim gagal; klaim lain tetap supported dan error tidak membocorkan pesan', async () => {
    const text = 'ADRO BBCA PER 3x', test = setup(text, [{ ...candidate(text), tickers: ['ADRO', 'BBCA'] }]);
    test.deps.verifiers = { valuation: async (claim) => {
      if (claim.ticker === 'ADRO') throw new Error('pesan internal jangan ditampilkan');
      return { evidence: [ev(claim)], matches: true, tolerance: '10%', note: '' };
    } };
    const result = await test.run();
    expect(result.verdicts.map((v) => v.verdict)).toEqual(['unverifiable', 'supported']);
    expect(JSON.stringify(test.traces)).not.toContain('pesan internal');
    expect(test.traces.at(-1)?.stage).toBe('done');
  });
  it.each([0, -1, 1.5, 17])('konkurensi %s invalid', async (concurrency) => {
    const test = setup('ADRO PER 3x'); test.deps.concurrency = concurrency;
    await expect(test.run()).rejects.toThrow('konkurensi');
  });
  it('pilihan ticker berhenti sebelum extractor/verifier', async () => {
    const test = setup('$ZZZZ PER 3x'); const result = await test.run();
    expect(result.claims).toEqual([]); expect(test.requests).toEqual([]);
    expect(test.traces.map((t) => t.stage)).toEqual(['normalize', 'done']);
  });
  it('LLM ekstraksi gagal menghasilkan trace error dan done terkontrol', async () => {
    const test = setup('ADRO PER 3x');
    test.deps.llm = new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'uji' }, mockOutputs: [null, null] });
    expect((await test.run()).verdicts).toEqual([]);
    expect(test.traces.map((t) => t.stage)).toEqual(['normalize', 'error', 'done']);
  });
  it('kuota LLM habis dijelaskan di trace error tanpa pesan mentah provider', async () => {
    const test = setup('ADRO PER 3x');
    test.deps.llm = new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'uji' }, provider: {
      name: 'mock', complete: async () => { throw new LlmError('QUOTA', 1); } } });
    await test.run();
    const error = test.traces.find((t) => t.stage === 'error')!;
    expect(error.message).toContain('Kuota layanan LLM sedang habis');
    expect(error.data).toMatchObject({ code: 'EXTRACTION_FAILED', llmCode: 'QUOTA' });
  });
  it('LLM terlalu lama dijelaskan sebagai timeout, bukan kegagalan umum', async () => {
    const test = setup('ADRO PER 3x');
    test.deps.llm = new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'uji' }, provider: {
      name: 'mock', complete: async () => { throw new LlmError('TIMEOUT', 1); } } });
    await test.run();
    const error = test.traces.find((t) => t.stage === 'error')!;
    expect(error.message).toContain('terlalu lama merespons');
    expect(error.data).toMatchObject({ code: 'EXTRACTION_FAILED', llmCode: 'TIMEOUT' });
  });
});

describe('grounding dan kebijakan penjelasan', () => {
  it('angka karangan ditolak, feedback diberikan untuk satu penulisan ulang', async () => {
    const test = setup('ADRO PER 3x', undefined, ['Data 500x.', 'Data 3x.']);
    expect((await test.run()).verdicts[0]?.explanation).toBe('Data 3x.');
    const writes = test.requests.filter((r) => r.format.name === 'claim_explanation');
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[1]!.input).feedback.unmatched[0].raw).toBe('500x');
  });
  it('kata terlarang ditolak dan satu rewrite cukup', async () => {
    const test = setup('ADRO PER 3x', undefined, ['Beli sekarang, PER 3x.', 'Angka PER 3x sesuai data.']);
    const result = await test.run();
    expect(result.verdicts[0]?.explanation).toBe('Angka PER 3x sesuai data.');
    const writes = test.requests.filter((r) => r.format.name === 'claim_explanation');
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[1]!.input).feedback.rejectedByPolicy).toBe(true);
  });
  it('dua kegagalan memakai template dan provider error tidak merusak klaim', async () => {
    for (const outputs of [['Beli sekarang.', 'Target harga 500.'], [new Error('provider unavailable')]]) {
      const test = setup('ADRO PER 3x', undefined, outputs);
      const result = await test.run();
      expect(result.verdicts[0]?.verdict).toBe('supported');
      expect(result.verdicts[0]?.explanation).toContain('Angka dalam klaim sesuai');
      expect(isOutputAllowed(result.verdicts[0]!.explanation)).toBe(true);
      expect(test.traces.some((t) => (t.data as { usedTemplate?: boolean })?.usedTemplate)).toBe(true);
    }
  });
  it.each(['beli', 'dibeli', 'menjual', 'jual beli', 'hold', 'ho\u200bld', 'target-harga', 'rekomendasi', 'ambil posisi'])('menolak %s', (word) => {
    expect(isOutputAllowed(`Data ${word} saham.`)).toBe(false);
  });
  it('kata biasa tidak ditolak karena substring', () => {
    expect(isOutputAllowed('Belitung memiliki data historis.')).toBe(true);
  });
  it('validasi kebijakan juga berlaku pada template withGrounding', async () => {
    await expect(withGrounding(() => 'Beli.', [], () => 'Hold.', isOutputAllowed)).rejects.toThrow('kebijakan');
  });
});

describe('kredit dan normalisasi', () => {
  it('dua evidence satu panggilan tidak menggandakan kredit', async () => {
    const test = setup('ADRO PER 3x');
    vi.spyOn(test.deps.client, 'fetchCompanyReport').mockResolvedValue({ data: { symbol: 'ADRO', company_name: 'Synthetic' },
      endpoint: 'fetchCompanyReport', params: { symbol: 'ADRO', sections: ['valuation'] }, credits: 2, cached: false, fetchedAt: now().toISOString() });
    test.deps.verifiers = { valuation: async (claim, ctx) => {
      await ctx.client.fetchCompanyReport(claim.ticker, ['valuation'], { checkId: ctx.checkId });
      return { evidence: [{ ...ev(claim), credits: 2 }, { ...ev(claim), evidenceId: `${claim.claimId}-extra`, credits: 2 }], matches: true, tolerance: '10%', note: '' };
    } };
    const result = await test.run();
    expect(result.creditsUsed).toBe(2);
    expect(test.traces.reduce((sum, t) => sum + t.credits!, 0)).toBe(2);
  });
  it('persen verifier price vs pecahan dividend dinormalisasi sekali', () => {
    const c: Claim = { claimId: 'c', checkId: 'check', type: 'price_move', ticker: 'ADRO', span: [0, 1], asserted: { metric: 'harga' }, inScope: true };
    const evidence = [ev(c, 80, '%')], copy = structuredClone(evidence);
    const normalized = normalizeVerifierEvidence(c, evidence);
    expect(normalized[0]?.value).toBe(0.8);
    expect(validateGrounding('80%', normalized).ok).toBe(true);
    expect(normalizeVerifierEvidence({ ...c, type: 'dividend' }, [ev(c, 0.255, '%')])[0]?.value).toBe(0.255);
    expect(evidence).toEqual(copy);
    expect(displayEvidenceValues(normalized)[0]?.text).toBe('80%');
  });
  it('display evidence menghindari desimal tiga digit ambigu dan tetap grounded', () => {
    const c: Claim = { claimId: 'c', checkId: 'check', type: 'valuation', ticker: 'ADRO', span: [0, 1], asserted: { metric: 'PER' }, inScope: true };
    const data = [ev(c, 3.125), { ...ev(c, 0.255, '%'), evidenceId: 'pct' }, { ...ev(c, 1358.18, 'IDR'), evidenceId: 'idr' }];
    for (const display of displayEvidenceValues(data)) expect(validateGrounding(display.text, data).ok).toBe(true);
    expect(displayEvidenceValues(data)[0]?.text).toBe('3,1250x');
  });
  it('kegagalan hunter tidak menghapus perbandingan yang sudah refuted', async () => {
    const test = setup('ADRO PER 3x');
    test.deps.verifiers = { valuation: async (claim) => ({ evidence: [ev(claim, 6)], matches: false, tolerance: '10%', note: '' }) };
    test.deps.registry = () => { throw new Error('registry unavailable'); };
    expect((await test.run()).verdicts[0]?.verdict).toBe('refuted');
  });
  it('periode valuasi yang belum didukung tidak memakai valuasi terbaru', async () => {
    const text = 'ADRO PER 3x tahun 2024', test = setup(text, [{ ...candidate(text), asserted: { ...candidate(text).asserted, period: '2024' } }]);
    const verifier = vi.fn(); test.deps.verifiers = { valuation: verifier };
    expect((await test.run()).verdicts[0]?.verdict).toBe('unverifiable');
    expect(verifier).not.toHaveBeenCalled();
  });
  it('cache miss verifier B dilaporkan dengan tool dan kredit', async () => {
    const test = setup('ADRO PER 3x'); test.deps.verifiers = undefined;
    expect((await test.run()).verdicts[0]?.verdict).toBe('unverifiable');
    const trace = test.traces.find((t) => t.stage === 'verify');
    expect((trace?.data as { pendingTools: unknown[] }).pendingTools).toEqual([
      { call: { tool: 'fetchCompanyReport', params: { symbol: 'ADRO', sections: ['valuation'] } }, estimatedCredits: 1 }]);
  });
  it('proxy menghormati tanggal router dan computed persen konsisten dengan evidence', async () => {
    const text = 'ADRO naik 80% 2026-09-01 sampai 2026-09-20', extracted: ExtractedClaim = { ...candidate(text),
      type: 'price_move', asserted: { metric: 'perubahan harga', value: 80, unit: '%', window: '2026-09-01 sampai 2026-09-20', period: null } };
    const test = setup(text, [extracted]);
    const daily = vi.spyOn(test.deps.client, 'fetchDailyPrice').mockResolvedValue({ data: [], endpoint: 'fetchDailyPrice',
      params: {}, credits: 0, cached: true, fetchedAt: now().toISOString() });
    test.deps.verifiers = { price_move: async (claim, ctx) => {
      await ctx.client.fetchDailyPrice(claim.ticker, { start: '2020-01-01', end: today }, { checkId: ctx.checkId });
      const evidence = ev(claim, 80, '%');
      return { evidence: [evidence], computed: { value: 80, unit: '%', evidenceId: evidence.evidenceId }, matches: true, tolerance: '3 pp', note: '' };
    } };
    const result = await test.run();
    expect(daily.mock.calls[0]?.[1]).toEqual({ start: '2026-09-01', end: '2026-09-20' });
    expect(result.verdicts[0]?.computed?.value).toBe(0.8);
    expect(result.evidence[0]?.value).toBe(0.8);
    expect(result.verdicts[0]?.explanation).toContain('80%');
  });
});

describe('CLI fixture eksplisit', () => {
  it.each(checkFixtures)('JSON dan trace $input.checkId', async (fixture) => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true), stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      expect(await checkMain(['--fixture', fixture.input.rawText])).toBe(0);
      expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))[0].verdict).toBe(fixture.result.verdicts[0]?.verdict);
      expect(stderr.mock.calls.map(([text]) => String(text)).join('')).toContain('Total kredit: 0');
    } finally { stdout.mockRestore(); stderr.mockRestore(); }
  });
});

describe('pipeline pilihan saham pengguna', () => {
  it('pilihan valid melanjutkan ekstraksi, invalid berhenti dengan kode eksplisit', async () => {
    const test = setup('Adarro PER 3x');
    test.deps.userSelections = [{ surface: 'Adarro', ticker: 'ADRO' }];
    const result = await test.run(); expect(result.entities[0]?.method).toBe('user');
    expect(result.verdicts[0]?.verdict).toBe('supported');
    const invalid = setup('Adarro PER 3x');
    invalid.deps.userSelections = [{ surface: 'Adarro', ticker: 'BBRI' }];
    expect((await invalid.run()).claims).toEqual([]); expect(invalid.requests).toEqual([]);
    expect(invalid.traces.find(event => event.stage === 'error')?.data).toMatchObject({ code: 'INVALID_USER_SELECTION' });
  });
});
