import type { Claim } from '@cek-dulu/shared';
import type { QuarterlyFinancialItem } from '@cek-dulu/sectors';
import { isMissingData } from '@cek-dulu/sectors';
import { REL_TOLERANCE, describeRelative, withinRelative } from './tolerance.js';
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
): GrowthResult | null {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const current = sorted[0];
  if (!current) return null;
  const currentValue = numeric(current, metric);
  if (currentValue === null) return null;

  const base = mode === 'qoq' ? sorted[1] : sorted[4];
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

export const verifyEarningsGrowth: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = describeRelative(REL_TOLERANCE.earnings_growth);
  if (typeof claim.asserted.value !== 'number') {
    return unverifiable('Klaim pertumbuhan laba tidak menyebut angka persen.', tol);
  }

  const phrase = `${claim.asserted.metric} ${claim.asserted.window ?? ''} ${claim.asserted.period ?? ''}`;
  const mode = resolveGrowthMode(phrase);
  const metric = resolveGrowthMetric(phrase);

  let quarterly;
  try {
    quarterly = await ctx.client.fetchQuarterlyFinancials(
      claim.ticker,
      { n_quarters: QUARTERS_TO_FETCH },
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

  const growth = computeGrowth(quarterly.data, mode, metric);
  if (!growth) {
    return unverifiable(
      `${claim.ticker} tidak punya cukup kuartal untuk menghitung pertumbuhan ${mode.toUpperCase()}.`,
      tol,
    );
  }

  const metricLabel = metric === 'revenue' ? 'Pendapatan' : 'Laba';
  const evidence = [
    makeEvidence(
      claim.claimId,
      quarterly,
      `${metricLabel} ${claim.ticker} ${growth.currentDate}`,
      growth.currentValue,
      'IDR',
    ),
    makeEvidence(
      claim.claimId,
      quarterly,
      `${metricLabel} ${claim.ticker} ${growth.baseDate}`,
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

  const matches = withinRelative(
    claim.asserted.value,
    growth.growthPct,
    REL_TOLERANCE.earnings_growth,
  );

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
