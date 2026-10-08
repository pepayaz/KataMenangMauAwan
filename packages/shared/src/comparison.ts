export type BoundComparison = 'gt' | 'gte' | 'lt' | 'lte';
/** Literal operator immediately preceding the anchored number; no LLM inference. */
export function literalBound(prefix: string): BoundComparison | undefined {
 const text = prefix.trimEnd();
 if (/(?:>=|≥|setidaknya|minimal|paling sedikit|tidak kurang dari|tidak di bawah|tidak dibawah)\s*$/i.test(text)) return 'gte';
 if (/(?:<=|≤|maksimal|paling banyak|tidak lebih dari|tidak di atas|tidak diatas)\s*$/i.test(text)) return 'lte';
 if (/(?:>|di atas|diatas|lebih dari|above|greater than)\s*$/i.test(text)) return 'gt';
 if (/(?:<|di bawah|dibawah|kurang dari|below|less than)\s*$/i.test(text)) return 'lt';
 return undefined;
}
export function satisfiesBound(actual: number, threshold: number, comparison: BoundComparison): boolean {
 if (!Number.isFinite(actual) || !Number.isFinite(threshold)) return false;
 return comparison === 'gt' ? actual > threshold : comparison === 'gte' ? actual >= threshold
  : comparison === 'lt' ? actual < threshold : actual <= threshold;
}
