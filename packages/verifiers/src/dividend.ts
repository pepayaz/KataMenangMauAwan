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

/**
 * Dividen nominal per saham ("Rp87 per saham"). Di atas batas ini angkanya
 * hampir pasti total nilai dividen perusahaan (mis. Rp3,3 triliun), yang tidak
 * disediakan Sectors; klaim seperti itu tidak bisa diverifikasi.
 */
export const MAX_DIVIDEND_PER_SHARE_IDR = 1_000_000;
/** Nominal dividen yang diumumkan bersifat pasti; selisih kecil hanya pembulatan. */
export const DIVIDEND_AMOUNT_TOLERANCE = 0.02;

export type DividendAmountBasis =
  | { kind: 'payment'; label: string; value: number; date: string }
  | { kind: 'year_total'; label: string; value: number; year: number }
  | { kind: 'ttm'; label: string; value: number };

/** Klaim nominal rupiah, bukan yield: unit IDR, atau metrik per saham tanpa unit. */
export function isDividendAmountClaim(claim: Pick<Claim, 'asserted'>): boolean {
  return claim.asserted.unit === 'IDR'
    || (claim.asserted.unit === undefined && /per[\s_-]?(saham|share)|dps|nominal/i.test(claim.asserted.metric));
}

/**
 * Dasar nominal per saham yang bisa dirujuk klaim. Murni.
 *
 * Bila tahun buku disebut, dividen tahun buku Y dibayar pada Y (interim) atau
 * Y+1 (final), jadi pembayaran kedua tahun itu dipertimbangkan.
 */
export function dividendAmountBases(dividend: DividendSection, ticker: string, period?: string): DividendAmountBasis[] {
  const year = period !== undefined ? Number(/\b(20\d{2})\b/.exec(period)?.[1] ?? NaN) : NaN;
  const out: DividendAmountBasis[] = [];
  for (const [yearKey, row] of Object.entries(dividend.historical_dividends ?? {})) {
    const rowYear = Number(yearKey);
    if (!Number.isFinite(rowYear) || !row) continue;
    const inPeriod = !Number.isFinite(year) || rowYear === year || rowYear === year + 1;
    if (!inPeriod) continue;
    for (const payment of row.breakdown ?? []) {
      if (typeof payment.total !== 'number' || !Number.isFinite(payment.total)) continue;
      out.push({ kind: 'payment', label: `Dividen per saham ${ticker} ${payment.date}`, value: payment.total, date: payment.date });
    }
    if ((!Number.isFinite(year) || rowYear === year) && typeof row.total_dividend === 'number' && Number.isFinite(row.total_dividend)) {
      out.push({ kind: 'year_total', label: `Total dividen per saham ${ticker} ${rowYear}`, value: row.total_dividend, year: rowYear });
    }
  }
  if (!Number.isFinite(year) && typeof dividend.dividend_ttm === 'number' && Number.isFinite(dividend.dividend_ttm)) {
    out.push({ kind: 'ttm', label: `Dividen TTM ${ticker}`, value: dividend.dividend_ttm });
  }
  return out;
}

/** Dasar nominal terdekat dalam toleransi, atau null. Murni. */
export function matchDividendAmount(bases: readonly DividendAmountBasis[], claimedIdr: number,
  tolerance: number = DIVIDEND_AMOUNT_TOLERANCE): DividendAmountBasis | null {
  let best: DividendAmountBasis | null = null;
  for (const basis of bases) {
    if (!withinRelative(claimedIdr, basis.value, tolerance)) continue;
    if (!best || Math.abs(claimedIdr - basis.value) < Math.abs(claimedIdr - best.value)) best = basis;
  }
  return best;
}

function verifyDividendAmount(claim: Claim, report: Parameters<typeof makeEvidence>[1], dividend: DividendSection): VerifierOutput {
  const tol = describeRelative(DIVIDEND_AMOUNT_TOLERANCE);
  const claimed = claim.asserted.value!;
  if (claimed > MAX_DIVIDEND_PER_SHARE_IDR) {
    return unverifiable('Sectors hanya menyediakan dividen per saham; total nilai dividen perusahaan tidak dapat diverifikasi.', tol);
  }
  const bases = dividendAmountBases(dividend, claim.ticker, claim.asserted.period);
  if (!bases.length) {
    return unverifiable(`Tidak ada data pembayaran dividen ${claim.ticker} untuk periode yang disebut.`, tol);
  }
  const matched = matchDividendAmount(bases, claimed);
  const evidence = bases.map((b) => makeEvidence(claim.claimId, report, b.label, b.value, 'IDR'));
  const anchor = evidence.find((e) => e.label === matched?.label) ?? evidence[0]!;
  return {
    evidence,
    computed: { value: matched?.value ?? Number(anchor.value), unit: 'IDR', evidenceId: anchor.evidenceId },
    matches: matched !== null,
    tolerance: tol,
    note: matched
      ? `Dividen ${claim.ticker} Rp${claimed} per saham cocok dengan ${matched.label.toLowerCase()}.`
      : `Tidak ada pembayaran dividen ${claim.ticker} yang mendekati Rp${claimed} per saham pada periode itu.`,
    details: { matchedBasis: matched?.kind ?? null, matchedLabel: matched?.label ?? null, claimKind: 'per_share_amount' },
  };
}

export const verifyDividend: Verifier = async (claim: Claim, ctx): Promise<VerifierOutput> => {
  const tol = describeRelative(REL_TOLERANCE.dividend);
  if (typeof claim.asserted.value !== 'number') {
    return unverifiable('Klaim dividen tidak menyebut angka yield atau nominal per saham.', tol);
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

  if (isDividendAmountClaim(claim)) return verifyDividendAmount(claim, report, dividend);

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
