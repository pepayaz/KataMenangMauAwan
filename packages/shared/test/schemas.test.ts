import { describe, expect, it } from 'vitest';
import { checkFixtures, adroDividendFixture, pricePredictionFixture } from '../fixtures/index.js';
import { extractNumbers } from '../src/number-id.js';
import {
  CheckInputSchema, CheckResultSchema, ClaimSchema, ClaimVerdictSchema, EntitySchema,
  EvidenceSchema, HypothesisResultSchema, HypothesisSchema, ToolCallSchema, TraceEventSchema,
  type Hypothesis,
} from '../src/schemas.js';

describe('fixture kontrak lengkap', () => {
  it.each(checkFixtures)('$input.checkId lolos seluruh skema dan relasi ID', (fixture) => {
    const { input, result, traces } = fixture;
    expect(CheckInputSchema.parse(input)).toEqual(input);
    expect(CheckResultSchema.parse(result)).toEqual(result);
    for (const entity of result.entities) expect(EntitySchema.parse(entity)).toEqual(entity);
    const claims = new Set(result.claims.map((c) => c.claimId));
    const evidence = new Set(result.evidence.map((e) => e.evidenceId));
    expect(claims.size).toBe(result.claims.length);
    expect(evidence.size).toBe(result.evidence.length);
    expect(result.checkId).toBe(input.checkId);
    for (const claim of result.claims) {
      expect(ClaimSchema.parse(claim)).toEqual(claim);
      expect(claim.checkId).toBe(input.checkId);
      expect(input.rawText.slice(...claim.span)).not.toBe('');
      expect(claim.span[1]).toBeLessThanOrEqual(input.rawText.length);
    }
    for (const e of result.evidence) {
      expect(EvidenceSchema.parse(e)).toEqual(e);
      expect(claims.has(e.claimId)).toBe(true);
    }
    for (const h of result.hypothesisRuns) {
      expect(HypothesisResultSchema.parse(h)).toEqual(h);
      expect(claims.has(h.claimId)).toBe(true);
      for (const id of h.evidenceIds) expect(evidence.has(id)).toBe(true);
    }
    for (const verdict of result.verdicts) {
      expect(ClaimVerdictSchema.parse(verdict)).toEqual(verdict);
      expect(claims.has(verdict.claimId)).toBe(true);
      for (const id of verdict.evidenceIds) expect(evidence.has(id)).toBe(true);
      if (verdict.computed) {
        const anchor = result.evidence.find((e) => e.evidenceId === verdict.computed!.evidenceId);
        expect(anchor?.value).toBe(verdict.computed.value);
        expect(anchor?.unit).toBe(verdict.computed.unit);
      }
      for (const context of verdict.missingContext) {
        expect(result.hypothesisRuns.some((h) => h.hypId === context.hypId && h.triggered)).toBe(true);
        for (const id of context.evidenceIds) expect(evidence.has(id)).toBe(true);
      }
      // Angka penjelasan harus berasal dari evidence, termasuk normalisasi persen.
      for (const n of extractNumbers(verdict.explanation)) {
        expect(n.ambiguous).toBe(false);
        expect(result.evidence.some((e) => typeof e.value === 'number'
          && Math.abs(e.value - n.normalized!) < 1e-9)).toBe(true);
      }
    }
    for (const trace of traces) {
      expect(TraceEventSchema.parse(trace)).toEqual(trace);
      expect(trace.checkId).toBe(input.checkId);
    }
    expect(traces.at(-1)?.stage).toBe('done');
  });

  it('ADRO memakai angka sumber dan tidak menyimpulkan DIV_TTM_GAP', () => {
    expect(adroDividendFixture.result.evidence.map((e) => e.value)).toEqual([0.255, 0.236, 1358.18, 0.452, 0.0556, -0.897]);
    expect(adroDividendFixture.result.verdicts[0]?.verdict).toBe('misleading');
    expect(adroDividendFixture.result.hypothesisRuns.map((h) => h.hypId)).not.toContain('DIV_TTM_GAP');
  });

  it('prediksi tidak memerlukan evidence atau hipotesis palsu', () => {
    expect(pricePredictionFixture.result.evidence).toEqual([]);
    expect(pricePredictionFixture.result.hypothesisRuns).toEqual([]);
    expect(pricePredictionFixture.result.verdicts[0]?.verdict).toBe('out_of_scope');
  });
});

describe('validasi batas kontrak', () => {
  const fixture = adroDividendFixture;
  it.each(['paste', 'share_target', 'screenshot', 'extension'])('menerima source %s', (source) => {
    expect(CheckInputSchema.safeParse({ ...fixture.input, source }).success).toBe(true);
  });

  it.each([
    [CheckInputSchema, { ...fixture.input, source: 'scrape' }],
    [ClaimSchema, { ...fixture.result.claims[0], type: 'recommendation' }],
    [ClaimSchema, { ...fixture.result.claims[0], span: [0] }],
    [EvidenceSchema, { ...fixture.result.evidence[0], value: null }],
    [EvidenceSchema, { ...fixture.result.evidence[0], credits: -1 }],
    [HypothesisResultSchema, { ...fixture.result.hypothesisRuns[0], strength: 'certain' }],
    [ClaimVerdictSchema, { ...fixture.result.verdicts[0], verdict: 'buy' }],
    [TraceEventSchema, { ...fixture.traces[0], stage: 'scrape' }],
    [EntitySchema, { surface: 'ADRO', ticker: 'ADRO', confidence: 1.1, method: 'alias' }],
  ])('menolak payload invalid %#', (schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  const definition: Hypothesis = {
    id: 'DIV_ONE_OFF', claimType: 'dividend', description: 'Contoh kontrak fungsi lokal.',
    requiredTools: [{ tool: 'fetchCompanyReport', params: { symbol: 'ADRO', sections: ['dividend'] } }],
    estCredits: 1,
    test: (claim, evidence) => ({ hypId: 'DIV_ONE_OFF', claimId: claim.claimId, triggered: false,
      strength: 'weak', evidenceIds: evidence.map((e) => e.evidenceId), note: 'Contoh validasi kontrak.' }),
  };

  it('memvalidasi ToolCall dan menjalankan Hypothesis dengan tipe infer', () => {
    expect(ToolCallSchema.parse(definition.requiredTools[0])).toEqual(definition.requiredTools[0]);
    const parsed = HypothesisSchema.parse(definition);
    expect(parsed.test(fixture.result.claims[0]!, fixture.result.evidence).claimId).toBe('adro-c1');
  });
  it('menolak tool kosong atau params yang bukan record', () => {
    expect(ToolCallSchema.safeParse({ tool: '', params: {} }).success).toBe(false);
    expect(ToolCallSchema.safeParse({ tool: 'fetchCompanyReport', params: [] }).success).toBe(false);
  });
  it('menolak biaya negatif dan test yang bukan fungsi', () => {
    expect(HypothesisSchema.safeParse({ ...definition, estCredits: -1 }).success).toBe(false);
    expect(HypothesisSchema.safeParse({ ...definition, test: 'prompt' }).success).toBe(false);
  });
  it('memvalidasi nilai hasil fungsi, bukan hanya keberadaan fungsi', () => {
    const parsed = HypothesisSchema.parse({ ...definition, test: () => ({ triggered: 'yes' }) });
    expect(() => parsed.test(fixture.result.claims[0]!, [])).toThrow();
  });
  it('menolak argumen fungsi yang tidak mengikuti Claim', () => {
    const parsed = HypothesisSchema.parse(definition);
    expect(() => parsed.test({ ...fixture.result.claims[0]!, ticker: 12 } as never, [])).toThrow();
  });
});
