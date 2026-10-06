import { describe, expect, it, vi } from 'vitest';
import { HypothesisSchema, type Evidence, type Hypothesis, type ToolCall } from '@cek-dulu/shared';
import { MemoryCacheStore, SectorsClient, cacheKey, ENDPOINTS } from '@cek-dulu/sectors';
import { LlmAdapter, MockLlmProvider } from '../src/llm.js';
import { createHypothesisRegistry, createSectorsHunterGateway, defaultSelection, executeHypotheses, huntContext, selectHypotheses,
  HunterBudgetError, HunterSelectionError, HunterToolError, type HunterToolGateway } from '../src/hunter/index.js';
import { dividendData, makeClaim, priceData, today } from './fixtures/hunter.js';

const claim = makeClaim('dividend');
const evidence: Evidence = { evidenceId: 'e1', claimId: claim.claimId, tool: 'fixture:synthetic',
  params: {}, credits: 0, cached: true, fetchedAt: `${today}T00:00:00.000Z`, label: 'Synthetic', value: 1 };
function registry(costs: number[], strongIndex = -1, sameTool = false): Map<string, Hypothesis> {
  return new Map(costs.map((credits, i) => [`H${i}`, { id: `H${i}`, claimType: 'dividend', description: 'Synthetic executor fixture',
    estCredits: credits, requiredTools: [{ tool: sameTool ? 'same' : `tool${i}`, params: {} }],
    test: () => ({ hypId: `H${i}`, claimId: claim.claimId, triggered: true, strength: i === strongIndex ? 'strong' : 'weak', evidenceIds: ['e1'], note: 'Fixture' }) }]));
}
const selection = (...ids: string[]) => ids.map((id) => ({ id, reason: 'Konteks relevan' }));
function gateway(costs: number[]): HunterToolGateway & { quote: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> } {
  const cost = (call: ToolCall) => costs[Number(call.tool.replace('tool', ''))] ?? 0;
  return { quote: vi.fn(async (call) => cost(call)), execute: vi.fn(async (call, opts) => {
    const credits = cost(call);
    if (credits > opts.maxCredits) throw new HunterBudgetError();
    return { evidence: [evidence], credits };
  }) };
}
function llm(outputs: unknown[]) {
  const provider = new MockLlmProvider(outputs);
  return { provider, llm: new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'uji' }, provider }) };
}

describe('registry hipotesis', () => {
  it.each(['dividend', 'valuation', 'price_move'] as const)('tiga hipotesis %s tervalidasi Zod dan tool B', (type) => {
    const entries = [...createHypothesisRegistry(makeClaim(type), { today }).values()];
    expect(entries).toHaveLength(3);
    expect(entries.every((h) => HypothesisSchema.safeParse(h).success)).toBe(true);
    expect(entries.every((h) => h.requiredTools.every((t) => t.tool in ENDPOINTS))).toBe(true);
  });
  it('registry price membagi semua panggilan maksimal 90 hari', () => {
    const entries = [...createHypothesisRegistry(makeClaim('price_move'), { today }).values()];
    expect(entries.find((h) => h.id === 'PRC_LOW_BASE')?.requiredTools).toHaveLength(3);
    for (const h of entries) for (const call of h.requiredTools) {
      const days = (Date.parse(call.params.end as string) - Date.parse(call.params.start as string)) / 86400000 + 1;
      expect(days).toBeLessThanOrEqual(90);
    }
  });
  it('test tidak menerima klaim lain dan registry tidak menebak jendela invalid', () => {
    const h = createHypothesisRegistry(claim, { today }).get('DIV_CASH_PAYOUT')!;
    expect(() => h.test({ ...claim, claimId: 'other' }, [])).toThrow();
    expect(() => createHypothesisRegistry(makeClaim('price_move', { window: 'kemarin sore' }), { today })).toThrow();
    // Jendela panjang memakai cuplikan: hipotesis deret penuh tidak berlaku, bukan dilewati karena anggaran.
    expect(createHypothesisRegistry(makeClaim('price_move', { window: 'past 5 years' }), { today }).size).toBe(0);
    expect(createHypothesisRegistry(makeClaim('price_move', { window: '90 hari' }), { today }).size).toBeGreaterThan(0);
    expect(() => createHypothesisRegistry(claim, { today: '2026-02-30' })).toThrow();
  });
});

