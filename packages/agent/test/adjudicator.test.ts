import { describe, expect, it } from 'vitest';
import { ClaimVerdictSchema, type Claim, type HypothesisResult } from '@cek-dulu/shared';
import { adjudicate, VERDICT_DECISION_TABLE, type AdjudicatorEvidence,
  type AdjudicatorVerifierResult } from '../src/adjudicator.js';

const claim: Claim = { claimId: 'c1', checkId: 'check1', span: [0, 12], type: 'valuation',
  ticker: 'BBCA', asserted: { metric: 'PER', value: 3, unit: 'x' }, inScope: true };
const evidence: AdjudicatorEvidence = { evidenceId: 'e1', claimId: 'c1', tool: 'fixture:synthetic',
  params: {}, credits: 0, cached: true, fetchedAt: '2026-09-23T00:00:00.000Z',
  label: 'PER sintetis', value: 3, unit: 'x' };
const verifier: AdjudicatorVerifierResult = {
  evidence: [evidence], computed: { value: 3, unit: 'x', evidenceId: 'e1' },
  matches: true, tolerance: '±10% relatif',
};
const hypothesis: HypothesisResult = { hypId: 'VAL_PEER_GAP', claimId: 'c1', triggered: true,
  strength: 'strong', evidenceIds: ['e1'], note: 'Konteks sintetis.' };

describe('tabel keputusan adjudicator', () => {
  it.each([
    ['OUT_OF_SCOPE', { ...claim, inScope: false }, { ...verifier, evidence: [] }, [], 'out_of_scope'],
    ['NO_NUMERIC_EVIDENCE', claim, { ...verifier, evidence: [] }, [], 'unverifiable'],
    ['UNKNOWN_COMPARISON', claim, { ...verifier, matches: null }, [], 'unverifiable'],
    ['OUTSIDE_TOLERANCE', claim, { ...verifier, matches: false }, [hypothesis], 'refuted'],
    ['STRONG_CONTEXT', claim, verifier, [hypothesis], 'misleading'],
    ['SAFETY_NOT_SUPPORTED', { ...claim, type: 'safety' }, verifier, [], 'unverifiable'],
    ['SUPPORTED', claim, verifier, [], 'supported'],
  ] as const)('%s menghasilkan %s', (id, inputClaim, inputVerifier, hypotheses, verdict) => {
    expect(VERDICT_DECISION_TABLE.find((row) => row.id === id)?.verdict).toBe(verdict);
    const result = adjudicate(inputClaim, inputVerifier, hypotheses);
    expect(result.verdict).toBe(verdict);
    expect(ClaimVerdictSchema.omit({ explanation: true }).parse(result)).toEqual(result);
    expect(result).not.toHaveProperty('explanation');
  });

  it('prediksi didahulukan walau data cocok dan konteks kuat', () => {
    expect(adjudicate({ ...claim, inScope: false }, verifier, [hypothesis])).toEqual({
      claimId: 'c1', verdict: 'out_of_scope', evidenceIds: [], missingContext: [],
    });
  });
  it('data kosong didahulukan walau matches false', () => {
    expect(adjudicate(claim, { ...verifier, evidence: [], matches: false }, [hypothesis]).verdict).toBe('unverifiable');
  });
  it('perbandingan belum tersedia didahulukan walau konteks kuat', () => {
    expect(adjudicate(claim, { ...verifier, matches: null }, [hypothesis]).verdict).toBe('unverifiable');
  });
});

describe('validitas data dan computed', () => {
  it.each([null, '', '   ', 'tidak tersedia', Number.NaN, Infinity, -Infinity, '1.358'])
  ('data %s tidak memverifikasi klaim', (value) => {
    const result = adjudicate(claim, { ...verifier, evidence: [{ ...evidence, value }] }, []);
    expect(result.verdict).toBe('unverifiable');
    expect(result).not.toHaveProperty('computed');
  });
  it.each([0, '3x', '3', '0.45'])('data numerik %s tersedia', (value) => {
    expect(adjudicate(claim, { ...verifier, evidence: [{ ...evidence, value }] }, []).verdict).toBe('supported');
  });
  it('evidence milik klaim lain tidak digunakan', () => {
    expect(adjudicate(claim, { ...verifier, evidence: [{ ...evidence, claimId: 'other' }] }, []).verdict).toBe('unverifiable');
  });
  it.each([
    null,
    { value: Number.NaN, unit: 'x', evidenceId: 'e1' },
    { value: Infinity, unit: 'x', evidenceId: 'e1' },
    { value: 3, unit: 'x', evidenceId: 'unknown' },
  ])('computed invalid %# tidak digunakan', (computed) => {
    const result = adjudicate(claim, { ...verifier, computed }, []);
    expect(result.verdict).toBe('unverifiable');
    expect(result).not.toHaveProperty('computed');
  });
  it('computed opsional; matches deterministik dan evidence tetap dapat dinilai', () => {
    expect(adjudicate(claim, { ...verifier, computed: undefined }, []).verdict).toBe('supported');
  });
  it('anchor null tidak diselamatkan evidence numerik lain', () => {
    const result = adjudicate(claim, { ...verifier,
      evidence: [{ ...evidence, value: null }, { ...evidence, evidenceId: 'e2' }] }, []);
    expect(result.verdict).toBe('unverifiable');
  });
  it('null pada evidence lain tidak membatalkan anchor valid', () => {
    const result = adjudicate(claim, { ...verifier,
      evidence: [evidence, { ...evidence, evidenceId: 'empty', value: null }] }, []);
    expect(result.verdict).toBe('supported');
    expect(result.evidenceIds).toEqual(['e1']);
  });
});

