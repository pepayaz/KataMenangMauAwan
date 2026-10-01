import { describe, expect, it } from 'vitest';
import { checkFixtures } from '../../../packages/shared/fixtures/index.js';
import type { Evidence } from '@cek-dulu/shared/schemas';
import { barScale, comparisonFor, evidenceSeries, explanationParts, sourceCharts, verdictSummaries } from '../lib/report-presentation';
import { formatEvidence } from '../lib/check-view';

const fixture = checkFixtures[0]!;
const claim = fixture.result.claims[0]!;
const verdict = fixture.result.verdicts[0]!;
const base = fixture.result.evidence[0]!;
function observation(year: number, value: Evidence['value'], extra: Partial<Evidence> = {}): Evidence {
  return { ...base, evidenceId: `e-${year}-${value}`, label: 'Label without dates', value, unit: '%',
    params: { hunter: { metric: 'dividend.total', symbol: 'ADRO', year } }, ...extra };
}

describe('numeric presentation preserves evidence', () => {
  it('splits full explanations without splitting decimal values or changing prose', () => {
    const text = 'Yield 25,4978% pada 2024. Kas -0.897x. Pembayaran Rp1.358,18.';
    expect(explanationParts(text)).toHaveLength(3);
    expect(explanationParts(text).join(' ')).toBe(text);
    expect(explanationParts(fixture.result.verdicts[0]!.explanation).join(' ')).toBe(fixture.result.verdicts[0]!.explanation);
  });
  it('rounds the display while preserving full values and the verdict', () => {
    const original = JSON.stringify({ claim, verdict });
    const presentation = comparisonFor(claim, { ...verdict, computed: { value: 0.254978, unit: '%', evidenceId: base.evidenceId } });
    expect(presentation.left).toBe('25,5%'); expect(presentation.right).toBe('25,5%');
    expect(presentation.exactRight).toBe('25,4978%');
    expect(presentation.values).toEqual([0.255, 0.254978]);
    expect(JSON.stringify({ claim, verdict })).toBe(original);
  });
  it('keeps a refuted comparison visibly different even with a small gap', () => {
    const pair = comparisonFor(claim, { ...verdict, verdict: 'refuted', computed: { value: 0.254978, unit: '%', evidenceId: base.evidenceId } });
    expect(pair.left).not.toBe(pair.right); expect(pair.right).toBe('25,498%');
  });
  it('does not chart incompatible units', () => {
    expect(comparisonFor(claim, { ...verdict, computed: { value: 3, unit: 'x', evidenceId: base.evidenceId } }).values).toBeUndefined();
  });
  it('does not replace a missing comparison with zero', () => {
    const pair = comparisonFor(undefined, { ...verdict, computed: undefined });
    expect(pair.right).toBe('Belum tersedia'); expect(pair.left).toBe('Tidak disebutkan'); expect(pair.values).toBeUndefined();
  });
  it('preserves signs and distinguishes currency, ratios and percentages', () => {
    expect(formatEvidence({ value: -0.897365, unit: 'x' })).toBe('-0,9×');
    expect(formatEvidence({ value: 1358.18, unit: 'IDR' })).toBe('Rp1.358,18');
    expect(formatEvidence({ value: 0.0556, unit: '%' })).toBe('5,56%');
  });
  it('gives each of the five verdicts its own summary', () => {
    expect(Object.keys(verdictSummaries)).toHaveLength(5);
    expect(verdictSummaries.misleading).toContain('konteks');
    expect(verdictSummaries.out_of_scope).toContain('Prediksi');
  });
});
describe('charts require explicit periods', () => {
  it('sorts years and deduplicates only identical observations', () => {
    const groups = evidenceSeries([observation(2025, 0.05), observation(2023, 0.1), observation(2025, 0.05)]);
    expect(groups).toHaveLength(1); expect(groups[0]?.points.map(p => p.period)).toEqual(['2023', '2025']);
    expect(groups[0]?.points.map(p => p.value)).toEqual([0.1, 0.05]);
  });
  it('excludes a series with conflicting observations in one period', () => {
    expect(evidenceSeries([observation(2023, 0.1), observation(2025, 0.05), observation(2025, 0.08)])).toEqual([]);
  });
  it('does not infer periods from labels', () => {
    expect(evidenceSeries([observation(2023, 0.1, { params: {}, label: 'ADRO 2023' }), observation(2025, 0.05)])).toEqual([]);
  });
  it('keeps yearly and daily observations in separate series', () => {
    expect(evidenceSeries([observation(2023, 0.1), observation(2025, 0.05, {
      params: { hunter: { metric: 'dividend.total', symbol: 'ADRO', date: '2025-03-01' } },
    })])).toEqual([]);
  });
  it('separates metrics, units and companies', () => {
    expect(evidenceSeries([observation(2023, 0.1), observation(2025, 1, { unit: 'x' }),
      observation(2025, 0.1, { params: { hunter: { metric: 'dividend.total', symbol: 'BBCA', year: 2025 } } }),
      observation(2025, 0.1, { params: { hunter: { metric: 'valuation.pe', symbol: 'ADRO', year: 2025 } } }),
    ])).toEqual([]);
  });
  it('does not turn absent data into zero observations', () => {
    expect(evidenceSeries([observation(2023, 'empty'), observation(2024, 'unknown'), observation(2025, 0.05)])).toEqual([]);
  });
  it('preserves actual zeros and negative observations', () => {
    expect(evidenceSeries([observation(2023, 0), observation(2024, -0.05)])[0]?.points.map(p => p.value)).toEqual([0, -0.05]);
  });
  it('rejects invalid dates and accepts real full dates', () => {
    const params = (date: string) => ({ hunter: { metric: 'daily.close', symbol: 'ADRO', date } });
    expect(evidenceSeries([observation(2023, 1, { params: params('2026-02-30') }), observation(2024, 2, { params: params('2026-03-01') })])).toEqual([]);
    expect(evidenceSeries([observation(2023, 1, { params: params('2026-02-28') }), observation(2024, 2, { params: params('2026-03-01') })])[0]?.points).toHaveLength(2);
  });
  it('does not chart coverage metrics', () => {
    expect(evidenceSeries([observation(2023, 1, { params: { hunter: { metric: 'dividend.year_coverage', symbol: 'ADRO', year: 2023 } } }), observation(2025, 2)])).toEqual([]);
  });
});
describe('common scale has an explicit zero axis', () => {
  it('places negative values on the left and positive values on the right', () => {
    const scale = barScale([-2, 6]); expect(scale.zero).toBe(25);
    expect(scale.bar(-2)).toEqual({ left: 0, width: 25 });
    expect(scale.bar(6)).toEqual({ left: 25, width: 75 });
  });
  it('handles all-zero observations without dividing by zero', () => {
    expect(barScale([0, 0]).bar(0)).toEqual({ left: 0, width: 0 });
    expect(barScale([-2, -1]).zero).toBe(100);
  });
});
describe('source charts do not require fabricated history', () => {
  it('renders the ADRO yield snapshots without mixing in payout ratios or rupiah', () => {
    const charts = sourceCharts(fixture.result.evidence, claim, verdict);
    expect(charts[0]?.key).toBe('yield-snapshot');
    expect(charts[0]?.rows.map(row => row.value)).toEqual([0.255, 0.236, 0.452, 0.0556]);
    expect(charts[0]?.note).toContain('bukan urutan waktu');
    expect(charts[0]?.rows.every(row => fixture.result.evidence.some(record => record.evidenceId === row.evidenceId))).toBe(true);
  });
  it('falls back to claim vs data for valuation without historical observations', () => {
    const fixture = checkFixtures[1]!;
    expect(sourceCharts(fixture.result.evidence, fixture.result.claims[0], fixture.result.verdicts[0])[0]?.rows.map(row => row.value)).toEqual([3, 3]);
  });
  it('does not draw numbers when evidence is missing or units are incompatible', () => {
    expect(sourceCharts([], claim, verdict)).toEqual([]);
    expect(sourceCharts(fixture.result.evidence.filter(record => record.unit !== '%'), claim,
      { ...verdict, computed: { value: -0.897, unit: 'x', evidenceId: 'adro-cash' } })).toEqual([]);
  });
  it('deduplicates identical snapshots while retaining all original records', () => {
    const records = [...fixture.result.evidence, fixture.result.evidence[0]!];
    expect(sourceCharts(records)[0]?.rows).toHaveLength(4); expect(records).toHaveLength(7);
  });
});
