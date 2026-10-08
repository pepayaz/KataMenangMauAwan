import { parseFinancialPeriod, financialQuarterEnds, resolveFinancialMetric, resolveAnnualFinancialRatio, financialField, type Claim, type FinancialPeriod } from '@cek-dulu/shared';
import { verifyFinancialRatio } from './financial-ratio.js';
import type { QuarterlyFinancialItem } from '@cek-dulu/sectors';
import { SectorsError, isMissingData } from '@cek-dulu/sectors';
import { FINANCIAL_AMOUNT_REL_TOLERANCE, GROWTH_ABS_FLOOR_PP, REL_TOLERANCE, describeRelative, withinAbsolute, withinRelative } from './tolerance.js';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 4 — Pertumbuhan laba. Contoh klaim: "Laba meledak 200%".
 *
 * Verifikasi (bab 4): hitung pertumbuhan YoY atau QoQ sesuai klaim dari laporan
 * kuartalan. Lima kuartal ditarik sekaligus supaya YoY, QoQ, dan kuartal
 * pembanding tersedia dalam satu panggilan.
 */

export const QUARTERS_TO_FETCH = 5;

export type GrowthMode = 'yoy' | 'qoq';
export type GrowthMetric = 'earnings' | 'revenue';

/** Menebak basis pertumbuhan dari kata-kata klaim. Murni. */
export function resolveGrowthMode(text: string): GrowthMode {
  return /\b(qoq|kuartal(an)? (lalu|sebelumnya)|quarter[ -]on[ -]quarter)\b/i.test(text)
    ? 'qoq'
    : 'yoy';
}

/** Metrik yang dimaksud klaim: laba atau pendapatan. Murni. */
export function resolveGrowthMetric(text: string): GrowthMetric {
  return /\b(revenue|pendapatan|omset|omzet|penjualan|sales)\b/i.test(text) ? 'revenue' : 'earnings';
}

export type GrowthResult = {
  mode: GrowthMode;
  metric: GrowthMetric;
  currentDate: string;
  currentValue: number;
  baseDate: string;
  baseValue: number;
  /** Pertumbuhan dalam poin persen. */
  growthPct: number;
  /** True bila basis negatif atau nol — persentase jadi tidak bermakna. */
  baseDegenerate: boolean;
};

