import type { Claim } from '@cek-dulu/shared';
import type { DividendSection } from '@cek-dulu/sectors';
import { isMissingData } from '@cek-dulu/sectors';
import { REL_TOLERANCE, describeRelative, toFraction, withinRelative } from './tolerance.js';
import { makeEvidence, unverifiable, type Verifier, type VerifierOutput } from './types.js';

/**
 * Tipe 2 — Dividen tinggi. Contoh klaim: "Yield dividennya 25% setahun".
 *
 * Verifikasi (bab 4): cocokkan yield yang diklaim dengan yield TTM, rata-rata
 * 5 tahun, dan yield per tahun; tentukan angka mana yang dirujuk.
 *
 * Ini kasus unggulan produk. ADRO 2024: rata-rata 5 tahun memang 25,5%, tetapi
 * yield TTM hanya 5,6%. Angkanya benar; dasarnya yang menyesatkan. Karena itu
 * verifier tidak berhenti pada "cocok / tidak cocok" — ia melaporkan dasar mana
 * yang cocok, supaya adjudicator dan Context Hunter bisa membedakan keduanya.
 */

export type DividendBasis =
  | { kind: 'ttm'; label: string; value: number }
  | { kind: 'avg'; label: string; value: number; period: number }
  | { kind: 'year'; label: string; value: number; year: number };

/** Semua angka yield resmi yang bisa jadi rujukan klaim. Murni. */
export function dividendBases(dividend: DividendSection): DividendBasis[] {
  const out: DividendBasis[] = [];

  if (typeof dividend.yield_ttm === 'number' && Number.isFinite(dividend.yield_ttm)) {
    out.push({ kind: 'ttm', label: 'Yield TTM', value: dividend.yield_ttm });
  }

  const avg = dividend.dividend_yield_avg;
  if (avg && typeof avg.avg_yield === 'number' && Number.isFinite(avg.avg_yield)) {
    out.push({
      kind: 'avg',
      label: `Rata-rata yield ${avg.period} tahun`,
      value: avg.avg_yield,
      period: avg.period,
    });
  }

  for (const [yearKey, row] of Object.entries(dividend.historical_dividends ?? {})) {
    const year = Number(yearKey);
    if (!Number.isFinite(year)) continue;
    if (typeof row?.total_yield !== 'number' || !Number.isFinite(row.total_yield)) continue;
    out.push({ kind: 'year', label: `Yield ${year}`, value: row.total_yield, year });
  }

  return out.sort((a, b) => b.value - a.value);
}

export type DividendMatch = {
  claimed: number;
  /** Dasar yang paling dekat dengan angka klaim, bila ada yang masuk toleransi. */
  matched: DividendBasis | null;
  /** Yield TTM — angka yang paling relevan bagi pembeli hari ini. */
  ttm: number | null;
  bases: DividendBasis[];
  matches: boolean;
};

/**
 * Mencocokkan yield yang diklaim dengan setiap dasar resmi. Murni.
 *
 * Bila klaim menyebut tahun tertentu, hanya dasar tahun itu yang dinilai;
 * kalau tidak, dasar mana pun yang cocok dianggap membenarkan angkanya.
 */
export function matchDividendYield(
  dividend: DividendSection,
  claimedFraction: number,
  period?: string,
  tolerance: number = REL_TOLERANCE.dividend,
): DividendMatch {
  const bases = dividendBases(dividend);
  const ttm = bases.find((b) => b.kind === 'ttm')?.value ?? null;

  const year = period !== undefined ? Number(/\b(20\d{2})\b/.exec(period)?.[1] ?? NaN) : NaN;
  const pool = Number.isFinite(year)
    ? bases.filter((b) => b.kind === 'year' && b.year === year)
    : bases;

  let best: DividendBasis | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const basis of pool) {
    if (!withinRelative(claimedFraction, basis.value, tolerance)) continue;
    const distance = Math.abs(claimedFraction - basis.value);
    if (distance < bestDistance) {
      best = basis;
      bestDistance = distance;
    }
  }

  return { claimed: claimedFraction, matched: best, ttm, bases, matches: best !== null };
}

