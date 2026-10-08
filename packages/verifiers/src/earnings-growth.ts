import { parseFinancialPeriod, unsupportedFinancialMetric, type Claim, type FinancialPeriod } from '@cek-dulu/shared';
import type { QuarterlyFinancialItem } from '@cek-dulu/sectors';
import { isMissingData } from '@cek-dulu/sectors';
import { GROWTH_ABS_FLOOR_PP, REL_TOLERANCE, describeRelative, withinAbsolute, withinRelative } from './tolerance.js';
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
  const current = reportDate ? sorted.find(row => row.date === reportDate) : sorted[0];
  if (!current) return null;
  const currentValue = numeric(current, metric);
  if (currentValue === null) return null;

  const date = new Date(`${current.date}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const baseDate = mode === 'yoy' ? `${date.getUTCFullYear() - 1}${current.date.slice(4)}`
    : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 2, 0)).toISOString().slice(0, 10);
  const base = sorted.find(row => row.date === baseDate);
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
    const ending = `${year}-${period.q === 2 ? '06-30' : '12-31'}`;
    const end = rows.filter(row => row.date === ending);
    if (end.length !== 1) return null;
    const basis = end[0]!.period_basis;
    if (basis === 'cumulative') {
      const value = numeric(end[0]!, metric);
      if (period.q === 2) return value;
      const first = rows.filter(row => row.date === `${year}-06-30` && row.period_basis === basis);
      const before = first.length === 1 ? numeric(first[0]!, metric) : null;
      return value === null || before === null ? null : value - before;
    }
    if (basis !== 'quarterly') return null;
    const quarters = period.q === 2 ? ['03-31', '06-30'] : ['09-30', '12-31'];
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

export const verifyEarningsGrowth: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = `${describeRelative(REL_TOLERANCE.earnings_growth)} atau ±${String(GROWTH_ABS_FLOOR_PP).replace('.', ',')} poin persen`;
  if (typeof claim.asserted.value !== 'number' || claim.asserted.unit !== '%') {
    return unverifiable('Klaim pertumbuhan laba tidak menyebut angka persen.', tol);
  }

  if (unsupportedFinancialMetric(claim.asserted.metric))
    return unverifiable('Metrik ini memerlukan data khusus dan tidak boleh dibandingkan dengan total laba atau pendapatan.', tol);
  const period = claim.asserted.period ? parseFinancialPeriod(claim.asserted.period) : null;
  if (claim.asserted.period && !period && !/^(?:yoy|qoq|tahunan|kuartalan)$/i.test(claim.asserted.period) && !/^\d{4}-\d{2}-\d{2}$/.test(claim.asserted.period))
    return unverifiable('Periode laporan belum dapat dipetakan ke data pembanding.', tol);
  const phrase = `${claim.asserted.metric} ${claim.asserted.window ?? ''} ${claim.asserted.period ?? ''}`;
  const mode = resolveGrowthMode(phrase);
  const metric = resolveGrowthMetric(phrase);

  if (period?.kind === 'semester' && mode === 'qoq') return unverifiable('Klaim semester tidak boleh dibandingkan dengan pertumbuhan satu kuartal.', tol);
  const reportDate = period?.reportDate ?? (claim.asserted.period && /^\d{4}-\d{2}-\d{2}$/.test(claim.asserted.period) ? claim.asserted.period : undefined);
  let quarterly;
  try {
    quarterly = await ctx.client.fetchQuarterlyFinancials(
      claim.ticker,
      { n_quarters: period?.kind === 'semester' ? period.q + 4 : QUARTERS_TO_FETCH, ...(reportDate ? { report_date: reportDate } : {}) },
      { checkId: ctx.checkId },
    );
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(
        `Laporan kuartalan ${claim.ticker} tidak tersedia: ${(err as Error).message}`,
        tol,
      );
    }
    throw err;
  }

  const growth = period?.kind === 'semester' ? computeSemesterGrowth(quarterly.data, metric, period) : computeGrowth(quarterly.data, mode, metric, reportDate);
  if (!growth) {
    return unverifiable(
      period?.kind === 'semester' ? 'Basis kuartalan atau kumulatif dan data pembanding semester belum lengkap; pertumbuhan tidak dihitung dengan asumsi.' : 'Kuartal laporan dan kuartal pembanding yang sesuai belum lengkap.',
      tol,
    );
  }

  const metricLabel = metric === 'revenue' ? 'Pendapatan' : 'Laba';
  const currentLabel = period?.kind === 'semester' ? `Semester ${period.q === 2 ? 'I' : 'II'} ${period.year}` : growth.currentDate;
  const baseLabel = period?.kind === 'semester' ? `Semester ${period.q === 2 ? 'I' : 'II'} ${period.year - 1}` : growth.baseDate;
  const evidence = [
    makeEvidence(
      claim.claimId,
      quarterly,
      `${metricLabel} ${claim.ticker} ${currentLabel}`,
      growth.currentValue,
      'IDR',
    ),
    makeEvidence(
      claim.claimId,
      quarterly,
      `${metricLabel} ${claim.ticker} ${baseLabel}`,
      growth.baseValue,
      'IDR',
    ),
  ];

  if (growth.baseDegenerate) {
    return {
      evidence,
      matches: null,
      tolerance: tol,
      note:
        `${metricLabel} pembanding ${claim.ticker} pada ${growth.baseDate} adalah ${growth.baseValue}, ` +
        'sehingga persentase pertumbuhan tidak bermakna.',
      details: { mode, metric, growth },
    };
  }

  const growthEvidence = makeEvidence(
    claim.claimId,
    quarterly,
    `Pertumbuhan ${metricLabel.toLowerCase()} ${mode.toUpperCase()} ${claim.ticker}`,
    round2(growth.growthPct),
    '%',
  );
  evidence.unshift(growthEvidence);

  const matches = withinRelative(claim.asserted.value, growth.growthPct, REL_TOLERANCE.earnings_growth)
    || withinAbsolute(claim.asserted.value, growth.growthPct, GROWTH_ABS_FLOOR_PP);

  return {
    evidence,
    computed: { value: round2(growth.growthPct), unit: '%', evidenceId: growthEvidence.evidenceId },
    matches,
    tolerance: tol,
    note:
      `${metricLabel} ${claim.ticker} ${mode.toUpperCase()} tumbuh ${round2(growth.growthPct)}% ` +
      `(${growth.baseDate} ke ${growth.currentDate}).` +
      (matches ? '' : ` Klaim menyebut ${claim.asserted.value}%.`),
    details: { mode, metric, growth, quarters: quarterly.data.map((q) => q.date) },
  };
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
