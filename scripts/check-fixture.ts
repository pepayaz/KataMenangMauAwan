import { LlmAdapter, flattenHunterToolResult, type PipelineDeps, type LlmProvider } from '@cek-dulu/agent';
import { SectorsClient } from '@cek-dulu/sectors';
import { checkFixtures, type CheckFixture } from '../packages/shared/fixtures/index.js';
import type { Claim } from '@cek-dulu/shared';

/** Hanya demo eksplisit; tidak pernah mengganti data produksi dengan fixture. */
export function fixtureCheckDeps(text: string): { fixture: CheckFixture; deps: PipelineDeps } {
  const fixture = checkFixtures.find((f) => f.input.rawText === text);
  if (!fixture) throw new Error('Teks harus sama dengan salah satu fixture shared.');
  const sourceClaim = fixture.result.claims[0]!;
  const provider: LlmProvider = { name: 'mock', async complete(request) {
    if (request.format.name === 'extracted_claims') return { claims: [{ span: { start: 0, end: text.length },
      quote: text, tickers: [sourceClaim.ticker], type: sourceClaim.type, inScope: sourceClaim.inScope,
      asserted: { metric: sourceClaim.asserted.metric, value: sourceClaim.asserted.value ?? null,
        unit: sourceClaim.asserted.unit ?? null, window: sourceClaim.asserted.window ?? null, period: sourceClaim.asserted.period ?? null } }] };
    if (request.format.name === 'context_hypotheses') return { hypotheses: sourceClaim.type === 'dividend'
      ? [{ id: 'DIV_CASH_PAYOUT', reason: 'Periksa konteks rasio pembayaran kas.' }] : [] };
    if (request.format.name === 'claim_explanation') return { explanation: fixture.result.verdicts[0]!.explanation };
    throw new Error('Tahap mock fixture tidak dikenal.');
  } };
  const deps: PipelineDeps = {
    client: new SectorsClient({ config: { mode: 'cache_only' } }),
    llm: new LlmAdapter({ env: { LLM_PROVIDER: 'mock', LLM_MODEL: 'fixture-only' }, provider }),
    verifiers: { [sourceClaim.type]: async (claim: Claim) => ({ evidence: fixture.result.evidence.map((e) => ({ ...e, claimId: claim.claimId })),
      matches: true, tolerance: 'Fixture kontrak', note: 'Demo eksplisit offline.', computed: fixture.result.verdicts[0]?.computed }) },
    hunterGateway: () => ({ async quote() { return 0; }, async execute(call, { claim }) {
      return { credits: 0, evidence: flattenHunterToolResult(claim, {
        data: { symbol: claim.ticker, dividend: { cash_payout_ratio: -0.897 } }, endpoint: 'fetchCompanyReport', params: call.params,
        credits: 0, cached: true, fetchedAt: fixture.input.createdAt }, '2026-09-26') };
    } }),
  };
  return { fixture, deps };
}
