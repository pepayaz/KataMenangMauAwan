import { parseFinancialPeriod, resolveAnnualFinancialRatio, type Claim } from '@cek-dulu/shared';
import { SectorsError, isMissingData } from '@cek-dulu/sectors';
import { GROWTH_ABS_FLOOR_PP, REL_TOLERANCE, withinAbsolute, withinRelative } from './tolerance.js';
import { makeEvidence, type VerifierContext, type VerifierOutput } from './types.js';
/** Ratios are taken from reported annual fields; no guessed assets denominator. */
export async function verifyFinancialRatio(claim: Claim, ctx: VerifierContext): Promise<VerifierOutput> {
  const metric = resolveAnnualFinancialRatio(claim.asserted.metric)!;
  const field = `financials.historical_financial_ratio.${metric.group}.${metric.field}`;
  const coverage: Record<string, unknown> = { endpoint: 'fetchCompanyReport', field, requestedPeriod: claim.asserted.period ?? 'belum disebutkan', metric: metric.label };
  const tol = '±0,1 poin persen untuk level rasio';
  const gap = (status: string, note: string, extra: Record<string, unknown> = {}, evidence: VerifierOutput['evidence'] = []): VerifierOutput => ({ evidence, matches: null, tolerance: tol, note, details: { coverage: { ...coverage, status, ...extra } } });
  if (claim.asserted.unit !== '%' || typeof claim.asserted.value !== 'number') return gap('UNIT_MISMATCH', 'Rasio keuangan memerlukan angka persen yang tertulis.');
  if (/poin|percentage points?/i.test(claim.asserted.metric)) return gap('DELTA_MODE_UNSUPPORTED', 'Klaim perubahan dalam poin persentase memerlukan pembandingan selisih rasio; angka itu tidak diperlakukan sebagai pertumbuhan relatif.');
  if (/qoq|quarter[ -]on[ -]quarter/i.test(`${claim.asserted.metric} ${claim.asserted.window ?? ''}`)) return gap('PERIOD_GRANULARITY_MISMATCH', 'Perubahan rasio antar kuartal tidak dapat diperiksa dari sumber rasio tahunan.');
  let report;
  try { report = await ctx.client.fetchCompanyReport(claim.ticker, ['financials'], { checkId: ctx.checkId }); }
  catch (err) {
    if (isMissingData(err)) return gap(err instanceof SectorsError ? err.code : 'SOURCE_UNAVAILABLE', 'Sumber rasio keuangan belum dapat dibaca untuk klaim ini.');
    throw err;
  }
  const raw = (report.data.financials as unknown as Record<string, unknown> | undefined)?.historical_financial_ratio;
  const rows = Array.isArray(raw) ? raw.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && !Array.isArray(row)) : [];
  coverage.availableYears = rows.map(row => Number(row.year)).filter(Number.isFinite);
  coverage.sourceCached = report.cached;
  const period = claim.asserted.period ? parseFinancialPeriod(claim.asserted.period) : null;
  if (period?.kind !== 'year') return gap('PERIOD_GRANULARITY_MISMATCH', `${metric.label} tersedia sebagai rasio tahunan. Data tahun terbaru tidak dipakai menggantikan rasio kuartal atau semester pada klaim.`, { missingFields: [`${metric.label} untuk periode klaim`], reportGranularity: 'annual' });
  if (period.reportDate > ctx.today) return gap('PERIOD_NOT_FINISHED', 'Tahun laporan yang diminta belum selesai.');
  const valueAt = (year: number): number | null => {
    const matches = rows.filter(row => Number(row.year) === year);
    if (matches.length !== 1) return null;
    const group = matches[0]![metric.group];
    const value = group && typeof group === 'object' ? (group as Record<string, unknown>)[metric.field] : null;
    return typeof value === 'number' && Number.isFinite(value) ? value * 100 : null;
  };
  const current = valueAt(period.year);
  if (current === null) return gap('FIELD_OR_YEAR_MISSING', `Field ${metric.field} kosong atau tahun laporan yang diminta belum tersedia.`, { missing: [{ date: String(period.year), field, reason: 'FIELD_OR_YEAR_MISSING' }] });
  const currentEvidence = makeEvidence(claim.claimId, report, `${metric.label} ${claim.ticker} tahun ${period.year}`, current, '%');
  const growth = /pertumbuhan|perubahan|growth|change/i.test(claim.asserted.metric) && !/\(level\)/i.test(claim.asserted.metric);
  if (growth) {
    const base = valueAt(period.year - 1);
    if (base === null || base <= 0) return gap('COMPARISON_DATA_MISSING', `Rasio ${metric.label} pada tahun pembanding belum tersedia atau basisnya tidak positif.`, { missingFields: [`${metric.field} tahun pembanding`] }, [currentEvidence]);
    const computed = (current / base - 1) * 100;
    const baseEvidence = makeEvidence(claim.claimId, report, `${metric.label} ${claim.ticker} tahun ${period.year - 1}`, base, '%');
    const comparison = makeEvidence(claim.claimId, report, `Pertumbuhan ${metric.label} YoY`, Math.round(computed * 100) / 100, '%');
    return { evidence: [comparison, currentEvidence, baseEvidence], computed: { value: comparison.value as number, unit: '%', evidenceId: comparison.evidenceId },
      matches: withinRelative(claim.asserted.value, computed, REL_TOLERANCE.earnings_growth) || withinAbsolute(claim.asserted.value, computed, GROWTH_ABS_FLOOR_PP),
      tolerance: '±10% relatif atau ±0,5 poin persen', note: `Pertumbuhan rasio ${metric.label} dihitung dari tahun yang sama pada sumber financials.`, details: { coverage: { ...coverage, status: 'CHECKED', formula: '(current_ratio / base_ratio - 1) * 100' } } };
  }
  return { evidence: [currentEvidence], computed: { value: current, unit: '%', evidenceId: currentEvidence.evidenceId }, matches: withinAbsolute(claim.asserted.value, current, 0.1), tolerance: tol,
    note: `${metric.label} dibandingkan langsung dengan field rasio tahunan yang dilaporkan.`, details: { coverage: { ...coverage, status: 'CHECKED', formula: 'reported_ratio * 100' } } };
}
