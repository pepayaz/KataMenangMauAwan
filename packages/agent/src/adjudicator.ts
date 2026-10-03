import { parseNumber, type Claim, type ClaimVerdict, type Computed, type Evidence,
  type HypothesisResult, type Verdict } from '@cek-dulu/shared';

/** Batas input mentah; Evidence publik tetap melarang null. */
export type AdjudicatorEvidence = Omit<Evidence, 'value'> & { value: Evidence['value'] | null };
/** Kompatibel secara struktural dengan VerifierOutput, tanpa ketergantungan I/O. */
export type AdjudicatorVerifierResult = {
  computed?: Computed | null;
  /** Hasil perbandingan terhadap toleransi yang sudah dihitung verifier. */
  matches: boolean | null;
  tolerance: string;
  evidence: readonly AdjudicatorEvidence[];
};
export type AdjudicatedVerdict = Omit<ClaimVerdict, 'explanation'>;

type DecisionFacts = {
  inScope: boolean;
  numericEvidence: boolean;
  comparisonKnown: boolean;
  refuted: boolean;
  strongContext: boolean;
  safety: boolean;
};
type DecisionRule = {
  id: string;
  reason: string;
  when: Partial<DecisionFacts>;
  verdict: Verdict;
};

/** Prioritas dari atas ke bawah; baris pertama yang cocok menentukan verdict. */
export const VERDICT_DECISION_TABLE = [
  { id: 'OUT_OF_SCOPE', reason: 'Prediksi atau opini tidak diperiksa.',
    when: { inScope: false }, verdict: 'out_of_scope' },
  { id: 'NO_NUMERIC_EVIDENCE', reason: 'Data numerik kosong, null, atau tidak tersedia.',
    when: { numericEvidence: false }, verdict: 'unverifiable' },
  { id: 'UNKNOWN_COMPARISON', reason: 'Perbandingan belum tersedia atau anchor computed tidak valid.',
    when: { comparisonKnown: false }, verdict: 'unverifiable' },
  { id: 'OUTSIDE_TOLERANCE', reason: 'Nilai di luar toleransi, walau ada konteks kuat.',
    when: { refuted: true }, verdict: 'refuted' },
  { id: 'STRONG_CONTEXT', reason: 'Angka cocok dan ada konteks strong terpicu dengan evidence.',
    when: { strongContext: true }, verdict: 'misleading' },
  { id: 'SAFETY_NOT_SUPPORTED', reason: 'Tidak adanya sinyal risiko tidak membuktikan keamanan.',
    when: { safety: true }, verdict: 'unverifiable' },
  { id: 'SUPPORTED', reason: 'Angka cocok; tidak ada konteks strong yang didukung evidence.',
    when: {}, verdict: 'supported' },
] as const satisfies readonly DecisionRule[];

function usableValue(value: AdjudicatorEvidence['value']): boolean {
  return typeof value === 'number' ? Number.isFinite(value) : typeof value === 'string' && value.trim() !== '';
}

function numericValue(value: AdjudicatorEvidence['value']): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  const parsed = typeof value === 'string' ? parseNumber(value) : null;
  return parsed !== null && !parsed.ambiguous;
}

/** Fungsi murni: tidak menghitung ulang verifier, menulis penjelasan, atau melakukan I/O. */
export function adjudicate(
  claim: Claim,
  verifier: AdjudicatorVerifierResult,
  hypotheses: readonly HypothesisResult[],
): AdjudicatedVerdict {
  const evidence = verifier.evidence.filter((e) => e.claimId === claim.claimId && usableValue(e.value));
  const numeric = evidence.filter((e) => numericValue(e.value));
  const evidenceIds = [...new Set(evidence.map((e) => e.evidenceId))];
  const knownIds = new Set(evidenceIds);
  const computed = verifier.computed;
  const validComputed = computed !== null && (computed === undefined || (
    Number.isFinite(computed.value) && numeric.some((e) => e.evidenceId === computed.evidenceId)
  ));
  const strong = hypotheses.filter((h) => h.claimId === claim.claimId && h.triggered
    && h.strength === 'strong' && h.evidenceIds.length > 0
    && h.evidenceIds.every((id) => knownIds.has(id)));
  const facts: DecisionFacts = {
    inScope: claim.inScope,
    numericEvidence: numeric.length > 0,
    comparisonKnown: typeof verifier.matches === 'boolean' && validComputed,
    refuted: verifier.matches === false,
    strongContext: strong.length > 0,
    safety: claim.type === 'safety',
  };
  const rule = VERDICT_DECISION_TABLE.find((row) => Object.entries(row.when)
    .every(([key, value]) => facts[key as keyof DecisionFacts] === value))!;
  const result: AdjudicatedVerdict = {
    claimId: claim.claimId,
    verdict: rule.verdict,
    missingContext: claim.inScope ? strong.map((h) => ({
      hypId: h.hypId, summary: h.note, evidenceIds: [...new Set(h.evidenceIds)],
    })) : [],
    evidenceIds: claim.inScope ? evidenceIds : [],
  };
  if (claim.inScope && computed && validComputed) result.computed = { ...computed };
  return result;
}
