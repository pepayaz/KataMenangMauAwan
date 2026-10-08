import { describe, expect, it, vi } from 'vitest';
import { checkOutcome } from '../lib/check-outcome';
import { saveCheckResult } from '../lib/persistence';
import { runCheck, createFixtureTickerDirectory, LlmError } from '@cek-dulu/agent';
import { SectorsClient } from '@cek-dulu/sectors';
import type { TraceEvent, CheckResult } from '@cek-dulu/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
const empty: CheckResult = { checkId: 'check', entities: [], claims: [], verdicts: [], evidence: [], hypothesisRuns: [], creditsUsed: 0, finishedAt: '2026-10-08T00:00:00Z' };
const trace = (stage: TraceEvent['stage'], data?: unknown): TraceEvent => ({ checkId: 'check', ts: '2026-10-08T00:00:00Z', stage, message: 'test', data });
describe('empty check outcomes', () => {
  it('distinguishes confirmation, no claims, and extraction failure', () => {
    expect(checkOutcome(empty, [trace('normalize', { status: 'needs_user_choice' })]).kind).toBe('needs_user_choice');
    expect(checkOutcome(empty, [trace('extract', { claimIds: [] })]).kind).toBe('empty');
    expect(checkOutcome(empty, [trace('error', { code: 'EXTRACTION_FAILED' })]).kind).toBe('error');
  });
  it('reproduces BBTN extraction timeout without any Sectors request', async () => {
    const network = vi.fn(); const traces: TraceEvent[] = [];
    const result = await runCheck({ checkId: 'check', rawText: 'BBTN labanya naik 40% YoY', source: 'paste', createdAt: empty.finishedAt }, {
      client: new SectorsClient({ config: { mode: 'live', apiKey: 'test' }, fetchImpl: network }),
      directory: createFixtureTickerDirectory({ tickers: ['BBTN'] }),
      llm: { generate: vi.fn(async () => { throw new LlmError('TIMEOUT'); }) },
    }, event => { traces.push(event); });
    expect(result.entities[0]?.ticker).toBe('BBTN');
    expect(result.verdicts).toEqual([]);
    expect(checkOutcome(result, traces)).toMatchObject({ kind: 'error', message: expect.stringContaining('terlalu lama') });
    expect(traces.map(event => event.stage)).toEqual(['normalize', 'error', 'done']);
    expect(network).not.toHaveBeenCalled();
  });
  it('persists extraction failure as error while preserving normal done status', async () => {
    const update = vi.fn((_values: Record<string, unknown>) => ({ eq: vi.fn(async () => ({ error: null })) }));
    const db = { from: vi.fn(() => ({ update })) } as unknown as SupabaseClient;
    await saveCheckResult(db, empty, 'error');
    expect(update.mock.calls[0]?.[0]).toMatchObject({ status: 'error', credits_used: 0 });
    await saveCheckResult(db, empty);
    expect(update.mock.calls[1]?.[0]).toMatchObject({ status: 'done' });
  });
});
