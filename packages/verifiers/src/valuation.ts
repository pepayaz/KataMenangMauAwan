import type { Claim } from '@cek-dulu/shared';
import type { HistoricalValuation, ValuationSection } from '@cek-dulu/sectors';
import { isMissingData } from '@cek-dulu/sectors';
import { REL_TOLERANCE, describeRelative, withinRelative } from './tolerance.js';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 1 — Valuasi murah. Contoh klaim: "PER cuma 3x, murah banget".
 *
 * Verifikasi (bab 4): bandingkan PE/PB yang diklaim dengan nilai terbaru dan
 * historis per tahun; toleransi ±10% relatif.
 */

export type ValuationMetric = 'pe' | 'pb' | 'ps' | 'pcf' | 'peg';

const METRIC_WORDS: Array<[RegExp, ValuationMetric]> = [
  [/\b(pbv?|price[ -]?to[ -]?book|p\/b)\b/i, 'pb'],
  [/\b(psr?|price[ -]?to[ -]?sales|p\/s)\b/i, 'ps'],
  [/\b(pcf|price[ -]?to[ -]?cash)\b/i, 'pcf'],
  [/\bpeg\b/i, 'peg'],
  [/\b(per|pe|p\/e|price[ -]?to[ -]?earnings?|price[ -]?earnings?)\b/i, 'pe'],
];

/** Menerjemahkan sebutan metrik di klaim menjadi field Sectors. Murni. */
export function resolveValuationMetric(metric: string): ValuationMetric | null {
  for (const [re, key] of METRIC_WORDS) if (re.test(metric)) return key;
  return null;
}

/** Entri valuasi tahun terbaru yang punya nilai untuk metrik ini. Murni. */
export function latestWithMetric(
  rows: HistoricalValuation[],
  metric: ValuationMetric,
): HistoricalValuation | null {
  const sorted = [...rows].sort((a, b) => b.year - a.year);
  for (const row of sorted) {
    const v = row[metric];
    if (typeof v === 'number' && Number.isFinite(v)) return row;
  }
  return null;
}

export type ValuationComparison = {
  metric: ValuationMetric;
  claimed: number;
  official: number;
  year: number;
  peerAverage: number | null;
  matches: boolean;
  /** Tahun mana pun yang cocok dengan angka klaim — petunjuk "angka lama dipakai". */
  matchingYears: number[];
};

/**
 * Inti tipe 1, murni: membandingkan angka klaim dengan valuasi resmi.
 *
 * `matchingYears` sengaja dikembalikan walaupun tahun terbaru sudah cocok.
 * Klaim "PER 3x" yang hanya benar untuk 2021 adalah kasus "benar tapi
 * menyesatkan", dan Context Hunter (A) butuh daftar ini untuk menguji
 * hipotesis VAL_OWN_HISTORY.
 */
export function compareValuation(
  rows: HistoricalValuation[],
  metric: ValuationMetric,
  claimed: number,
  tolerance: number = REL_TOLERANCE.valuation,
): ValuationComparison | null {
  const latest = latestWithMetric(rows, metric);
  if (!latest) return null;

  const official = latest[metric] as number;
  const peerKey = `${metric}_peer_avg` as keyof HistoricalValuation;
  const peerRaw = latest[peerKey];
  const peerAverage = typeof peerRaw === 'number' && Number.isFinite(peerRaw) ? peerRaw : null;

  const matchingYears = rows
    .filter((r) => {
      const v = r[metric];
      return typeof v === 'number' && Number.isFinite(v) && withinRelative(claimed, v, tolerance);
    })
    .map((r) => r.year)
    .sort((a, b) => a - b);

  return {
    metric,
    claimed,
    official,
    year: latest.year,
    peerAverage,
    matches: withinRelative(claimed, official, tolerance),
    matchingYears,
  };
}

export const verifyValuation: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = describeRelative(REL_TOLERANCE.valuation);
  const metric = resolveValuationMetric(claim.asserted.metric);
  if (metric === null) {
    return unverifiable(
      `Metrik valuasi "${claim.asserted.metric}" tidak dikenali; yang didukung PE, PB, PS, PCF, PEG.`,
      tol,
    );
  }
  if (typeof claim.asserted.value !== 'number') {
    return unverifiable('Klaim valuasi tidak menyebut angka, jadi tidak ada yang bisa dibandingkan.', tol);
  }

  let report;
  try {
    report = await ctx.client.fetchCompanyReport(claim.ticker, ['valuation'], {
      checkId: ctx.checkId,
    });
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(`Data valuasi ${claim.ticker} tidak tersedia: ${(err as Error).message}`, tol);
    }
    throw err;
  }

  const valuation: ValuationSection | undefined = report.data.valuation;
  const rows = valuation?.historical_valuation ?? [];
  const comparison = compareValuation(rows, metric, claim.asserted.value);

  if (!comparison) {
    return unverifiable(`${claim.ticker} tidak punya data ${metric.toUpperCase()} historis.`, tol);
  }

  const upper = metric.toUpperCase();
  const evidence = [
    makeEvidence(
      claim.claimId,
      report,
      `${upper} ${claim.ticker} ${comparison.year}`,
      comparison.official,
      'x',
    ),
  ];

  if (comparison.peerAverage !== null) {
    evidence.push(
      makeEvidence(
        claim.claimId,
        report,
        `Rata-rata ${upper} peer ${comparison.year}`,
        comparison.peerAverage,
        'x',
      ),
    );
  }
  if (valuation?.last_close_price != null) {
    evidence.push(
      makeEvidence(claim.claimId, report, `Harga penutupan ${claim.ticker}`, valuation.last_close_price, 'IDR'),
    );
  }

  const primary = evidence[0];
  return {
    evidence,
    computed: { value: comparison.official, unit: 'x', evidenceId: primary!.evidenceId },
    matches: comparison.matches,
    tolerance: tol,
    note: comparison.matches
      ? `${upper} ${comparison.year} adalah ${comparison.official}; klaim ${comparison.claimed} masuk toleransi.`
      : `${upper} ${comparison.year} adalah ${comparison.official}, bukan ${comparison.claimed}.` +
        (comparison.matchingYears.length > 0
          ? ` Angka yang diklaim cocok untuk tahun ${comparison.matchingYears.join(', ')}.`
          : ''),
  };
};