export const verifyDividend: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = describeRelative(REL_TOLERANCE.dividend);
  if (typeof claim.asserted.value !== 'number') {
    return unverifiable('Klaim dividen tidak menyebut angka yield.', tol);
  }

  let report;
  try {
    report = await ctx.client.fetchCompanyReport(claim.ticker, ['dividend'], {
      checkId: ctx.checkId,
    });
  } catch (err) {
    if (isMissingData(err)) {
      return unverifiable(`Data dividen ${claim.ticker} tidak tersedia: ${(err as Error).message}`, tol);
    }
    throw err;
  }

  const dividend = report.data.dividend;
  if (!dividend) {
    return unverifiable(`${claim.ticker} tidak punya data dividen di Sectors.`, tol);
  }

  const claimed = toFraction(claim.asserted.value, claim.asserted.unit);
  const result = matchDividendYield(dividend, claimed, claim.asserted.period);

  const evidence = result.bases.map((b) =>
    makeEvidence(claim.claimId, report, `${b.label} ${claim.ticker}`, b.value, '%'),
  );

  if (typeof dividend.payout_ratio === 'number') {
    evidence.push(
      makeEvidence(claim.claimId, report, `Payout ratio ${claim.ticker}`, dividend.payout_ratio, 'x'),
    );
  }
  if (typeof dividend.cash_payout_ratio === 'number') {
    evidence.push(
      makeEvidence(
        claim.claimId,
        report,
        `Cash payout ratio ${claim.ticker}`,
        dividend.cash_payout_ratio,
        'x',
      ),
    );
  }
  if (typeof dividend.dividend_ttm === 'number') {
    evidence.push(
      makeEvidence(claim.claimId, report, `Dividen TTM ${claim.ticker}`, dividend.dividend_ttm, 'IDR'),
    );
  }

  const ttmEvidence = evidence.find((e) => e.label.startsWith('Yield TTM'));
  const matchedEvidence = result.matched
    ? evidence.find((e) => e.label.startsWith(result.matched!.label))
    : undefined;
  const anchor = matchedEvidence ?? ttmEvidence ?? evidence[0];

  if (evidence.length === 0 || !anchor) {
    return unverifiable(`${claim.ticker} tidak punya angka yield yang bisa dibandingkan.`, tol);
  }

  const note = result.matched
    ? result.matched.kind === 'ttm'
      ? `Yield TTM ${claim.ticker} memang ${pct(result.matched.value)}.`
      : `Angka ${pct(claimed)} cocok dengan ${result.matched.label.toLowerCase()} (${pct(result.matched.value)}), ` +
        `bukan yield TTM${result.ttm !== null ? ` yang ${pct(result.ttm)}` : ''}.`
    : `Tidak ada dasar yield ${claim.ticker} yang mendekati ${pct(claimed)}.` +
      (result.ttm !== null ? ` Yield TTM ${pct(result.ttm)}.` : '');

  const output: VerifierOutput = {
    evidence,
    computed: {
      value: result.matched?.value ?? result.ttm ?? 0,
      unit: '%',
      evidenceId: anchor.evidenceId,
    },
    matches: result.matches,
    tolerance: tol,
    note,
    details: {
      matchedBasis: result.matched?.kind ?? null,
      matchedLabel: result.matched?.label ?? null,
      yieldTtm: result.ttm,
      payoutRatio: dividend.payout_ratio ?? null,
      cashPayoutRatio: dividend.cash_payout_ratio ?? null,
      // Dipakai hipotesis DIV_ONE_OFF: satu pembayaran yang mendominasi rata-rata.
      breakdownByYear: Object.fromEntries(
        Object.entries(dividend.historical_dividends ?? {}).map(([year, row]) => [
          year,
          row?.breakdown ?? [],
        ]),
      ),
    },
  };
  return output;
};

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(1).replace('.', ',')}%`;
}
