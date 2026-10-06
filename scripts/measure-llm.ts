/** Explicit paid benchmark; never part of pnpm test. Sectors uses controlled offline fixtures. */
import { writeFile, mkdir } from 'node:fs/promises';
import { LlmAdapter, runCheck, validateGrounding, createHypothesisRegistry, type LlmUsage } from '@cek-dulu/agent';
import { checkFixtures } from '../packages/shared/fixtures/index.js';
import { fixtureCheckDeps } from './check-fixture.js';

async function main(): Promise<void> {
if (!process.argv.includes('--live-gemini')) throw new Error('Explicit --live-gemini is required.');
process.loadEnvFile('apps/web/.env.local');
process.env.SECTORS_MODE = 'cache_only';
const model = process.env.LLM_MODEL;
if (process.env.LLM_PROVIDER !== 'gemini' || model !== 'gemini-3.5-flash')
  throw new Error('Benchmark pricing is verified for web model gemini-3.5-flash only.');
const rates = { inputUsdPerMillion: 1.5, cachedInputUsdPerMillion: 0.15, outputUsdPerMillion: 9 };
type Call = LlmUsage & { cachedInputTokens: number; status: number; elapsedMs: number };
const measurements: Array<Record<string, unknown>> = [];
let callsMade = 0, totalUsd = 0;
const maxCalls = 24, maxObservedUsd = 0.5;
const callCost = (c: Call) => ((c.inputTokens - c.cachedInputTokens) * rates.inputUsdPerMillion
  + c.cachedInputTokens * rates.cachedInputUsdPerMillion + (c.outputTokens + c.thinkingTokens) * rates.outputUsdPerMillion) / 1e6;
const realRepeat = process.argv.includes('--new-check-repeat');
for (const fixture of realRepeat ? checkFixtures.slice(0, 1) : checkFixtures) {
  const stableInput = { ...fixture.input, checkId: `measurement-${fixture.input.checkId}` };
  let optimized: LlmAdapter | undefined;
  let currentCalls: Call[] = [];
  const trackedFetch: typeof fetch = async (url, init) => {
    if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Unexpected network destination.');
    if (callsMade >= maxCalls || totalUsd >= maxObservedUsd) throw new Error('Benchmark spending/call limit reached.');
    callsMade++;
    const body = JSON.parse(String(init?.body)) as { generationConfig: Record<string, unknown> };
    if (phase === 'baseline') { delete body.generationConfig.thinkingConfig; delete body.generationConfig.maxOutputTokens; }
    const start = performance.now();
    const response = await fetch(url, { ...init, body: JSON.stringify(body) });
    const payload = await response.clone().json() as { usageMetadata?: {
      promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number;
    } };
    const usage = payload.usageMetadata;
    const row: Call = { stage: 'unknown', model: model!, attempt: 1, inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0, thinkingTokens: usage?.thoughtsTokenCount ?? 0,
      cachedInputTokens: usage?.cachedContentTokenCount ?? 0, status: response.status, elapsedMs: performance.now() - start };
    currentCalls.push(row); totalUsd += callCost(row);
    return response;
  };
  let phase = 'baseline';
  for (phase of realRepeat ? ['optimized_cold', 'optimized_new_check'] : ['baseline', 'optimized_cold', 'optimized_repeat']) {
    currentCalls = [];
    const { deps } = fixtureCheckDeps(fixture.input.rawText);
    const onUsage = (usage: LlmUsage) => { const last = currentCalls.at(-1); if (last) Object.assign(last, usage); };
    const llm = phase === 'baseline'
      ? new LlmAdapter({ fetchImpl: trackedFetch, cacheTtlMs: 0, onUsage })
      : optimized ??= new LlmAdapter({ fetchImpl: trackedFetch, cacheTtlMs: 60_000, onUsage });
    // Controlled data availability: one dividend hypothesis supported by this fixture's gateway.
    deps.registry = claim => {
      const registry = createHypothesisRegistry(claim, { today: '2026-09-26' });
      return claim.type === 'dividend' ? new Map([...registry].filter(([id]) => id === 'DIV_CASH_PAYOUT')) : registry;
    };
    deps.llm = llm; deps.now = () => new Date('2026-09-26T00:00:00.000Z'); deps.concurrency = 1;
    const traces: Array<{ stage: string; data?: unknown }> = [];
    const start = performance.now();
    const result = await runCheck(phase === 'optimized_new_check' ? { ...stableInput, checkId: `${stableInput.checkId}-new` } : stableInput, deps, event => { traces.push(event); });
    const row = { fixture: fixture.input.checkId, text: fixture.input.rawText, phase,
      elapsedMs: performance.now() - start, httpCalls: currentCalls.length,
      inputTokens: currentCalls.reduce((n, c) => n + c.inputTokens, 0),
      outputTokens: currentCalls.reduce((n, c) => n + c.outputTokens, 0),
      thinkingTokens: currentCalls.reduce((n, c) => n + c.thinkingTokens, 0),
      estimatedUsd: currentCalls.reduce((n, c) => n + callCost(c), 0), calls: [...currentCalls],
      claims: result.claims.map(c => ({ type: c.type, ticker: c.ticker, asserted: c.asserted, inScope: c.inScope })),
      verdicts: result.verdicts.map(v => v.verdict), explanations: result.verdicts.map(v => v.explanation), expectedVerdict: fixture.result.verdicts[0]?.verdict,
      groundingPassed: result.verdicts.every(v => validateGrounding(v.explanation, result.evidence.filter(e => v.evidenceIds.includes(e.evidenceId))).ok),
      sectorsCredits: result.creditsUsed,
      usedTemplate: traces.some(t => t.stage === 'adjudicate' && (t.data as { usedTemplate?: boolean } | undefined)?.usedTemplate),
      errors: traces.filter(t => t.stage === 'error').map(t => t.data) };
    measurements.push(row);
    console.info(JSON.stringify({ fixture: row.fixture, phase, httpCalls: row.httpCalls, elapsedMs: Math.round(row.elapsedMs), estimatedUsd: row.estimatedUsd, verdicts: row.verdicts }));
    await mkdir('docs/measurements', { recursive: true });
    await writeFile(realRepeat ? 'docs/measurements/gemini-new-check-2026-10-06.json' : 'docs/measurements/gemini-cost-2026-10-06.json', JSON.stringify({
      measuredAt: new Date().toISOString(), model, rates, pricingSource: 'https://ai.google.dev/gemini-api/docs/pricing',
      methodology: (realRepeat ? 'ADRO repeated with a new checkId, as in web UI. ' : 'Exact-repeat phase keeps the SAME checkId to measure cache ceiling; this is not ordinary UI repeat behavior. ') + 'Same pipeline/fixture evidence/model; baseline strips only new thinking/output config and disables local cache. Ordered baseline then cold then immediate repeat per fixture. Controlled synthetic/offline verifier data; not a production-data accuracy evaluation. No video measured.',
      maxCalls, maxObservedUsd, callsMade, estimatedTotalUsd: totalUsd, measurements }, null, 2));
  }
}

}
void main().catch(() => { console.error("Benchmark stopped; inspect the saved report for completed measurements. No provider secrets logged."); process.exitCode = 1; });