describe('hipotesis konteks dan safety', () => {
  it.each([
    { ...hypothesis, strength: 'weak' },
    { ...hypothesis, triggered: false },
    { ...hypothesis, evidenceIds: [] },
    { ...hypothesis, evidenceIds: ['unknown'] },
    { ...hypothesis, evidenceIds: ['e1', 'unknown'] },
    { ...hypothesis, claimId: 'other' },
  ] satisfies HypothesisResult[])('konteks tidak cukup %# tidak menghasilkan misleading', (h) => {
    const result = adjudicate(claim, verifier, [h]);
    expect(result.verdict).toBe('supported');
    expect(result.missingContext).toEqual([]);
  });
  it('minimal satu strong cukup ketika bercampur dengan weak', () => {
    const result = adjudicate(claim, verifier, [{ ...hypothesis, hypId: 'WEAK', strength: 'weak' }, hypothesis]);
    expect(result.verdict).toBe('misleading');
    expect(result.missingContext).toEqual([{ hypId: 'VAL_PEER_GAP', summary: hypothesis.note, evidenceIds: ['e1'] }]);
  });
  it('strong tidak dapat memakai evidence kosong', () => {
    const result = adjudicate(claim, { ...verifier, evidence: [evidence,
      { ...evidence, evidenceId: 'empty', value: null }] }, [{ ...hypothesis, evidenceIds: ['empty'] }]);
    expect(result.verdict).toBe('supported');
  });
  it('konteks kualitatif dengan evidence string tetap valid bersama anchor numerik', () => {
    const result = adjudicate(claim, { ...verifier, evidence: [evidence,
      { ...evidence, evidenceId: 'context', value: 'Ada aksi korporasi.' }] },
    [{ ...hypothesis, evidenceIds: ['context'] }]);
    expect(result.verdict).toBe('misleading');
  });
  it.each([
    [true, [], 'unverifiable'],
    [true, [{ ...hypothesis, strength: 'weak' }], 'unverifiable'],
    [true, [hypothesis], 'misleading'],
    [false, [], 'refuted'],
    [false, [hypothesis], 'refuted'],
    [null, [hypothesis], 'unverifiable'],
  ] as const)('safety matches %s: %s -> %s', (matches, hypotheses, verdict) => {
    const result = adjudicate({ ...claim, type: 'safety' }, { ...verifier, matches }, hypotheses);
    expect(result.verdict).toBe(verdict);
    expect(result.verdict).not.toBe('supported');
  });
});

describe('kemurnian dan referensi hasil', () => {
  it('tidak mengubah input dan tidak berbagi array/objek mutable hasil', () => {
    const inputs = structuredClone({ claim, verifier, hypotheses: [hypothesis] });
    const before = structuredClone(inputs);
    const result = adjudicate(inputs.claim, inputs.verifier, inputs.hypotheses);
    expect(inputs).toEqual(before);
    result.evidenceIds.push('changed');
    result.missingContext[0]!.evidenceIds.push('changed');
    result.computed!.value = 999;
    expect(inputs).toEqual(before);
    expect(adjudicate(inputs.claim, inputs.verifier, inputs.hypotheses).verdict).toBe('misleading');
  });
  it('ID evidence ganda tidak digandakan di rapor', () => {
    const result = adjudicate(claim, { ...verifier, evidence: [evidence, evidence] },
      [{ ...hypothesis, evidenceIds: ['e1', 'e1'] }]);
    expect(result.evidenceIds).toEqual(['e1']);
    expect(result.missingContext[0]?.evidenceIds).toEqual(['e1']);
  });
});