describe('pemilihan LLM hanya dari registry', () => {
  it('menjaga urutan dan alasan dari LLM; tidak meminta perhitungan', async () => {
    const opts = llm([{ hypotheses: selection('DIV_CASH_PAYOUT', 'DIV_ONE_OFF') }]);
    const result = await selectHypotheses(claim, [], createHypothesisRegistry(claim, { today }), opts.llm);
    expect(result).toEqual(selection('DIV_CASH_PAYOUT', 'DIV_ONE_OFF'));
    expect(opts.provider.requests[0]?.prompt).toContain('Jangan menghitung angka');
  });
  it('ID asing ditolak Zod lalu retry sekali', async () => {
    const opts = llm([{ hypotheses: selection('INVENTED') }, { hypotheses: selection('DIV_CASH_PAYOUT') }]);
    expect(await selectHypotheses(claim, [], createHypothesisRegistry(claim, { today }), opts.llm)).toEqual(selection('DIV_CASH_PAYOUT'));
    expect(opts.provider.requests).toHaveLength(2);
  });
  it('dua keluaran gagal menjadi error terkontrol tanpa eksekusi', async () => {
    const opts = llm([{ hypotheses: selection('INVENTED') }, { hypotheses: selection('INVENTED') }]);
    await expect(selectHypotheses(claim, [], createHypothesisRegistry(claim, { today }), opts.llm)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  });
  it('maksimal tiga dan alasan wajib di schema', async () => {
    const opts = llm([{ hypotheses: selection('H0', 'H1', 'H2', 'H3') }, { hypotheses: [{ id: 'H0', reason: '' }] }]);
    await expect(selectHypotheses(claim, [], registry([1, 1, 1, 1]), opts.llm)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
  });
  it('ID duplikat tidak dijalankan dua kali', async () => {
    const opts = llm([{ hypotheses: selection('H0', 'H0') }]);
    await expect(selectHypotheses(claim, [], registry([1]), opts.llm)).rejects.toBeInstanceOf(HunterSelectionError);
  });
  it('prediksi dan tipe tanpa registry tidak memanggil LLM', async () => {
    const opts = llm([]);
    expect(await selectHypotheses({ ...claim, inScope: false }, [], registry([1]), opts.llm)).toEqual([]);
    expect(await selectHypotheses(makeClaim('safety'), [], createHypothesisRegistry(makeClaim('safety'), { today }), opts.llm)).toEqual([]);
    expect(opts.provider.requests).toHaveLength(0);
  });
});

describe('batas eksekusi dan kredit', () => {
  it('maksimal tiga hipotesis, delapan kredit, dan mengabaikan yang melebihi sisa', async () => {
    const tools = gateway([5, 4, 3]);
    const result = await executeHypotheses(claim, [], selection('H0', 'H1', 'H2'), registry([5, 4, 3]), tools);
    expect(result.creditsUsed).toBe(8);
    expect(result.results.map((r) => r.hypId)).toEqual(['H0', 'H2']);
    expect(result.skipped).toEqual([{ hypId: 'H1', reason: 'budget' }]);
    expect(tools.execute).toHaveBeenCalledTimes(2);
    expect(tools.execute.mock.calls.map(([, opts]) => opts.maxCredits)).toEqual([5, 3]);
  });
  it('preflight seluruh tools sebelum I/O, bukan sebagian hipotesis', async () => {
    const entries = registry([5]);
    entries.get('H0')!.requiredTools.push({ tool: 'tool1', params: {} });
    const tools = gateway([5, 4]);
    const result = await executeHypotheses(claim, [], selection('H0'), entries, tools);
    expect(result.creditsUsed).toBe(0);
    expect(tools.execute).not.toHaveBeenCalled();
    expect(result.skipped[0]?.reason).toBe('budget');
  });
  it('hit cache nol kredit dan tool identik dipakai sekali', async () => {
    const tools = gateway([0, 0, 0]);
    const result = await executeHypotheses(claim, [], selection('H0', 'H1', 'H2'), registry([1, 1, 1], -1, true), tools);
    expect(result.creditsUsed).toBe(0); expect(result.results).toHaveLength(3);
    expect(tools.execute).toHaveBeenCalledTimes(1);
    expect(result.evidence).toHaveLength(1);
  });
  it('berhenti dini hanya untuk triggered strong', async () => {
    const tools = gateway([1, 1, 1]);
    const result = await executeHypotheses(claim, [], selection('H0', 'H1', 'H2'), registry([1, 1, 1], 1), tools);
    expect(result.results).toHaveLength(2);
    expect(result.stoppedBecause).toBe('strong'); expect(result.creditsUsed).toBe(2);
    expect(tools.execute).toHaveBeenCalledTimes(2);
  });
  it('strong yang tidak triggered tidak menghentikan hunter', async () => {
    const entries = registry([0, 0], 0);
    entries.get('H0')!.test = () => ({ hypId: 'H0', claimId: claim.claimId, triggered: false, strength: 'strong', evidenceIds: ['e1'], note: 'Synthetic' });
    expect((await executeHypotheses(claim, [], selection('H0', 'H1'), entries, gateway([0, 0]))).results).toHaveLength(2);
  });
  it.each([selection('H0', 'H1', 'H2', 'H3'), selection('OTHER'), selection('H0', 'H0')].map((selected) => [selected]))(
    'menolak pilihan invalid sebelum tool', async (selected) => {
      const tools = gateway([1, 1, 1, 1]);
      await expect(executeHypotheses(claim, [], selected, registry([1, 1, 1, 1]), tools)).rejects.toBeInstanceOf(HunterSelectionError);
      expect(tools.execute).not.toHaveBeenCalled();
    });
  it('prediksi tidak mengeksekusi tools', async () => {
    const tools = gateway([1]);
    expect((await executeHypotheses({ ...claim, inScope: false }, [], [], registry([1]), tools)).stoppedBecause).toBe('out_of_scope');
    expect(tools.execute).not.toHaveBeenCalled();
  });
  it('data kosong dilaporkan dengan tool dan estimasi kredit yang diperlukan', async () => {
    const tools = gateway([0]);
    tools.execute.mockRejectedValue(new HunterToolError(0, 'missing_data'));
    const result = await executeHypotheses(claim, [], selection('H0'), registry([0]), tools);
    expect(result.results).toEqual([]);
    expect(result.pendingTools).toEqual([{ call: { tool: 'tool0', params: {} }, estimatedCredits: 0 }]);
    expect(result.skipped[0]?.reason).toBe('missing_data');
  });
  it('error tanpa biaya pasti dihitung konservatif sesuai reservasi', async () => {
    const tools = gateway([5, 4]);
    tools.execute.mockRejectedValueOnce(new Error('unknown billing'));
    const result = await executeHypotheses(claim, [], selection('H0', 'H1'), registry([5, 4]), tools);
    expect(result.creditsUsed).toBe(5); expect(result.results).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual(['tool_error', 'budget']);
  });
  it('biaya error yang diketahui dihitung tanpa menghabiskan seluruh reservasi', async () => {
    const tools = gateway([5, 5]);
    tools.execute.mockRejectedValueOnce(new HunterToolError(2));
    const result = await executeHypotheses(claim, [], selection('H0', 'H1'), registry([5, 5]), tools);
    expect(result.creditsUsed).toBe(7);
    expect(result.results.map((r) => r.hypId)).toEqual(['H1']);
  });
  it.each([-1, NaN, 1.5])('quote invalid %s tidak diterima', async (cost) => {
    const tools = gateway([0]); tools.quote.mockResolvedValue(cost);
    await expect(executeHypotheses(claim, [], selection('H0'), registry([0]), tools)).rejects.toBeInstanceOf(HunterBudgetError);
    expect(tools.execute).not.toHaveBeenCalled();
  });
  it('gateway yang melebihi reservasi dihentikan, tidak memanggil tool berikutnya', async () => {
    const tools = gateway([1, 1]); tools.execute.mockResolvedValue({ evidence: [evidence], credits: 2 });
    await expect(executeHypotheses(claim, [], selection('H0', 'H1'), registry([1, 1]), tools)).rejects.toBeInstanceOf(HunterBudgetError);
    expect(tools.execute).toHaveBeenCalledTimes(1);
  });
  it('result harus memiliki evidence anchor yang tersedia', async () => {
    const entries = registry([0]);
    entries.get('H0')!.test = () => ({ hypId: 'H0', claimId: claim.claimId, triggered: true, strength: 'strong', evidenceIds: ['missing'], note: 'Synthetic' });
    await expect(executeHypotheses(claim, [], selection('H0'), entries, gateway([0]))).rejects.toThrow('Hasil hipotesis tidak valid');
  });
});

describe('gateway B cache_only dan end-to-end hunter', () => {
  it('huntContext menjalankan pemilihan mock dan report cache resmi B tanpa jaringan', async () => {
    const cache = new MemoryCacheStore();
    await cache.set({ key: cacheKey('fetchCompanyReport', { symbol: 'ADRO', sections: ['dividend'] }),
      endpoint: 'fetchCompanyReport', params: {}, response: dividendData(), fetchedAt: new Date().toISOString(), ttlSeconds: 86400 });
    const fetchImpl = vi.fn();
    const client = new SectorsClient({ cache, config: { mode: 'cache_only' }, fetchImpl });
    const opts = llm([{ hypotheses: selection('DIV_CASH_PAYOUT', 'DIV_ONE_OFF') }]);
    const result = await huntContext(claim, [], { registry: createHypothesisRegistry(claim, { today }), llm: opts.llm,
      gateway: createSectorsHunterGateway(client, today) });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({ hypId: 'DIV_CASH_PAYOUT', triggered: true, strength: 'strong' });
    expect(result.creditsUsed).toBe(0); expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('LLM gagal memilih: hunter tetap jalan dengan urutan bawaan registry', async () => {
    const cache = new MemoryCacheStore();
    await cache.set({ key: cacheKey('fetchCompanyReport', { symbol: 'ADRO', sections: ['dividend'] }),
      endpoint: 'fetchCompanyReport', params: {}, response: dividendData(), fetchedAt: new Date().toISOString(), ttlSeconds: 86400 });
    const client = new SectorsClient({ cache, config: { mode: 'cache_only' }, fetchImpl: vi.fn() });
    const registry = createHypothesisRegistry(claim, { today });
    const failing = { generate: vi.fn(async () => { throw new Error('503'); }) };
    const result = await huntContext(claim, [], { registry, llm: failing, gateway: createSectorsHunterGateway(client, today) });
    expect(result.selectionSource).toBe('fallback');
    expect(result.selection.map((s) => s.id)).toEqual(defaultSelection(claim, registry).map((s) => s.id));
    expect(result.selection.length).toBeLessThanOrEqual(3);
    expect(result.results.some((r) => r.triggered)).toBe(true);
    expect(result.creditsUsed).toBe(0);
  });
  it('cache miss tidak live, melaporkan biaya pull yang diperlukan', async () => {
    const fetchImpl = vi.fn(), client = new SectorsClient({ config: { mode: 'cache_only' }, fetchImpl });
    const result = await executeHypotheses(claim, [], selection('DIV_TTM_GAP'), createHypothesisRegistry(claim, { today }),
      createSectorsHunterGateway(client, today));
    expect(result.creditsUsed).toBe(0);
    expect(result.skipped[0]?.reason).toBe('missing_data');
    expect(result.pendingTools[0]?.estimatedCredits).toBe(1);
    expect(result.pendingTools.map((p) => p.call.tool)).toEqual(['fetchCompanyReport', 'fetchCorporateActions']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('gateway daily/corporate-actions membaca cache B dan membuat evidence bernilai dasar', async () => {
    const cache = new MemoryCacheStore(), fetchImpl = vi.fn();
    const calls = [
      { tool: 'fetchDailyPrice', params: { symbol: 'ADRO', start: '2026-09-25', end: today } },
      { tool: 'fetchCorporateActions', params: { symbol: 'ADRO' } },
    ];
    const bodies = [priceData().slice(-2), { symbol: 'ADRO', corporate_actions: { dividend: [] } }];
    for (let i = 0; i < calls.length; i += 1) await cache.set({ key: cacheKey(calls[i]!.tool, calls[i]!.params), endpoint: calls[i]!.tool,
      params: calls[i]!.params, response: bodies[i], fetchedAt: new Date().toISOString(), ttlSeconds: 86400 });
    const tools = createSectorsHunterGateway(new SectorsClient({ cache, config: { mode: 'cache_only' }, fetchImpl }), today);
    const daily = await tools.execute(calls[0]!, { claim: makeClaim('price_move'), maxCredits: 0 });
    const actions = await tools.execute(calls[1]!, { claim, maxCredits: 0 });
    expect(daily.evidence).toHaveLength(4); expect(daily.credits).toBe(0);
    expect(actions.evidence[0]?.value).toBe('empty'); expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('gateway live memesan estimasi kredit; offline selalu gratis', async () => {
    const call = { tool: 'fetchCompanyReport', params: { symbol: 'ADRO', sections: ['dividend'] } };
    const live = createSectorsHunterGateway(new SectorsClient({ config: { mode: 'live' }, fetchImpl: vi.fn() }), today);
    const offline = createSectorsHunterGateway(new SectorsClient({ config: { mode: 'cache_only' }, fetchImpl: vi.fn() }), today);
    expect(await live.quote(call)).toBe(1);
    expect(await live.quote({ tool: 'invented', params: {} })).toBe(0);
    expect(await offline.quote(call)).toBe(0);
  });
  it('gateway menolak tool/params asing sebelum jaringan', async () => {
    const fetchImpl = vi.fn();
    const tools = createSectorsHunterGateway(new SectorsClient({ config: { mode: 'cache_only' }, fetchImpl }), today);
    await expect(tools.execute({ tool: 'invented', params: {} }, { claim, maxCredits: 0 })).rejects.toBeInstanceOf(HunterToolError);
    await expect(tools.execute({ tool: 'fetchDailyPrice', params: { symbol: 'ADRO', start: '2026-01-01', end: today } },
      { claim, maxCredits: 0 })).rejects.toBeInstanceOf(HunterToolError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