function numeric(row: QuarterlyFinancialItem, metric: GrowthMetric): number | null {
  const v = row[metric];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Menghitung pertumbuhan dari deret kuartalan. Murni.
 *
 * Basis negatif ditandai, tidak dibuang: "laba naik 200%" dari rugi ke laba
 * adalah persentase yang tidak bermakna, dan itu justru konteks yang dicari
 * (hipotesis GRW_LOW_BASE).
 */
export function computeGrowth(
  rows: QuarterlyFinancialItem[],
  mode: GrowthMode,
  metric: GrowthMetric,
  reportDate?: string,
): GrowthResult | null {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const currentRows = sorted.filter(row => row.date === (reportDate ?? sorted[0]?.date));
  const current = currentRows.length === 1 ? currentRows[0] : undefined;
  if (!current) return null;
  const currentValue = numeric(current, metric);
  if (currentValue === null) return null;

  const date = new Date(`${current.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const baseDate = mode === 'yoy' ? `${date.getUTCFullYear() - 1}${current.date.slice(4)}`
    : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 2, 0)).toISOString().slice(0, 10);
  const baseRows = sorted.filter(row => row.date === baseDate);
  const base = baseRows.length === 1 ? baseRows[0] : undefined;
  if (!base) return null;
  const baseValue = numeric(base, metric);
  if (baseValue === null) return null;

  const baseDegenerate = baseValue <= 0;
  const growthPct = baseDegenerate
    ? Number.NaN
    : ((currentValue - baseValue) / Math.abs(baseValue)) * 100;

  return {
    mode,
    metric,
    currentDate: current.date,
    currentValue,
    baseDate: base.date,
    baseValue,
    growthPct,
    baseDegenerate,
  };
}

/** Semester totals need an explicitly identified data basis; never assume quarter vs YTD. */
export function computeSemesterGrowth(rows: QuarterlyFinancialItem[], metric: GrowthMetric, period: FinancialPeriod): GrowthResult | null {
  const total = (year: number): number | null => {
    const ending = `${year}${period.reportDate.slice(4)}`;
    const end = rows.filter(row => row.date === ending);
    if (end.length !== 1) return null;
    const basis = end[0]!.period_basis;
    if (basis === 'cumulative') {
      const value = numeric(end[0]!, metric);
      if (period.kind !== 'semester' || period.q === 2) return value;
      const first = rows.filter(row => row.date === `${year}-06-30` && row.period_basis === basis);
      const before = first.length === 1 ? numeric(first[0]!, metric) : null;
      return value === null || before === null ? null : value - before;
    }
    if (basis !== 'quarterly') return null;
    const quarters = financialQuarterEnds(period);
    let sum = 0;
    for (const quarter of quarters) {
      const matches = rows.filter(row => row.date === `${year}-${quarter}` && row.period_basis === basis);
      const value = matches.length === 1 ? numeric(matches[0]!, metric) : null;
      if (value === null) return null;
      sum += value;
    }
    return sum;
  };
  const currentValue = total(period.year), baseValue = total(period.year - 1);
  if (currentValue === null || baseValue === null) return null;
  return { mode: 'yoy', metric, currentDate: period.reportDate, baseDate: `${period.year - 1}${period.reportDate.slice(4)}`,
    currentValue, baseValue, baseDegenerate: baseValue <= 0,
    growthPct: baseValue <= 0 ? Number.NaN : (currentValue - baseValue) / baseValue * 100 };
}

/** Missing evidence is recorded with the exact field/date, never represented as zero. */
export const verifyEarningsGrowth: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  if (resolveAnnualFinancialRatio(claim.asserted.metric)) return verifyFinancialRatio(claim, ctx);
  const growthTolerance = `${describeRelative(REL_TOLERANCE.earnings_growth)} atau ±${String(GROWTH_ABS_FLOOR_PP).replace('.', ',')} poin persen`;
  const nominal = claim.asserted.unit === 'IDR';
  const tol = nominal ? describeRelative(FINANCIAL_AMOUNT_REL_TOLERANCE) : growthTolerance;
  const period = claim.asserted.period ? parseFinancialPeriod(claim.asserted.period) : null;
  const metric = resolveFinancialMetric(claim.asserted.metric);
  const coverage: Record<string, unknown> = { endpoint: 'fetchQuarterlyFinancials', metric: claim.asserted.metric,
    field: metric?.path.join('.'), requestedPeriod: claim.asserted.period ?? 'laporan kuartal terbaru' };
  const gap = (code: string, note: string, extra: Record<string, unknown> = {}, evidence: VerifierOutput['evidence'] = []): VerifierOutput => ({
    evidence, matches: null, tolerance: tol, note, details: { coverage: { ...coverage, status: code, ...extra } },
  });
  if (typeof claim.asserted.value !== 'number' || !['%', 'IDR'].includes(claim.asserted.unit ?? ''))
    return gap('CLAIM_INCOMPLETE', 'Klaim keuangan belum menyebut angka dengan satuan yang sesuai.');
  if (!metric)
    return gap('METRIC_UNSUPPORTED', 'Metrik ini belum memiliki field Sectors dengan definisi yang sama; total laba tidak digunakan sebagai pengganti.');
  if (nominal && !period && !/^\d{4}-\d{2}-\d{2}$/.test(claim.asserted.period ?? ''))
    return gap('PERIOD_REQUIRED', 'Nominal laporan memerlukan periode kuartal atau semester yang jelas.');
  if (claim.asserted.period && !period && !/^(?:yoy|qoq|y-o-y|q-o-q|year[ -]on[ -]year|quarter[ -]on[ -]quarter|tahunan|kuartalan|secara tahunan|secara kuartalan)$/i.test(claim.asserted.period)
    && !/^\d{4}-\d{2}-\d{2}$/.test(claim.asserted.period))
    return gap('PERIOD_REQUIRED', 'Periode laporan belum dapat dipetakan ke data pembanding.');
  const phrase = `${claim.asserted.metric} ${claim.asserted.window ?? ''} ${claim.asserted.period ?? ''}`;
  const mode = resolveGrowthMode(phrase);
  if (!nominal && period && period.kind !== 'quarter' && mode === 'qoq')
    return gap('PERIOD_MISMATCH', 'Klaim semester tidak boleh dibandingkan dengan pertumbuhan satu kuartal.');
  const reportDate = period?.reportDate ?? (/^\d{4}-\d{2}-\d{2}$/.test(claim.asserted.period ?? '') ? claim.asserted.period : undefined);
  let quarterly;
  try {
    quarterly = await ctx.client.fetchQuarterlyFinancials(claim.ticker,
      { n_quarters: period && period.kind !== 'quarter' ? period.q + 4 : QUARTERS_TO_FETCH, ...(reportDate ? { report_date: reportDate } : {}) },
      { checkId: ctx.checkId });
  } catch (err) {
    if (isMissingData(err)) return gap(err instanceof SectorsError ? err.code : 'SOURCE_UNAVAILABLE', err instanceof SectorsError && err.code === 'CACHE_MISS' ? 'Mode cache tidak menjalankan permintaan live, dan laporan untuk parameter ini belum tersimpan. Ini belum membuktikan data Sectors tidak tersedia.' : 'Sectors tidak menemukan laporan untuk simbol dan periode yang diminta.', { reportDate });
    throw err;
  }
  const rows = quarterly.data;
  coverage.availableDates = rows.map(row => row.date);
  coverage.sourceCached = quarterly.cached;
  const currentDate = reportDate ?? [...rows].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
  if (!currentDate) return gap('REPORT_MISSING', 'Respons Sectors tidak memuat laporan keuangan.');
  const neededDates = period && period.kind !== 'quarter' && metric?.basis !== 'stock'
    ? (financialQuarterEnds(period)).map(day => `${period.year}-${day}`) : [currentDate];
  const collect = (yearOffset: number): number | null => {
    const dates = neededDates.map(date => `${Number(date.slice(0, 4)) + yearOffset}${date.slice(4)}`);
    const selected = dates.map(date => rows.filter(row => row.date === date));
    const ending = selected.at(-1);
    if (!metric || !ending || ending.length !== 1) return null;
    // Stocks are snapshots, never sums. Cumulative H1/H2 flows use their proper boundaries.
    if (metric.basis === 'stock') return financialField(ending[0]!, metric);
    if (period && period.kind !== 'quarter' && ending[0]!.period_basis === 'cumulative') {
      const value = financialField(ending[0]!, metric);
      if (period.kind !== 'semester' || period.q === 2) return value;
      const first = rows.filter(row => row.date === `${period.year + yearOffset}-06-30` && row.period_basis === 'cumulative');
      const before = first.length === 1 ? financialField(first[0]!, metric) : null;
      return value === null || before === null ? null : value - before;
    }
    if (selected.some(matches => matches.length !== 1)) return null;
    if (period && period.kind !== 'quarter' && selected.some(matches => matches[0]!.period_basis !== 'quarterly')) return null;
    const values = selected.map(matches => financialField(matches[0]!, metric));
    return values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0);
  };
  if (!metric) return gap('METRIC_UNSUPPORTED', 'Field yang cocok dengan metrik klaim belum tersedia.');
  const currentRow = rows.find(row => row.date === currentDate);
  if ((!period || period.kind === 'quarter') && metric.basis === 'flow' && currentRow?.period_basis === 'cumulative' && !currentDate.endsWith('03-31')) return gap('BASIS_MISMATCH', 'Sumber bertanda kumulatif; angka kumulatif tidak boleh dianggap sebagai nilai satu kuartal. Diperlukan selisih kumulatif dengan kuartal sebelumnya.');
  const currentValue = collect(0);
  const missing = (dates: string[]) => dates.flatMap(date => {
    const matches = rows.filter(row => row.date === date);
    return matches.length !== 1 ? [{ date, field: metric.path.join('.'), reason: matches.length ? 'DUPLICATE_REPORT' : 'REPORT_MISSING' }]
      : financialField(matches[0]!, metric) === null ? [{ date, field: metric.path.join('.'), reason: 'FIELD_NULL_OR_MISSING' }] : [];
  });
  if (currentValue === null) return gap('CURRENT_DATA_MISSING', `Field ${metric.path.join('.')} atau basis laporan yang diperlukan belum lengkap pada periode klaim.`, { missing: missing(neededDates) });
  const currentLabel = period?.kind === 'ytd' && metric.basis === 'flow' ? `Kumulatif hingga Q${period.q} ${period.year}` : period?.kind === 'year' && metric.basis === 'flow' ? `Tahun ${period.year}` : period?.kind === 'semester' && metric.basis === 'flow' ? `Semester ${period.q === 2 ? 'I' : 'II'} ${period.year}` : currentDate;
  const currentEvidence = makeEvidence(claim.claimId, quarterly, `${metric.label} ${claim.ticker} ${currentLabel}`, currentValue, 'IDR');
  if (nominal) return {
    evidence: [currentEvidence], computed: { value: currentValue, unit: 'IDR', evidenceId: currentEvidence.evidenceId },
    matches: withinRelative(claim.asserted.value, currentValue, FINANCIAL_AMOUNT_REL_TOLERANCE), tolerance: tol,
    note: `${metric.label} dibandingkan dengan field ${metric.path.join('.')} pada periode klaim.`,
    details: { coverage: { ...coverage, status: 'CHECKED', formula: metric.basis === 'stock' ? 'snapshot' : 'period_total', currentDates: neededDates } },
  };
  if (/\(level\)/i.test(claim.asserted.metric)) return gap('UNIT_MISMATCH', 'Angka level metrik ini tidak boleh dianggap persentase pertumbuhan.', {}, [currentEvidence]);
  // Project only the selected field into the pure growth helper; labels retain its actual meaning.
  const projected = rows.map(row => ({ ...row, earnings: financialField(row, metric) }));
  const growth = period && period.kind !== 'quarter' && metric.basis === 'flow'
    ? computeSemesterGrowth(projected, 'earnings', period) : computeGrowth(projected, mode, 'earnings', currentDate);
  if (!growth) {
    const baseDates = mode === 'yoy' ? neededDates.map(date => `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`)
      : [new Date(Date.UTC(Number(currentDate.slice(0, 4)), Number(currentDate.slice(5, 7)) - 3, 0)).toISOString().slice(0, 10)];
    return gap('COMPARISON_DATA_MISSING', `Field ${metric.path.join('.')} untuk periode pembanding belum lengkap; angka pertumbuhan tidak dihitung dengan asumsi.`, { missing: missing(baseDates), neededDates: baseDates }, [currentEvidence]);
  }
  const baseLabel = period?.kind === 'ytd' && metric.basis === 'flow' ? `Kumulatif hingga Q${period.q} ${period.year - 1}` : period?.kind === 'year' && metric.basis === 'flow' ? `Tahun ${period.year - 1}` : period?.kind === 'semester' && metric.basis === 'flow' ? `Semester ${period.q === 2 ? 'I' : 'II'} ${period.year - 1}` : growth.baseDate;
  const baseEvidence = makeEvidence(claim.claimId, quarterly, `${metric.label} ${claim.ticker} ${baseLabel}`, growth.baseValue, 'IDR');
  if (growth.baseDegenerate) return gap('BASE_NOT_POSITIVE', 'Nilai pembanding nol atau negatif; persentase pertumbuhan biasa tidak bermakna.', {}, [currentEvidence, baseEvidence]);
  const growthEvidence = makeEvidence(claim.claimId, quarterly, `Pertumbuhan ${metric.label.toLowerCase()} ${mode.toUpperCase()} ${claim.ticker}`, round2(growth.growthPct), '%');
  return { evidence: [growthEvidence, currentEvidence, baseEvidence], computed: { value: round2(growth.growthPct), unit: '%', evidenceId: growthEvidence.evidenceId },
    matches: withinRelative(claim.asserted.value, growth.growthPct, REL_TOLERANCE.earnings_growth) || withinAbsolute(claim.asserted.value, growth.growthPct, GROWTH_ABS_FLOOR_PP),
    tolerance: tol, note: `${metric.label} ${mode.toUpperCase()} dihitung dari field ${metric.path.join('.')}.`,
    details: { mode, metric: metric.field, growth, coverage: { ...coverage, status: 'CHECKED', formula: '(current - base) / base * 100', currentDates: neededDates, baseDate: growth.baseDate } },
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
