import type { Claim, ClaimVerdict, Evidence, Verdict } from '@cek-dulu/shared/schemas';
import { formatEvidence, readableSourceText } from './check-view';

export const verdictSummaries: Record<Verdict, string> = {
  supported: 'Angka cocok dengan data pembanding dalam toleransi pemeriksaan.',
  refuted: 'Angka klaim berbeda dari data pembanding di luar toleransi pemeriksaan.',
  misleading: 'Angka cocok, tetapi ada konteks penting yang mengubah maknanya.',
  unverifiable: 'Data yang tersedia belum cukup untuk memastikan klaim ini.',
  out_of_scope: 'Prediksi atau opini tidak dapat dipastikan dengan data historis.',
};

/** Split prose for reading only; decimal separators and the original numbers stay intact. */
export function explanationParts(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z“"])/u);
}

/** Display only: values and adjudication remain untouched. Never chart incompatible units. */
export function comparisonFor(claim: Claim | undefined, verdict: ClaimVerdict) {
  const unit = claim?.asserted.unit;
  const asserted = claim?.asserted.value;
  const left = asserted === undefined ? undefined : { value: unit === '%' ? asserted / 100 : asserted, unit };
  const right = verdict.computed;
  let digits = 2;
  // A refuted comparison must not look equal merely because display rounding hides the gap.
  if (left && right && verdict.verdict === 'refuted' && left.unit === right.unit && left.value !== right.value) {
    while (digits < 20 && formatEvidence(left, digits) === formatEvidence(right, digits)) digits++;
  }
  const compatible = left && right && left.unit === right.unit && Number.isFinite(left.value) && Number.isFinite(right.value);
  return {
    left: left ? formatEvidence(left, digits) : 'Tidak disebutkan',
    right: right ? formatEvidence(right, digits) : 'Belum tersedia',
    exactLeft: left ? formatEvidence(left, 20) : undefined,
    exactRight: right ? formatEvidence(right, 20) : undefined,
    values: compatible ? [left.value, right.value] as [number, number] : undefined,
  };
}

export type EvidenceSeries = { key: string; label: string; symbol: string; unit: string;
  points: { period: string; value: number; evidenceId: string }[] };
const chartMetrics = new Set(['dividend.total', 'dividend.payment', 'valuation.pe', 'valuation.pb', 'valuation.peg', 'daily.close', 'daily.volume']);

/** Only explicit metadata creates a series; labels, missing data and conflicting observations never do. */
export function evidenceSeries(evidence: Evidence[]): EvidenceSeries[] {
  const groups = new Map<string, EvidenceSeries>();
  const conflicts = new Set<string>();
  for (const record of evidence) {
    const meta = record.params.hunter;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;
    const { metric, symbol, peer, year, date } = meta as Record<string, unknown>;
    if (typeof metric !== 'string' || !chartMetrics.has(metric) || typeof symbol !== 'string'
      || typeof record.value !== 'number' || !Number.isFinite(record.value) || !record.unit) continue;
    const period = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date
      : typeof year === 'number' && Number.isInteger(year) && year >= 1900 && year <= 2200 ? String(year) : undefined;
    if (!period) continue;
    const ticker = typeof peer === 'string' ? peer : symbol;
    const key = `${metric}:${ticker}:${record.unit}:${period.length === 4 ? 'year' : 'date'}`;
    const group = groups.get(key) ?? { key, label: readableSourceText(metric), symbol: ticker, unit: record.unit, points: [] };
    const existing = group.points.find(point => point.period === period);
    if (existing && existing.value !== record.value) conflicts.add(key);
    else if (!existing) group.points.push({ period, value: record.value, evidenceId: record.evidenceId });
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.points.length >= 2 && !conflicts.has(group.key))
    .map(group => ({ ...group, points: group.points.sort((a, b) => a.period.localeCompare(b.period)) }));
}

/** Shared zero axis supports negative observations, without implying interpolation or clipping. */
export function barScale(values: number[]) {
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const extent = max - min || 1;
  const zero = min === 0 ? 0 : -min / extent * 100;
  return { zero, bar: (value: number) => ({ left: value < 0 ? (value - min) / extent * 100 : zero,
    width: Math.abs(value) / extent * 100 }) };
}
